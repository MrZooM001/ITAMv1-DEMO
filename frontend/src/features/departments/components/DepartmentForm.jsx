import { useState, useEffect } from "react";
import Modal from "../../../components/ui/Modal";
import { useCreateDepartment, useUpdateDepartment } from "../hooks/useDepartments";

export default function DepartmentForm({ open, onClose, department = null }) {
  const isEdit = !!department;
  const [form, setForm]   = useState({ name: "", notes: "" });
  const [error, setError] = useState(null);

  const create = useCreateDepartment();
  const update = useUpdateDepartment(department?.id);

  useEffect(() => {
    if (department) setForm({ name: department.name ?? "", notes: department.notes ?? "" });
    else            setForm({ name: "", notes: "" });
    setError(null);
  }, [department, open]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      if (isEdit) await update.mutateAsync(form);
      else        await create.mutateAsync(form);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  const loading = create.isPending || update.isPending;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Department" : "Add Department"} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Department name <span className="text-red-400">*</span>
          </label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Information Technology"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Optional notes..."
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-none
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700
              disabled:bg-blue-400 text-white rounded-lg transition-colors">
            {loading ? "Saving..." : isEdit ? "Save changes" : "Add department"}
          </button>
        </div>
      </form>
    </Modal>
  );
}