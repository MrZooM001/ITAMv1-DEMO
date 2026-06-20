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
    ColumnChooser,
    Page,
    Resize,
    Search,
    SelectionSettings,
} from "@syncfusion/ej2-react-grids";
import { useUsers, useDeleteUser, useUpdateUserStatus } from "../../features/users/hooks/useUsers";
import { useAuthStore } from "../../store/auth.store";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/fetch.instance";
import UserForm from "../../features/users/components/UserForm";
import ChangeRoleModal from "../../features/users/components/ChangeRoleModal";
import ChangePasswordModal from "../../features/users/components/ChangePasswordModal";
import ResetPasswordModal from "../../features/users/components/ResetPasswordModal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { MdAdd, MdEdit, MdDelete, MdLock, MdShield, MdLockReset } from "react-icons/md";

// ── Role badge ─────────────────────────────────────────────
const ROLE_CFG = {
    super_admin: { label: "Super Admin", cls: "bg-red-100 text-red-700" },
    admin: { label: "Admin", cls: "bg-purple-100 text-purple-700" },
    technician: { label: "Technician", cls: "bg-blue-100 text-blue-700" },
    viewer: { label: "Viewer", cls: "bg-gray-100 text-[var(--text-secondary)]" },
};

function RoleBadge({ role }) {
    const cfg = ROLE_CFG[role] ?? { label: role, cls: "bg-gray-100 text-[var(--text-secondary)]" };
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>;
}

// ── Stat card ──────────────────────────────────────────────
function StatCard({ label, value, color }) {
    return (
        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-color)] shadow-sm p-4">
            <p className="text-xs text-[var(--text-muted)]">{label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value ?? 0}</p>
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────
export default function UserList() {
    const gridRef = useRef(null);
    const navigate = useNavigate();
    const qc = useQueryClient();
    const currentUser = useAuthStore((s) => s.user);
    const isAdmin = ["admin", "super_admin"].includes(currentUser?.role);
    const isSuperAdmin = currentUser?.role === "super_admin";

    const { data: users = [], isLoading, isError } = useUsers();
    const deleteMut = useDeleteUser();
    const statusMut = useUpdateUserStatus(null); // overridden per-call via direct api

    const [formOpen, setFormOpen] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [roleTarget, setRoleTarget] = useState(null);
    const [passTarget, setPassTarget] = useState(null);
    const [resetTarget, setResetTarget] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteErr, setDeleteErr] = useState(null);

    // Stats
    const total = users.length;
    const active = users.filter((u) => u.is_active).length;
    const inactive = total - active;
    const admins = users.filter((u) => u.role === "admin" || u.role === "super_admin").length;
    const technicians = users.filter((u) => u.role === "technician").length;

    const selectionSettings = { checkboxOnly: true, type: "Multiple" };

    function toolbarClick(args) {
        if (!gridRef.current) return;
        if (args.item.id === "ugrid_excelexport") gridRef.current.excelExport();
    }

    // Toggle status inline — direct API call + manual cache invalidate
    async function handleToggleStatus(user) {
        if (user.id === currentUser?.id) return;
        try {
            await api(`/users/${user.id}/status`, {
                method: "PUT",
                body: JSON.stringify({ is_active: !user.is_active }),
            });
            qc.invalidateQueries({ queryKey: ["users"] });
        } catch {}
    }

    async function handleDelete() {
        setDeleteErr(null);
        try {
            await deleteMut.mutateAsync(deleteTarget.id);
            setDeleteTarget(null);
        } catch (err) {
            setDeleteErr(err.message);
        }
    }

    // ── Actions cell ──────────────────────────────────────────
    function ActionsTemplate(row) {
        const isSelf = row.id === currentUser?.id;
        const canEdit = isAdmin && !isSelf;
        const canDelete = isAdmin && !isSelf;
        const canRoleChange = isAdmin && !isSelf && (isSuperAdmin || row.role !== "super_admin");

        return (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {/* Edit info */}
                <button
                    title="Edit"
                    onClick={() => {
                        setEditTarget(row);
                        setFormOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                    <MdEdit className="text-base" />
                </button>

                {/* Change role */}
                {canRoleChange && (
                    <button
                        title="Change role"
                        onClick={() => setRoleTarget(row)}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-purple-50 hover:text-purple-600 transition-colors"
                    >
                        <MdShield className="text-base" />
                    </button>
                )}

                {/* Change password — only self */}
                {isSelf && (
                    <button
                        title="Change password"
                        onClick={() => setPassTarget(row)}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-amber-50 hover:text-amber-600 transition-colors"
                    >
                        <MdLock className="text-base" />
                    </button>
                )}

                {/* Reset password — admin can reset others */}
                {!isSelf && isAdmin && (
                    <button
                        title="Reset password"
                        onClick={() => setResetTarget(row)}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-orange-50 hover:text-orange-500 transition-colors"
                    >
                        <MdLockReset className="text-base" />
                    </button>
                )}

                {/* Delete */}
                {canDelete && (
                    <button
                        title="Delete"
                        onClick={() => {
                            setDeleteErr(null);
                            setDeleteTarget(row);
                        }}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                        <MdDelete className="text-base" />
                    </button>
                )}
            </div>
        );
    }

    if (isLoading)
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );

    if (isError)
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-red-500 text-sm">Failed to load users.</p>
            </div>
        );

    return (
        <div className="space-y-5 max-w-full">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-xl font-bold text-[var(--text-primary)]">Users</h1>
                    <p className="text-sm text-[var(--text-muted)] mt-0.5">{total} system users</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => {
                            setEditTarget(null);
                            setFormOpen(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700
              text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                    >
                        <MdAdd className="text-lg" /> Add User
                    </button>
                )}
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <StatCard label="Total" value={total} color="text-[var(--text-primary)]" />
                <StatCard label="Active" value={active} color="text-green-600" />
                <StatCard label="Inactive" value={inactive} color="text-[var(--text-muted)]" />
                <StatCard label="Admins" value={admins} color="text-purple-600" />
                <StatCard label="Technicians" value={technicians} color="text-blue-600" />
            </div>

            {/* Grid */}
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden">
                <GridComponent
                    id="ugrid"
                    ref={gridRef}
                    dataSource={users}
                    allowSorting
                    allowFiltering
                    allowResizing
                    showColumnChooser
                    allowExcelExport
                    allowPaging
                    filterSettings={{ type: "Menu" }}
                    pageSettings={{ pageSize: 15 }}
                    selectionSettings={selectionSettings}
                    recordClick={(args) => {
                        if (args.cellIndex === 0) {
                            return;
                        }
                        navigate(`/users/${args.rowData.id}`);
                    }}
                    searchSettings={{
                        fields: ["full_name", "email", "role"],
                        operator: "contains",
                        ignoreCase: true,
                    }}
                    toolbarClick={toolbarClick}
                    toolbar={["Search", "ColumnChooser", { text: "Excel", id: "ugrid_excelexport", prefixIcon: "e-excelexport" }]}
                    cssClass="e-grid-custom"
                >
                    <ColumnsDirective>
                        <ColumnDirective type="checkbox" width="50" />

                        {/* User */}
                        <ColumnDirective
                            field="full_name"
                            headerText="User"
                            width="200"
                            minWidth="150"
                            template={(r) => (
                                <div className="flex items-center gap-2.5">
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold
                    ${r.id === currentUser?.id ? "bg-blue-600" : "bg-gray-400"}`}
                                    >
                                        {r.full_name?.[0]?.toUpperCase() ?? "?"}
                                    </div>
                                    <div className="min-w-0">
                                        <p
                                            // onClick={(e) => {
                                            //     e.stopPropagation();
                                            //     navigate(`/users/${r.id}`);
                                            // }}
                                            className="font-medium text-blue-600  truncate"
                                        >
                                            {r.full_name}
                                            {r.id === currentUser?.id && <span className="ml-1.5 text-xs text-blue-400 font-normal">(you)</span>}
                                        </p>
                                    </div>
                                </div>
                            )}
                        />

                        {/* Email */}
                        <ColumnDirective
                            field="email"
                            headerText="Email"
                            width="220"
                            minWidth="160"
                            template={(r) => <span className="text-xs text-[var(--text-muted)]">{r.email}</span>}
                        />

                        {/* Role */}
                        <ColumnDirective field="role" headerText="Role" width="130" minWidth="110" template={(r) => <RoleBadge role={r.role} />} />

                        {/* Status */}
                        <ColumnDirective
                            field="is_active"
                            headerText="Status"
                            width="110"
                            minWidth="90"
                            template={(r) => (
                                <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium
                  ${r.is_active ? "bg-green-50 text-green-600" : "bg-gray-100 text-[var(--text-muted)]"}`}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                                    {r.is_active ? "Active" : "Inactive"}
                                </span>
                            )}
                        />

                        {/* Last login */}
                        <ColumnDirective
                            field="last_login"
                            headerText="Last Login"
                            width="150"
                            minWidth="120"
                            template={(r) => {
                                if (!r.last_login) return <span className="text-xs text-[var(--text-muted)]">Never</span>;
                                const d = new Date(r.last_login);
                                const now = new Date();
                                const diffH = Math.floor((now - d) / 3600000);
                                const label =
                                    diffH < 1
                                        ? "Just now"
                                        : diffH < 24
                                          ? `${diffH}h ago`
                                          : diffH < 168
                                            ? `${Math.floor(diffH / 24)}d ago`
                                            : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                                return <span className="text-xs text-[var(--text-muted)]">{label}</span>;
                            }}
                        />

                        {/* Created */}
                        <ColumnDirective
                            field="created_at"
                            headerText="Created"
                            width="130"
                            minWidth="110"
                            template={(r) => (
                                <span className="text-xs text-[var(--text-muted)]">
                                    {r.created_at ? new Date(r.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                                </span>
                            )}
                        />

                        {/* Actions */}
                        {isAdmin && <ColumnDirective headerText="Actions" width="130" minWidth="110" allowSorting={false} allowFiltering={false} template={ActionsTemplate} />}
                    </ColumnsDirective>
                    <Inject services={[Sort, Filter, Toolbar, ExcelExport, ColumnChooser, Page, Resize, Search]} />
                </GridComponent>
            </div>

            {/* Current user quick actions */}
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-color)] shadow-sm p-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                            {currentUser?.full_name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">{currentUser?.full_name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <RoleBadge role={currentUser?.role} />
                                <span className="text-xs text-[var(--text-muted)]">{currentUser?.email}</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setPassTarget(currentUser)}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200
              rounded-lg hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] transition-colors"
                    >
                        <MdLock className="text-base" /> Change my password
                    </button>
                </div>
            </div>

            {/* Modals */}
            <UserForm
                open={formOpen}
                onClose={() => {
                    setFormOpen(false);
                    setEditTarget(null);
                }}
                user={editTarget}
            />
            <ChangeRoleModal open={!!roleTarget} onClose={() => setRoleTarget(null)} user={roleTarget} />
            <ChangePasswordModal open={!!passTarget} onClose={() => setPassTarget(null)} user={passTarget} isSelf={passTarget?.id === currentUser?.id} />
            <ResetPasswordModal open={!!resetTarget} onClose={() => setResetTarget(null)} user={resetTarget} />
            <ConfirmDialog
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                loading={deleteMut.isPending}
                title="Delete User"
                message={deleteErr ?? `Delete "${deleteTarget?.full_name}"? This action cannot be undone.`}
                danger
            />
        </div>
    );
}
