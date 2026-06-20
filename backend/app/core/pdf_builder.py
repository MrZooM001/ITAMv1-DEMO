import io
from datetime import datetime
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
    HRFlowable,
)

# ----- Colors -----
PRIMARY = colors.HexColor("#1E3A5F")
SECONDARY = colors.HexColor("#2E86AB")
LIGHT_GRAY = colors.HexColor("#F4F6F8")
DARK_GRAY = colors.HexColor("#6B7280")
SUCCESS = colors.HexColor("#10B981")
WARNING = colors.HexColor("#F59E0B")
DANGER = colors.HexColor("#EF4444")
WHITE = colors.white


def build_pdf(
    title: str,
    subtitle: str,
    headers: list[str],
    rows: list[list[Any]],
    summary: dict[str, Any] | None = None,
    orientation: str = "portrait",  # "portrait" | "landscape"
) -> bytes:
    """
    بيبني PDF report احترافي وبيرجع الـ bytes.

    title:    اسم الـ report الكبير
    subtitle: وصف أو تاريخ التوليد
    headers:  headers الجدول
    rows:     صفوف البيانات
    summary:  dict بالإحصائيات فوق الجدول
    """

    buf = io.BytesIO()
    pagesize = landscape(A4) if orientation == "landscape" else A4

    doc = SimpleDocTemplate(
        buf,
        pagesize=pagesize,
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=2 * cm,
        bottomMargin=1.5 * cm,
    )

    styles = getSampleStyleSheet()
    story = []

    # ----- Header -----
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Normal"],
        fontSize=20,
        textColor=PRIMARY,
        fontName="Helvetica-Bold",
        spaceAfter=4,
    )
    sub_style = ParagraphStyle(
        "Sub",
        parent=styles["Normal"],
        fontSize=9,
        textColor=DARK_GRAY,
        spaceAfter=4,
    )

    story.append(Paragraph(title, title_style))
    story.append(Paragraph(subtitle, sub_style))
    story.append(HRFlowable(width="100%", thickness=2, color=PRIMARY, spaceAfter=12))

    # ----- Summary Cards -----
    if summary:
        card_data = [[str(v) for v in summary.values()]]
        card_heads = [[str(k) for k in summary.keys()]]

        card_table = Table(
            card_heads + card_data,
            colWidths=[pagesize[0] / len(summary) - 0.5 * cm] * len(summary),
        )
        card_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), LIGHT_GRAY),
                    ("BACKGROUND", (0, 1), (-1, 1), PRIMARY),
                    ("TEXTCOLOR", (0, 0), (-1, 0), DARK_GRAY),
                    ("TEXTCOLOR", (0, 1), (-1, 1), WHITE),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica"),
                    ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, 0), 8),
                    ("FONTSIZE", (0, 1), (-1, 1), 14),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("ROWBACKGROUNDS", (0, 0), (-1, -1), [LIGHT_GRAY, PRIMARY]),
                    ("BOX", (0, 0), (-1, -1), 0.5, SECONDARY),
                    ("GRID", (0, 0), (-1, -1), 0.5, WHITE),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("ROUNDEDCORNERS", [4]),
                ]
            )
        )
        story.append(card_table)
        story.append(Spacer(1, 0.5 * cm))

    # ----- Data Table -----
    if rows:
        col_count = len(headers)
        page_w = pagesize[0] - 3 * cm
        col_w = [page_w / col_count] * col_count

        table_data = [headers] + [
            [str(c) if c is not None else "—" for c in row] for row in rows
        ]
        table = Table(table_data, colWidths=col_w, repeatRows=1)

        # Row colors exchange
        row_bgs = []
        for i in range(1, len(table_data)):
            color = LIGHT_GRAY if i % 2 == 0 else WHITE
            row_bgs.append(("BACKGROUND", (0, i), (-1, i), color))

        table.setStyle(
            TableStyle(
                [
                    # Header row
                    ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
                    ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, 0), 9),
                    ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                    ("TOPPADDING", (0, 0), (-1, 0), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
                    # Data rows
                    ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 1), (-1, -1), 8),
                    ("ALIGN", (0, 1), (-1, -1), "LEFT"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 1), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
                    ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#E5E7EB")),
                    ("BOX", (0, 0), (-1, -1), 0.5, SECONDARY),
                    *row_bgs,
                ]
            )
        )
        story.append(table)
    else:
        story.append(Paragraph("No data available.", styles["Normal"]))

    # ----- Footer -----
    story.append(Spacer(1, 0.5 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=DARK_GRAY))
    story.append(
        Paragraph(
            f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC  |  ITAM System",
            ParagraphStyle(
                "Footer", parent=styles["Normal"], fontSize=7, textColor=DARK_GRAY
            ),
        )
    )

    doc.build(story)
    return buf.getvalue()
