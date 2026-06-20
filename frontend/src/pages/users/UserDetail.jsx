import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useUser, useUpdateUser, useUserStats } from "../../features/users/hooks/useUsers";
import { useTickets } from "../../features/tickets/hooks/useTickets";
import { useAuthStore } from "../../store/auth.store";
import { TicketStatusBadge, TicketPriorityBadge } from "../../features/tickets/components/TicketStatusBadge";
import ChangePasswordModal from "../../features/users/components/ChangePasswordModal";
import {
    MdArrowBack,
    MdEdit,
    MdSave,
    MdClose,
    MdPerson,
    MdEmail,
    MdCalendarToday,
    MdAccessTime,
    MdConfirmationNumber,
    MdShield,
    MdCheckCircle,
    MdCancel,
    MdLock,
} from "react-icons/md";

// ── helpers ────────────────────────────────────────────────
function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtRelative(d) {
    if (!d) return "Never";
    const diffH = Math.floor((Date.now() - new Date(d)) / 3600000);
    if (diffH < 1) return "Just now";
    if (diffH < 24) return `${diffH}h ago`;
    if (diffH < 168) return `${Math.floor(diffH / 24)}d ago`;
    return fmtDate(d);
}

// ── Role badge ─────────────────────────────────────────────
const ROLE_CFG = {
    super_admin: { label: "Super Admin", cls: "bg-red-100 text-red-700" },
    admin:       { label: "Admin",       cls: "bg-purple-100 text-purple-700" },
    technician:  { label: "Technician",  cls: "bg-blue-100 text-blue-700" },
    viewer:      { label: "Viewer",      cls: "bg-gray-100 text-[var(--text-secondary)]" },
};
function RoleBadge({ role }) {
    const cfg = ROLE_CFG[role] ?? { label: role, cls: "bg-gray-100 text-[var(--text-secondary)]" };
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>;
}

// ── Stat card ──────────────────────────────────────────────
function StatCard({ icon: Icon, iconBg, label, value }) {
    return (
        <div className="bg-[var(--bg-surface-2)] rounded-xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                <Icon className="text-white text-base" />
            </div>
            <div>
                <p className="text-xs text-[var(--text-muted)]">{label}</p>
                <p className="text-xl font-bold text-[var(--text-primary)]">{value ?? 0}</p>
            </div>
        </div>
    );
}

// ── Info row ──────────────────────────────────────────────
function InfoRow({ icon: Icon, label, children }) {
    return (
        <div className="flex items-start gap-3 py-3 border-b border-[var(--border-color)] last:border-0">
            <Icon className="text-[var(--text-muted)] text-lg mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="text-xs text-[var(--text-muted)] mb-0.5">{label}</p>
                <div className="text-sm text-[var(--text-primary)]">{children}</div>
            </div>
        </div>
    );
}

// ── Edit form ─────────────────────────────────────────────
function EditForm({ user, onCancel, onSaved }) {
    const update = useUpdateUser(user.id);
    const [form, setForm] = useState({ full_name: user.full_name ?? "", email: user.email ?? "" });
    const [error, setError] = useState(null);

    async function handleSave() {
        if (!form.full_name.trim()) { setError("Full name is required."); return; }
        if (!form.email.trim())     { setError("Email is required."); return; }
        setError(null);
        try {
            await update.mutateAsync({ full_name: form.full_name.trim(), email: form.email.trim() });
            onSaved();
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}
            <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Full name</label>
                <input
                    value={form.full_name}
                    onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                    className="input-field"
                    placeholder="Full name"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Email</label>
                <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="input-field"
                    placeholder="user@company.com"
                />
            </div>
            <p className="text-xs text-[var(--text-muted)]">
                Login credentials (password) can be changed separately via the security section below.
            </p>
            <div className="flex gap-3">
                <button
                    onClick={onCancel}
                    className="flex-1 py-2.5 text-sm border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)] transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={update.isPending}
                    className="flex-1 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                    <MdSave className="text-base" />
                    {update.isPending ? "Saving..." : "Save changes"}
                </button>
            </div>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────
export default function UserDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const currentUser = useAuthStore((s) => s.user);

    const isSelf  = currentUser?.id === id || currentUser?.id === Number(id);
    const isAdmin = ["admin", "super_admin"].includes(currentUser?.role);
    const canView = isSelf || isAdmin;

    const { data: user, isLoading, isError } = useUser(id);
    const { data: stats } = useUserStats(id);

    // Fetch tickets assigned to this user or created by them
    // The tickets endpoint supports device_id filter — we fetch all and filter client-side
    // by assigned_to_id. NOTE for backend: add assigned_to_id filter to GET /tickets/
    const { data: allTickets = [] } = useTickets({});
    const userTickets = allTickets.filter(
        (t) => t.assigned_to_id === user?.id || t.assigned_to_id === Number(id)
    );

    const [editing, setEditing]       = useState(false);
    const [passOpen, setPassOpen]     = useState(false);
    const [savedFlash, setSavedFlash] = useState(false);

    function handleSaved() {
        setEditing(false);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 3000);
    }

    // ── Guards ─────────────────────────────────────────────
    if (!canView)
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
                <p className="text-[var(--text-muted)]">You don't have permission to view this profile.</p>
                <button onClick={() => navigate(-1)} className="text-sm text-blue-600 hover:underline">← Go back</button>
            </div>
        );

    if (isLoading)
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );

    if (isError || !user)
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
                <p className="text-[var(--text-muted)]">User not found.</p>
                <button onClick={() => navigate("/users")} className="text-sm text-blue-600 hover:underline">← Back to Users</button>
            </div>
        );

    const ticketStats = {
        total:      userTickets.length,
        open:       userTickets.filter((t) => t.status === "open").length,
        inProgress: userTickets.filter((t) => t.status === "in_progress").length,
        resolved:   userTickets.filter((t) => ["resolved", "closed"].includes(t.status)).length,
    };

    return (
        <div className="max-w-4xl mx-auto space-y-5">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <Link to="/users" className="hover:text-[var(--text-primary)] transition-colors">Users</Link>
                <span>/</span>
                <span className="text-[var(--text-primary)] font-medium">{user.full_name}</span>
            </div>

            {/* Header card */}
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-color)] shadow-sm p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    {/* Avatar + name */}
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate("/users")} className="p-2 rounded-lg hover:bg-[var(--bg-surface-2)] text-[var(--text-muted)] transition-colors">
                            <MdArrowBack className="text-lg" />
                        </button>
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0 ${isSelf ? "bg-blue-600" : "bg-gray-400"}`}>
                            {user.full_name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-xl font-bold text-[var(--text-primary)]">{user.full_name}</h1>
                                {isSelf && <span className="text-xs text-blue-500 font-medium">(you)</span>}
                            </div>
                            <p className="text-sm text-[var(--text-muted)] mt-0.5">{user.email}</p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <RoleBadge role={user.role} />
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${user.is_active ? "bg-green-50 text-green-600" : "bg-gray-100 text-[var(--text-muted)]"}`}>
                                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                                    {user.is_active ? "Active" : "Inactive"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        {savedFlash && (
                            <span className="flex items-center gap-1.5 text-xs text-green-600">
                                <MdCheckCircle className="text-base" /> Saved
                            </span>
                        )}
                        {(isSelf || isAdmin) && !editing && (
                            <button
                                onClick={() => setEditing(true)}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] transition-colors"
                            >
                                <MdEdit className="text-base" /> Edit info
                            </button>
                        )}
                        {isSelf && (
                            <button
                                onClick={() => setPassOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] transition-colors"
                            >
                                <MdLock className="text-base" /> Change password
                            </button>
                        )}
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                    <StatCard icon={MdConfirmationNumber} iconBg="bg-blue-500"   label="Total Tickets"    value={stats?.total_tickets    ?? ticketStats.total} />
                    <StatCard icon={MdConfirmationNumber} iconBg="bg-amber-500"  label="Open Tickets"     value={stats?.open_tickets     ?? ticketStats.open} />
                    <StatCard icon={MdCheckCircle}        iconBg="bg-green-500"  label="Resolved Tickets" value={stats?.resolved_tickets  ?? ticketStats.resolved} />
                    <StatCard icon={MdShield}             iconBg="bg-purple-500" label="Role"             value={ROLE_CFG[user.role]?.label ?? user.role} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Info / Edit panel */}
                <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-color)] shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Profile information</h2>
                        {editing && (
                            <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-2)] text-[var(--text-muted)] transition-colors">
                                <MdClose className="text-base" />
                            </button>
                        )}
                    </div>

                    {editing ? (
                        <EditForm user={user} onCancel={() => setEditing(false)} onSaved={handleSaved} />
                    ) : (
                        <div>
                            <InfoRow icon={MdPerson} label="Full name">{user.full_name}</InfoRow>
                            <InfoRow icon={MdEmail} label="Email">{user.email}</InfoRow>
                            <InfoRow icon={MdShield} label="Role"><RoleBadge role={user.role} /></InfoRow>
                            <InfoRow icon={MdCalendarToday} label="Member since">{fmtDate(user.created_at)}</InfoRow>
                            <InfoRow icon={MdAccessTime} label="Last login">{fmtRelative(user.last_login)}</InfoRow>
                            <InfoRow icon={MdCheckCircle} label="Account status">
                                <span className={user.is_active ? "text-green-600" : "text-[var(--text-muted)]"}>
                                    {user.is_active ? "Active" : "Inactive"}
                                </span>
                            </InfoRow>
                        </div>
                    )}
                </div>

                {/* Ticket summary */}
                <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-color)] shadow-sm p-5">
                    <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Ticket summary</h2>
                    <div className="space-y-3">
                        {[
                            { label: "Open",        value: ticketStats.open,       color: "bg-blue-500",   width: ticketStats.total ? (ticketStats.open / ticketStats.total) * 100 : 0 },
                            { label: "In progress", value: ticketStats.inProgress, color: "bg-amber-400",  width: ticketStats.total ? (ticketStats.inProgress / ticketStats.total) * 100 : 0 },
                            { label: "Resolved",    value: ticketStats.resolved,   color: "bg-green-500",  width: ticketStats.total ? (ticketStats.resolved / ticketStats.total) * 100 : 0 },
                        ].map(({ label, value, color, width }) => (
                            <div key={label}>
                                <div className="flex items-center justify-between text-xs mb-1">
                                    <span className="text-[var(--text-muted)]">{label}</span>
                                    <span className="font-medium text-[var(--text-primary)]">{value}</span>
                                </div>
                                <div className="h-1.5 bg-[var(--bg-surface-2)] rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${Math.max(width, value > 0 ? 4 : 0)}%` }} />
                                </div>
                            </div>
                        ))}
                        {ticketStats.total === 0 && (
                            <p className="text-xs text-[var(--text-muted)] text-center py-4">No tickets assigned yet.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Ticket history */}
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                        Ticket history
                        {userTickets.length > 0 && (
                            <span className="ml-2 text-xs bg-[var(--bg-surface-2)] text-[var(--text-muted)] px-2 py-0.5 rounded-full">
                                {userTickets.length}
                            </span>
                        )}
                    </h2>
                </div>

                {userTickets.length === 0 ? (
                    <div className="p-8 text-center">
                        <MdConfirmationNumber className="text-4xl text-[var(--text-muted)] mx-auto mb-2" />
                        <p className="text-sm text-[var(--text-muted)]">No tickets assigned to this user.</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-[var(--border-color)] bg-[var(--bg-surface-2)]">
                                {["Ticket #", "Title", "Status", "Priority", "Device", "Created"].map((h) => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {userTickets.map((t) => (
                                <tr
                                    key={t.id}
                                    onClick={() => navigate(`/tickets/${t.id}`)}
                                    className="border-b border-[var(--border-color)] hover:bg-[var(--bg-surface-2)] cursor-pointer transition-colors last:border-0"
                                >
                                    <td className="px-4 py-3 text-xs font-mono font-semibold text-blue-600 whitespace-nowrap">
                                        {t.ticket_number}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-[var(--text-primary)] max-w-[200px] truncate">
                                        {t.title}
                                    </td>
                                    <td className="px-4 py-3"><TicketStatusBadge status={t.status} /></td>
                                    <td className="px-4 py-3"><TicketPriorityBadge priority={t.priority} /></td>
                                    <td className="px-4 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap">
                                        {t.device_name || "—"}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap">
                                        {fmtDate(t.created_at)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <ChangePasswordModal open={passOpen} onClose={() => setPassOpen(false)} user={user} isSelf={isSelf} />
        </div>
    );
}
