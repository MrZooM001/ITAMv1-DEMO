import { useState, useEffect } from "react";
import Modal from "../../../components/ui/Modal";
import { useCreateEmployee, useUpdateEmployee } from "../hooks/useEmployees";
import { useDepartments } from "../../departments/hooks/useDepartments";

export default function EmployeeForm({ open, onClose, employee = null, defaultDepartmentId = null }) {
  const isEdit = !!employee;
  const { data: departments } = useDepartments();

  const [form, setForm] = useState({
    full_name: "", email: "", phone: "",
    job_title: "", department_id: defaultDepartmentId ?? "", is_active: true,
  });
  const [error, setError] = useState(null);

  const create = useCreateEmployee();
  const update = useUpdateEmployee(employee?.id);

  useEffect(() => {
    if (employee) {
      setForm({
        full_name:     employee.full_name     ?? "",
        email:         employee.email         ?? "",
        phone:         employee.phone         ?? "",
        job_title:     employee.job_title     ?? "",
        department_id: employee.department_id ?? defaultDepartmentId ?? "",
        is_active:     employee.is_active     ?? true,
      });
    } else {
      setForm({
        full_name: "", email: "", phone: "",
        job_title: "", department_id: defaultDepartmentId ?? "", is_active: true,
      });
    }
    setError(null);
  }, [employee, open, defaultDepartmentId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const payload = {
      ...form,
      department_id: form.department_id || null,
      email:         form.email || null,
      phone:         form.phone || null,
      job_title:     form.job_title || null,
    };
    try {
      if (isEdit) await update.mutateAsync(payload);
      else        await create.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  const loading = create.isPending || update.isPending;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Employee" : "Add Employee"} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Full name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Full name <span className="text-red-400">*</span>
          </label>
          <input
            required value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder="e.g. Ahmed Mohamed"
            className="input-field"
          />
        </div>

        {/* Email + Phone */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@company.com"
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+20 1xx xxx xxxx"
              className="input-field"
            />
          </div>
        </div>

        {/* Job title + Department */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Job title</label>
            <input
              value={form.job_title}
              onChange={(e) => setForm({ ...form, job_title: e.target.value })}
              placeholder="e.g. IT Technician"
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
            <select
              value={form.department_id}
              onChange={(e) => setForm({ ...form, department_id: e.target.value })}
              className="input-field"
            >
              <option value="">— No department —</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Active toggle (edit only) */}
        {isEdit && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm({ ...form, is_active: !form.is_active })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                ${form.is_active ? "bg-blue-600" : "bg-gray-300"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                ${form.is_active ? "translate-x-6" : "translate-x-1"}`} />
            </button>
            <span className="text-sm text-gray-600">
              {form.is_active ? "Active employee" : "Inactive employee"}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700
              disabled:bg-blue-400 text-white rounded-lg transition-colors">
            {loading ? "Saving..." : isEdit ? "Save changes" : "Add employee"}
          </button>
        </div>
      </form>
    </Modal>
  );
}