"""add network_scans and discovered_hosts tables

Revision ID: a1b2c3d4e5f6
Revises: <your_last_revision_id>
Create Date: 2025-01-01 00:00:00

Run with:
    alembic upgrade head

Or apply the raw SQL below directly in psql / pgAdmin if you're not using alembic yet.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision    = 'a1b2c3d4e5f6'
down_revision = None        # ← replace with your current head revision
branch_labels = None
depends_on    = None


def upgrade() -> None:
    # ----- network_scans -----
    op.create_table(
        "network_scans",
        sa.Column("id",          postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id",   postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("created_by",  postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id"),   nullable=False),
        sa.Column("subnet",      sa.String(50),  nullable=False),
        sa.Column("status",      sa.Enum(
            "pending", "running", "completed", "failed",
            name="scanstatus",
        ), nullable=False, server_default="pending"),
        sa.Column("error",       sa.Text,        nullable=True),
        sa.Column("total_found", sa.Integer,     server_default="0"),
        sa.Column("total_new",   sa.Integer,     server_default="0"),
        sa.Column("total_known", sa.Integer,     server_default="0"),
        sa.Column("started_at",  sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at",  sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
    )
    op.create_index("ix_network_scans_tenant_id", "network_scans", ["tenant_id"])

    # ----- discovered_hosts -----
    op.create_table(
        "discovered_hosts",
        sa.Column("id",           postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("scan_id",      postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("network_scans.id"), nullable=False),
        sa.Column("tenant_id",    postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("tenants.id"),       nullable=False),
        sa.Column("ip",           sa.String(45),  nullable=False),
        sa.Column("mac",          sa.String(17),  nullable=True),
        sa.Column("hostname",     sa.String(255), nullable=True),
        sa.Column("manufacturer", sa.String(200), nullable=True),
        sa.Column("open_ports",   postgresql.JSONB, server_default="[]"),
        sa.Column("os_guess",     sa.String(200), nullable=True),
        sa.Column("device_type",  sa.Enum(
            "router", "switch", "printer", "windows_pc",
            "linux_server", "nas", "camera", "voip_phone",
            "access_point", "unknown",
            name="devicetypeguess",
        ), server_default="unknown"),
        sa.Column("is_known",     sa.Boolean,     server_default="false"),
        sa.Column("asset_id",     postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("devices.id"), nullable=True),
        sa.Column("imported",     sa.Boolean,     server_default="false"),
        sa.Column("imported_at",  sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at",   sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
    )
    op.create_index("ix_discovered_hosts_scan_id",   "discovered_hosts", ["scan_id"])
    op.create_index("ix_discovered_hosts_tenant_id", "discovered_hosts", ["tenant_id"])
    op.create_index("ix_discovered_hosts_mac",       "discovered_hosts", ["mac"])


def downgrade() -> None:
    op.drop_table("discovered_hosts")
    op.drop_table("network_scans")
    op.execute("DROP TYPE IF EXISTS scanstatus")
    op.execute("DROP TYPE IF EXISTS devicetypeguess")
