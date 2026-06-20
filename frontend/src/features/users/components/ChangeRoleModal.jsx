import { useState, useEffect } from "react";
import Modal from "../../../components/ui/Modal";
import { useUpdateUserRole } from "../hooks/useUsers";
import { useAuthStore } from "../../../store/auth.store";
import { MdCheckCircle } from "react-icons/md";

const ROLES = [
  { value: "viewer",      label: "Viewer",      desc: "Read-only access",                        color: "text-gray-500"   },
  { value: "technician",  label: "Technician",  desc: "Can manage devices & tickets",            color: "text-blue-600"   },
  { value: "admin",       label: "Admin",       desc: "Full access except super admin features", color: "text-purple-600" },
  { value: "super_admin", label: "Super Admin", desc: "Full system access",                      color: "text-red-600"    },
];

export default function ChangeRoleModal({ open, onClose, user }) {
  const current     = useAuthStore((s) => s.user);
  const isSuperAdmin = current?.role === "super_admin";
  const updateRole  = useUpdateUserRole(user?.id);

  const [selected, setSelected] = useState(user?.role ?? "viewer");
  const [error,    setError]    = useState(null);

  // FIX: was useState(() => {...}) which only runs once on mount.
  // useEffect with [open, user] correctly resets state every time
  // the modal opens for a (potentially different) user.
  useEffect(() => {
    if (open) {
      setSelected(user?.role ?? "viewer");
      setError(null);
    }
  }, [open, user]);

  const availableRoles = ROLES.filter((r) => r.value !== "super_admin" || isSuperAdmin);

  async function handleSave() {
    if (selected === user?.role) { onClose(); return; }
    setError(null);
    try {
      await updateRole.mutateAsync({ role: selected });
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Change Role — ${user?.full_name}`} size="sm">
      <div className="space-y-3">
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {availableRoles.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setSelected(r.value)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all
              ${selected === r.value
                ? "border-blue-500 bg-blue-50"
                : "border-gray-100 hover:border-gray-200 bg-white"}`}
          >
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${r.color}`}>{r.label}</p>
              <p className="text-xs text-gray-400">{r.desc}</p>
            </div>
            {selected === r.value && (
              <MdCheckCircle className="text-blue-500 text-lg shrink-0" />
            )}
          </button>
        ))}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={updateRole.isPending}
            className="flex-1 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700
              disabled:bg-blue-400 text-white rounded-lg transition-colors"
          >
            {updateRole.isPending ? "Saving..." : "Save role"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
