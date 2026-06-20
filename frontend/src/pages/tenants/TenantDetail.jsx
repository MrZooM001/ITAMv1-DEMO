import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    MdArrowBack,
    MdEdit,
    MdSave,
    MdClose,
    MdPersonAdd,
    MdLockReset,
    MdBlock,
    MdCheckCircle,
    MdCancel,
    MdVisibility,
    MdVisibilityOff,
    MdDomain,
    MdMoreVert,
} from "react-icons/md";
import { getTenant, updateTenant, getTenantUsers, createTenantUser, updateTenantUserStatus, resetTenantUserPassword } from "../../features/tenants/api/tenants.api";

const ROLES = ["admin", "technician", "viewer"];

// ── Status badge ───────────────────────────────────────────

function StatusBadge({ isActive }) {
    return isActive ? (
        <span
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full
      bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        >
            <MdCheckCircle className="text-sm" /> Active
        </span>
    ) : (
        <span
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full
      bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
        >
            <MdCancel className="text-sm" /> Inactive
        </span>
    );
}

// ── Add User Modal ─────────────────────────────────────────

function AddUserModal({ tenantId, onClose, onAdded }) {
    const [form, setForm] = useState({ full_name: "", email: "", role: "admin", password: "" });
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    async function handleSubmit(e) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await createTenantUser(tenantId, form);
            onAdded();
        } catch (err) {
            setError(err.message ?? "Failed to add user.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
                    <h3 className="font-semibold text-[var(--text-primary)]">Add user to tenant</h3>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                        <MdClose className="text-xl" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                    {error && (
                        <div
                            className="px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800
              rounded-lg text-sm text-red-600 dark:text-red-400"
                        >
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Full name</label>
                        <input
                            type="text"
                            required
                            value={form.full_name}
                            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                            placeholder="Jane Smith"
                            className="input-field"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Email</label>
                        <input
                            type="email"
                            required
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            placeholder="jane@acme.com"
                            className="input-field"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Role</label>
                        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input-field">
                            {ROLES.map((r) => (
                                <option key={r} value={r}>
                                    {r.charAt(0).toUpperCase() + r.slice(1)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Initial password</label>
                        <div className="relative">
                            <input
                                type={showPass ? "text" : "password"}
                                required
                                minLength={8}
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                placeholder="Min. 8 characters"
                                className="input-field pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass((s) => !s)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]
                  hover:text-[var(--text-primary)] transition-colors"
                            >
                                {showPass ? <MdVisibilityOff className="text-lg" /> : <MdVisibility className="text-lg" />}
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 border border-[var(--border-color)] text-[var(--text-secondary)]
                hover:bg-[var(--bg-surface-2)] rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            {loading ? "Adding…" : "Add user"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Reset Password Modal ───────────────────────────────────

function ResetPasswordModal({ tenantId, user, onClose }) {
    const [newPassword, setNewPassword] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState(null);

    async function handleSubmit(e) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await resetTenantUserPassword(tenantId, user.id, { new_password: newPassword });
            setDone(true);
        } catch (err) {
            setError(err.message ?? "Failed to reset password.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-xl w-full max-w-sm">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
                    <h3 className="font-semibold text-[var(--text-primary)]">Reset password</h3>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                        <MdClose className="text-xl" />
                    </button>
                </div>
                <div className="px-6 py-5">
                    {done ? (
                        <div className="text-center py-4">
                            <MdCheckCircle className="text-green-500 text-4xl mx-auto mb-3" />
                            <p className="text-sm text-[var(--text-secondary)]">
                                Password reset for <strong className="text-[var(--text-primary)]">{user.full_name}</strong>.
                            </p>
                            <button
                                onClick={onClose}
                                className="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white
                  rounded-lg text-sm font-medium transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <p className="text-sm text-[var(--text-muted)]">
                                Set a new password for <strong className="text-[var(--text-primary)]">{user.full_name}</strong>.
                            </p>
                            {error && (
                                <div
                                    className="px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800
                  rounded-lg text-sm text-red-600 dark:text-red-400"
                                >
                                    {error}
                                </div>
                            )}
                            <div className="relative">
                                <input
                                    type={showPass ? "text" : "password"}
                                    required
                                    minLength={8}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="New password (min. 8 chars)"
                                    className="input-field pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass((s) => !s)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]
                    hover:text-[var(--text-primary)] transition-colors"
                                >
                                    {showPass ? <MdVisibilityOff className="text-lg" /> : <MdVisibility className="text-lg" />}
                                </button>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 py-2.5 border border-[var(--border-color)] text-[var(--text-secondary)]
                    hover:bg-[var(--bg-surface-2)] rounded-lg text-sm font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                    text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    {loading ? "Resetting…" : "Reset"}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── User row action menu ───────────────────────────────────

function UserActionsMenu({ tenantId, user, onResetPassword, onToggleStatus }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setOpen((o) => !o)}
                className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)]
          hover:bg-[var(--bg-surface-2)] transition-colors"
            >
                <MdMoreVert className="text-lg" />
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div
                        className="absolute right-0 top-8 z-20 w-44 bg-[var(--bg-surface)] border border-[var(--border-color)]
            rounded-lg shadow-lg overflow-hidden text-sm"
                    >
                        <button
                            onClick={() => {
                                setOpen(false);
                                onResetPassword(user);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-left
                hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] transition-colors"
                        >
                            <MdLockReset className="text-base text-[var(--text-muted)]" />
                            Reset password
                        </button>
                        {/* Backed by the dedicated PUT /tenants/{id}/users/{user_id}/status
                route (UserStatusUpdate schema) — not the general user-update
                endpoint, which intentionally has no is_active field. */}
                        <button
                            onClick={() => {
                                setOpen(false);
                                onToggleStatus(user);
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2.5 text-left
                hover:bg-[var(--bg-surface-2)] transition-colors ${user.is_active ? "text-red-600" : "text-green-600"}`}
                        >
                            <MdBlock className="text-base" />
                            {user.is_active ? "Deactivate user" : "Activate user"}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

// ── Main page ──────────────────────────────────────────────

export default function TenantDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [tenant, setTenant] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Inline name edit
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState("");
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);

    // Modals
    const [modal, setModal] = useState(null); // null | { type, user? }

    const loadTenant = useCallback(async () => {
        const data = await getTenant(id);
        setTenant(data);
        setEditName(data.name);
    }, [id]);

    const loadUsers = useCallback(async () => {
        const data = await getTenantUsers(id, { page_size: 100 });
        setUsers(data.items ?? data);
    }, [id]);

    useEffect(() => {
        setLoading(true);
        Promise.all([loadTenant(), loadUsers()])
            .catch((err) => setError(err.message ?? "Failed to load tenant."))
            .finally(() => setLoading(false));
    }, [loadTenant, loadUsers]);

    async function handleSaveName() {
        if (!editName.trim() || editName === tenant.name) {
            setIsEditing(false);
            return;
        }
        setSaveError(null);
        setSaving(true);
        try {
            const updated = await updateTenant(id, { name: editName.trim() });
            setTenant(updated);
            setIsEditing(false);
        } catch (err) {
            setSaveError(err.message ?? "Failed to save.");
        } finally {
            setSaving(false);
        }
    }

    async function handleToggleTenantActive() {
        try {
            const updated = await updateTenant(id, { is_active: !tenant.is_active });
            setTenant(updated);
        } catch {
            /* TODO: toast */
        }
    }

    async function handleToggleUserStatus(user) {
        try {
            const updated = await updateTenantUserStatus(id, user.id, !user.is_active);
            // Patch the single row in place from the returned UserResponse —
            // cheaper than refetching the whole list, and keeps the toggle snappy.
            setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        } catch (err) {
            // 400 here means "you cannot perform this action on your own account"
            // (_guard_no_self_delete) — shouldn't be reachable in this view since
            // the platform admin's own account lives in a different tenant, but
            // surface it instead of swallowing if it ever happens.
            alert(err.message ?? "Failed to update user status.");
        }
    }

    if (loading)
        return (
            <div className="flex justify-center py-32">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );

    if (error || !tenant) return <div className="p-6 text-center py-32 text-red-500 text-sm">{error ?? "Tenant not found."}</div>;

    return (
        <div className="p-6 space-y-6 max-w-4xl">
            {/* Back */}
            <button
                onClick={() => navigate("/tenants")}
                className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)]
          hover:text-[var(--text-primary)] transition-colors"
            >
                <MdArrowBack className="text-base" /> All tenants
            </button>

            {/* ── Tenant info card ─────────────────────────────── */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    {/* Avatar + name */}
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                            <MdDomain className="text-blue-600 dark:text-blue-400 text-2xl" />
                        </div>
                        <div>
                            {isEditing ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={editName}
                                        autoFocus
                                        onChange={(e) => setEditName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleSaveName();
                                            if (e.key === "Escape") setIsEditing(false);
                                        }}
                                        className="input-field text-lg font-semibold py-1 w-56"
                                    />
                                    <button
                                        onClick={handleSaveName}
                                        disabled={saving}
                                        className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-60"
                                    >
                                        <MdSave className="text-lg" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsEditing(false);
                                            setEditName(tenant.name);
                                        }}
                                        className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-2)] text-[var(--text-muted)] transition-colors"
                                    >
                                        <MdClose className="text-lg" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <h1 className="text-xl font-bold text-[var(--text-primary)]">{tenant.name}</h1>
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="p-1 rounded-md hover:bg-[var(--bg-surface-2)] text-[var(--text-muted)]
                      hover:text-[var(--text-primary)] transition-colors"
                                    >
                                        <MdEdit className="text-base" />
                                    </button>
                                </div>
                            )}
                            {saveError && <p className="text-xs text-red-500 mt-1">{saveError}</p>}
                            <p className="font-mono text-sm text-[var(--text-muted)] mt-0.5">{tenant.slug}</p>
                        </div>
                    </div>

                    {/* Status + toggle */}
                    <div className="flex items-center gap-3">
                        <StatusBadge isActive={tenant.is_active} />
                        <button
                            onClick={handleToggleTenantActive}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                                tenant.is_active
                                    ? "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                                    : "border-green-200 text-green-600 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-900/20"
                            }`}
                        >
                            {tenant.is_active ? "Deactivate tenant" : "Activate tenant"}
                        </button>
                    </div>
                </div>

                {/* Meta grid */}
                <div className="mt-4 pt-4 border-t border-[var(--border-color)] grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                        <p className="text-xs text-[var(--text-muted)] mb-0.5">Registered</p>
                        <p className="text-[var(--text-primary)]">{new Date(tenant.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                        <p className="text-xs text-[var(--text-muted)] mb-0.5">Users</p>
                        <p className="text-[var(--text-primary)]">{users.length}</p>
                    </div>
                    <div>
                        <p className="text-xs text-[var(--text-muted)] mb-0.5">Slug</p>
                        <p className="font-mono text-[var(--text-primary)]">{tenant.slug}</p>
                    </div>
                </div>
            </div>

            {/* ── Users section ────────────────────────────────── */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
                    <div>
                        <h2 className="font-semibold text-[var(--text-primary)]">Users</h2>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">Provisioned directly by platform admin — no tenant login required.</p>
                    </div>
                    <button
                        onClick={() => setModal({ type: "addUser" })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700
              text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <MdPersonAdd className="text-base" />
                        Add user
                    </button>
                </div>

                {users.length === 0 ? (
                    <div className="text-center py-12 text-[var(--text-muted)] text-sm">
                        No users yet.{" "}
                        <button onClick={() => setModal({ type: "addUser" })} className="text-blue-600 hover:text-blue-700 font-medium transition-colors">
                            Add the first one.
                        </button>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-[var(--bg-surface-2)] border-b border-[var(--border-color)]">
                                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Name</th>
                                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Email</th>
                                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Role</th>
                                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Status</th>
                                <th className="px-5 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-color)]">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-[var(--bg-surface-2)] transition-colors">
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center
                        text-white text-xs font-semibold shrink-0"
                                            >
                                                {user.full_name?.[0]?.toUpperCase() ?? "U"}
                                            </div>
                                            <span className="font-medium text-[var(--text-primary)]">{user.full_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 text-[var(--text-secondary)]">{user.email}</td>
                                    <td className="px-5 py-3">
                                        <span
                                            className="text-xs font-medium capitalize px-2 py-0.5 rounded-full
                      bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                        >
                                            {user.role?.replace("_", " ")}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3">
                                        <StatusBadge isActive={user.is_active ?? true} />
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <UserActionsMenu
                                            tenantId={id}
                                            user={user}
                                            onResetPassword={(u) => setModal({ type: "resetPass", user: u })}
                                            onToggleStatus={handleToggleUserStatus}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modals */}
            {modal?.type === "addUser" && (
                <AddUserModal
                    tenantId={id}
                    onClose={() => setModal(null)}
                    onAdded={() => {
                        setModal(null);
                        loadUsers();
                    }}
                />
            )}
            {modal?.type === "resetPass" && <ResetPasswordModal tenantId={id} user={modal.user} onClose={() => setModal(null)} />}
        </div>
    );
}
