import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    GridComponent,
    ColumnsDirective,
    ColumnDirective,
    Inject,
    Sort,
    Filter,
    Toolbar,
    ExcelExport,
    PdfExport,
    ColumnChooser,
    Page,
    Resize,
    Search,
} from "@syncfusion/ej2-react-grids";
import { useTickets } from "../../features/tickets/hooks/useTickets";
import { TicketStatusBadge, TicketPriorityBadge } from "../../features/tickets/components/TicketStatusBadge";
import TicketForm from "../../features/tickets/components/TicketForm";
import { MdAdd, MdConfirmationNumber, MdFilterList } from "react-icons/md";

function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function StatCard({ label, value, color, onClick, active }) {
    return (
        <div
            onClick={onClick}
            className={`bg-[var(--bg-surface)] rounded-xl border shadow-sm p-4 cursor-pointer
        hover:shadow-md transition-all
        ${active ? "border-blue-400 ring-1 ring-blue-300" : "border-[var(--border-color)] hover:border-blue-100"}`}
        >
            <p className="text-xs text-[var(--text-muted)]">{label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value ?? 0}</p>
        </div>
    );
}

const PRIORITIES = ["", "low", "medium", "high", "critical"];

export default function TicketList() {
    const navigate = useNavigate();
    const gridRef = useRef(null);

    const [statusFilter, setStatusFilter] = useState("");
    const [priorityFilter, setPriorityFilter] = useState("");
    const [formOpen, setFormOpen] = useState(false);

    // ── Fetch ALL tickets (no filter) for accurate stats ──────
    const { data: allTickets = [] } = useTickets({});

    // ── Fetch filtered tickets for the grid ───────────────────
    const {
        data: filteredTickets = [],
        isLoading,
        isError,
    } = useTickets({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
    });

    // Stats always computed from ALL tickets — never affected by filter
    const stats = {
        total: allTickets.length,
        open: allTickets.filter((t) => t.status === "open").length,
        inProgress: allTickets.filter((t) => t.status === "in_progress").length,
        resolved: allTickets.filter((t) => t.status === "resolved").length,
        critical: allTickets.filter((t) => t.priority === "critical" && !["closed", "cancelled"].includes(t.status)).length,
    };

    // filteredTickets already include device_name from TicketSummaryResponse
    const enriched = filteredTickets;

    function toolbarClick(args) {
        if (!gridRef.current) return;
        if (args.item.id === "tgrid_excelexport") gridRef.current.excelExport();
        if (args.item.id === "tgrid_pdfexport") gridRef.current.pdfExport();
    }

    // Click stat card → toggle filter
    function handleStatClick(status) {
        setStatusFilter((prev) => (prev === status ? "" : status));
    }

    if (isLoading && !filteredTickets.length)
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );

    if (isError)
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-red-500 text-sm">Failed to load tickets.</p>
            </div>
        );

    return (
        <div className="space-y-5 max-w-full">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-xl font-bold text-[var(--text-primary)]">Tickets</h1>
                    <p className="text-sm text-[var(--text-muted)] mt-0.5">
                        {stats.total} total
                        {statusFilter && ` · showing ${filteredTickets.length} ${statusFilter.replace("_", " ")}`}
                    </p>
                </div>
                <button
                    onClick={() => setFormOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700
            text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                    <MdAdd className="text-lg" /> New Ticket
                </button>
            </div>

            {/* Stat cards — click to filter */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <StatCard label="Total" value={stats.total} color="text-[var(--text-primary)]" active={!statusFilter} onClick={() => setStatusFilter("")} />
                <StatCard label="Open" value={stats.open} color="text-blue-600" active={statusFilter === "open"} onClick={() => handleStatClick("open")} />
                <StatCard
                    label="In Progress"
                    value={stats.inProgress}
                    color="text-amber-600"
                    active={statusFilter === "in_progress"}
                    onClick={() => handleStatClick("in_progress")}
                />
                <StatCard label="Resolved" value={stats.resolved} color="text-green-600" active={statusFilter === "resolved"} onClick={() => handleStatClick("resolved")} />
                <StatCard
                    label="Critical"
                    value={stats.critical}
                    color="text-red-600"
                    active={priorityFilter === "critical"}
                    onClick={() => setPriorityFilter((p) => (p === "critical" ? "" : "critical"))}
                />
            </div>

            {/* Priority filter */}
            <div className="flex items-center gap-2 flex-wrap">
                <MdFilterList className="text-[var(--text-muted)]" />
                <span className="text-xs text-[var(--text-muted)]">Priority:</span>
                {PRIORITIES.map((p) => (
                    <button
                        key={p}
                        onClick={() => setPriorityFilter(p)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
              ${priorityFilter === p ? "bg-blue-600 text-white" : "bg-[var(--bg-surface-2)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                    >
                        {p || "All"}
                    </button>
                ))}
            </div>

            {/* Grid */}
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden">
                <GridComponent
                    id="tgrid"
                    ref={gridRef}
                    dataSource={enriched}
                    allowSorting
                    allowFiltering
                    allowResizing
                    showColumnChooser
                    allowExcelExport
                    allowPdfExport
                    allowPaging
                    filterSettings={{ type: "Menu" }}
                    pageSettings={{ pageSize: 15 }}
                    toolbarClick={toolbarClick}
                    toolbar={[
                        "Search",
                        "ColumnChooser",
                        { text: "Excel", id: "tgrid_excelexport", prefixIcon: "e-excelexport" },
                        { text: "PDF", id: "tgrid_pdfexport", prefixIcon: "e-pdfexport" },
                    ]}
                    rowSelected={(args) => navigate(`/tickets/${args.data.id}`)}
                    cssClass="e-grid-custom"
                >
                    <ColumnsDirective>
                        <ColumnDirective
                            field="ticket_number"
                            headerText="Ticket #"
                            width="130"
                            minWidth="100"
                            template={(r) => <span className="font-mono text-xs font-semibold text-blue-600">{r.ticket_number}</span>}
                        />
                        <ColumnDirective
                            field="title"
                            headerText="Title"
                            width="260"
                            minWidth="160"
                            template={(r) => <span className="text-sm font-medium text-[var(--text-primary)] truncate">{r.title}</span>}
                        />
                        <ColumnDirective field="status" headerText="Status" width="140" minWidth="110" template={(r) => <TicketStatusBadge status={r.status} />} />
                        <ColumnDirective field="priority" headerText="Priority" width="130" minWidth="100" template={(r) => <TicketPriorityBadge priority={r.priority} />} />
                        <ColumnDirective
                            field="device_name"
                            headerText="Device"
                            width="150"
                            minWidth="110"
                            template={(r) => <span className="text-xs text-[var(--text-muted)]">{r.device_name || "—"}</span>}
                        />
                        <ColumnDirective
                            field="created_at"
                            headerText="Created"
                            width="140"
                            minWidth="110"
                            template={(r) => <span className="text-xs text-[var(--text-muted)]">{fmtDate(r.created_at)}</span>}
                        />
                    </ColumnsDirective>
                    <Inject services={[Sort, Filter, Toolbar, ExcelExport, PdfExport, ColumnChooser, Page, Resize, Search]} />
                </GridComponent>
            </div>

            <TicketForm open={formOpen} onClose={() => setFormOpen(false)} />
        </div>
    );
}
