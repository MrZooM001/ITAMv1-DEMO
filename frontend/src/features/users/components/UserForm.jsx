import { useState, useEffect } from "react";
import Modal from "../../../components/ui/Modal";
import { useCreateUser, useUpdateUser, useUpdateUserStatus } from "../hooks/useUsers";
import { useAuthStore } from "../../../store/auth.store";
import { MdVisibility, MdVisibilityOff } from "react-icons/md";

const ROLES = [
  { value: "viewer",      label: "Viewer",      desc: "Read-only access" },
  { value: "technician",  label: "Technician",  desc: "Can manage devices & tickets" },
  { value: "admin",       label: "Admin",        desc: "Full access except super admin features" },
  { value: "super_admin", label: "Super Admin",  desc: "Full system access" },
];

export default function UserForm({ open, onClose, user = null }) {
  const isEdit  = !!user;
  const current = useAuthStore((s) => s.user);
  const isSuperAdmin = current?.role === "super_admin";

  const create        = useCreateUser();
  const update        = useUpdateUser(user?.id);
  const updateStatus  = useUpdateUserStatus(user?.id);

  const [form, setForm] = useState({
    full_name: "", email: "", password: "", role: "viewer", is_active: true,
  });
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setShowPass(false);
    if (user) {
      setForm({ full_name: user.full_name ?? "", email: user.email ?? "", password: "", role: user.role ?? "viewer", is_active: user.is_active ?? true });
    } else {
      setForm({ full_name: "", email: "", password: "", role: "viewer", is_active: true });
    }
  }, [user, open]);

  function set(field) { return (e) => setForm((f) => ({ ...f, [field]: e.target.value })); }

  // Available roles — super_admin only visible to super_admin
  const availableRoles = ROLES.filter((r) => r.value !== "super_admin" || isSuperAdmin);

  const isSuperAdminTarget = user?.role === "super_admin";
  const loading = create.isPending || update.isPending || updateStatus.isPending;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      if (isEdit) {
        await update.mutateAsync({ full_name: form.full_name, email: form.email });
        // Update status if changed and user is not super_admin
        if (!isSuperAdminTarget && form.is_active !== user.is_active) {
          await updateStatus.mutateAsync({ is_active: form.is_active });
        }
      } else {
        await create.mutateAsync({
          full_name: form.full_name,
          email:     form.email,
          password:  form.password,
          role:      form.role,
        });
      }
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit User" : "Add User"} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
        )}

        {/* Full name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Full name <span className="text-red-400">*</span>
          </label>
          <input required value={form.full_name} onChange={set("full_name")}
            placeholder="e.g. Ahmed Mohamed" className="input-field" />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Email <span className="text-red-400">*</span>
          </label>
          <input required type="email" value={form.email} onChange={set("email")}
            placeholder="user@company.com" className="input-field" />
        </div>

        {/* Password — create only */}
        {!isEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Password <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                required
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={set("password")}
                placeholder="Min. 6 characters"
                minLength={6}
                className="input-field pr-10"
              />
              <button type="button" onClick={() => setShowPass((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPass ? <MdVisibilityOff className="text-lg" /> : <MdVisibility className="text-lg" />}
              </button>
            </div>
          </div>
        )}

        {/* Role — create only (edit role is separate endpoint) */}
        {!isEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <div className="space-y-2">
              {availableRoles.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, role: r.value }))}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all
                    ${form.role === r.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-100 hover:border-gray-200 bg-white"}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{r.label}</p>
                    <p className="text-xs text-gray-400">{r.desc}</p>
                  </div>
                  {form.role === r.value && (
                    <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Status toggle — shown in edit mode, hidden for super_admin target */}
        {isEdit && !isSuperAdminTarget && (
          <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl">
            <div>
              <p className="text-sm font-medium text-gray-700">Account Status</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {form.is_active ? "User can log in and use the system" : "User is blocked from logging in"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0
                ${form.is_active ? "bg-blue-600" : "bg-gray-300"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                ${form.is_active ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700
              disabled:bg-blue-400 text-white rounded-lg transition-colors">
            {loading ? "Saving..." : isEdit ? "Save changes" : "Add user"}
          </button>
        </div>
      </form>
    </Modal>
  );
}