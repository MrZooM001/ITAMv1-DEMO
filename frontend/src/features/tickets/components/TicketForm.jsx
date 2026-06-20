import { useState, useEffect } from "react";
import Modal from "../../../components/ui/Modal";
import { useCreateTicket, useAddTicketUpdate, useAssignTicket, useUpdateTicket } from "../hooks/useTickets";
import { useDevices }   from "../../devices/hooks/useDevices";
import { useEmployees } from "../../employees/hooks/useEmployees";
import { useUsers }     from "../../users/hooks/useUsers";

const PRIORITIES = ["low", "medium", "high", "critical"];

// ── Create mode: full form ──────────────────────────────────
function CreateForm({ onClose, defaultDeviceId }) {
  const create = useCreateTicket();
  const { data: devices   = [] } = useDevices();
  const { data: employees = [] } = useEmployees();
  const { data: users     = [] } = useUsers();

  const activeDevices = devices.filter((d) => d.status !== "retired");
  const activeUsers   = users.filter((u) => u.is_active);

  const [form, setForm] = useState({
    title: "", description: "",
    device_id: defaultDeviceId ?? "",
    reported_by: "", assigned_to: "",
    priority: "medium",
  });
  const [error, setError] = useState(null);

  function set(field) { return (e) => setForm((f) => ({ ...f, [field]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const payload = {
      ...form,
      device_id:   form.device_id   || null,
      reported_by: form.reported_by || null,
      assigned_to: form.assigned_to || null,
    };
    try {
      await create.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Title <span className="text-red-400">*</span>
        </label>
        <input required value={form.title} onChange={set("title")}
          placeholder="e.g. Printer not responding" className="input-field" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
        <textarea rows={3} value={form.description} onChange={set("description")}
          placeholder="Describe the issue in detail..." className="input-field resize-none" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Device</label>
          <select value={form.device_id} onChange={set("device_id")} className="input-field">
            <option value="">— No device —</option>
            {activeDevices.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
          <select value={form.priority} onChange={set("priority")} className="input-field">
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Reported by
            <span className="text-xs text-gray-400 font-normal ml-1">(employee)</span>
          </label>
          <select value={form.reported_by} onChange={set("reported_by")} className="input-field">
            <option value="">— Select employee —</option>
            {employees.filter((e) => e.is_active).map((e) => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Assign to
            <span className="text-xs text-gray-400 font-normal ml-1">(system user)</span>
          </label>
          <select value={form.assigned_to} onChange={set("assigned_to")} className="input-field">
            <option value="">— Unassigned —</option>
            {activeUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.role?.replace("_", " ")})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={create.isPending}
          className="flex-1 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700
            disabled:bg-blue-400 text-white rounded-lg transition-colors">
          {create.isPending ? "Opening..." : "Open ticket"}
        </button>
      </div>
    </form>
  );
}

// ── Edit mode: full edit via PUT /tickets/:id ─────────────
function EditForm({ ticket, onClose }) {
  const updateTicket = useUpdateTicket(ticket.id);
  const { data: devices   = [] } = useDevices();
  const { data: users     = [] } = useUsers();

  const activeDevices = devices.filter((d) => d.status !== "retired");
  const activeUsers   = users.filter((u) => u.is_active);

  const [form, setForm] = useState({
    title:       ticket.title       ?? "",
    description: ticket.description ?? "",
    priority:    ticket.priority    ?? "medium",
    device_id:   ticket.device_id   ?? "",
    assigned_to: ticket.assigned_to ?? "",
  });
  const [error, setError] = useState(null);

  function set(field) { return (e) => setForm((f) => ({ ...f, [field]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const payload = {
      title:       form.title       || undefined,
      description: form.description || undefined,
      priority:    form.priority    || undefined,
      device_id:   form.device_id   || null,
      assigned_to: form.assigned_to || null,
    };
    try {
      await updateTicket.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
      )}

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Title <span className="text-red-400">*</span>
        </label>
        <input required value={form.title} onChange={set("title")}
          placeholder="e.g. Printer not responding" className="input-field" />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
        <textarea rows={3} value={form.description} onChange={set("description")}
          placeholder="Describe the issue..." className="input-field resize-none" />
      </div>

      {/* Priority + Device */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
          <select value={form.priority} onChange={set("priority")} className="input-field">
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Device</label>
          <select value={form.device_id} onChange={set("device_id")} className="input-field">
            <option value="">— No device —</option>
            {activeDevices.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Assign to (system user) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Assign to
          <span className="text-xs text-gray-400 font-normal ml-1">(system user)</span>
        </label>
        <select value={form.assigned_to} onChange={set("assigned_to")} className="input-field">
          <option value="">— Unassigned —</option>
          {activeUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name} ({u.role?.replace("_", " ")})
            </option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={updateTicket.isPending}
          className="flex-1 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700
            disabled:bg-blue-400 text-white rounded-lg transition-colors">
          {updateTicket.isPending ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}

// ── Wrapper ────────────────────────────────────────────────
export default function TicketForm({ open, onClose, ticket = null, defaultDeviceId = null }) {
  const isEdit = !!ticket;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Ticket — ${ticket?.ticket_number}` : "Open New Ticket"}
      size="md"
    >
      {isEdit
        ? <EditForm   ticket={ticket} onClose={onClose} />
        : <CreateForm onClose={onClose} defaultDeviceId={defaultDeviceId} />
      }
    </Modal>
  );
}