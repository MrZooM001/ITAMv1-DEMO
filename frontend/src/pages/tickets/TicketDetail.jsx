import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  useTicket,
  useUpdateTicketStatus,
  useAddTicketUpdate,
  useAssignTicket,
} from "../../features/tickets/hooks/useTickets";
import { useUpdateDeviceStatus } from "../../features/devices/hooks/useDevices";
import { useUsers } from "../../features/users/hooks/useUsers";
import {
  TicketStatusBadge,
  TicketPriorityBadge,
} from "../../features/tickets/components/TicketStatusBadge";
import TicketForm from "../../features/tickets/components/TicketForm";
import Modal from "../../components/ui/Modal";
import {
  MdArrowBack, MdPerson, MdDevices, MdCalendarToday,
  MdSend, MdSwapHoriz, MdAssignment, MdEdit,
  MdCheckCircle, MdCancel, MdTimeline,
} from "react-icons/md";

// ── helpers ───────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Status workflow ───────────────────────────────────────
const ALLOWED_TRANSITIONS = {
  open:        ["in_progress", "cancelled"],
  in_progress: ["resolved",    "cancelled"],
  resolved:    ["closed"],
  closed:      [],
  cancelled:   [],
};

const STATUS_META = {
  open:        { label: "Open",        dot: "bg-blue-500",  icon: MdTimeline   },
  in_progress: { label: "In Progress", dot: "bg-amber-500", icon: MdTimeline   },
  resolved:    { label: "Resolved",    dot: "bg-green-500", icon: MdCheckCircle },
  closed:      { label: "Closed",      dot: "bg-gray-400",  icon: MdCheckCircle },
  cancelled:   { label: "Cancelled",   dot: "bg-red-400",   icon: MdCancel     },
};

// ── Ticket → Device status mapping ────────────────────────
const TICKET_TO_DEVICE_STATUS = {
  open:        "in_maintenance",
  in_progress: "in_maintenance",
  resolved:    "in_maintenance",
  cancelled:   "active",
};

const CLOSED_RESOLUTIONS = [
  { value: "fixed",          label: "Fixed",            deviceStatus: "active"  },
  { value: "replaced",       label: "Replaced",         deviceStatus: "active"  },
  { value: "not_repairable", label: "Not Repairable",   deviceStatus: "retired" },
  { value: "no_issue",       label: "No Issue Found",   deviceStatus: "active"  },
];

// ── Info row ──────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <Icon className="text-gray-400 text-base shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-800">{value || "—"}</p>
      </div>
    </div>
  );
}

// ── Timeline entry ────────────────────────────────────────
function TimelineEntry({ update }) {
  const hasStatusChange = update.old_status || update.new_status;
  const ts = update.created_at;
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10
          ${hasStatusChange ? "bg-blue-100" : "bg-gray-100"}`}>
          <MdTimeline className={`text-xs ${hasStatusChange ? "text-blue-500" : "text-gray-400"}`} />
        </div>
        <div className="w-px flex-1 bg-gray-100 mt-1" />
      </div>
      <div className="flex-1 pb-4 min-w-0">
        <p className="text-xs text-gray-400 mb-1.5">{fmtDate(ts)}</p>
        {hasStatusChange && (
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {update.old_status && <TicketStatusBadge status={update.old_status} />}
            <span className="text-xs text-gray-400">→</span>
            {update.new_status && <TicketStatusBadge status={update.new_status} />}
          </div>
        )}
        <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
          {update.note}
        </p>
      </div>
    </div>
  );
}

// ── Change status modal ───────────────────────────────────
// FIX: was sending { status: selected } — backend now expects { new_status: selected }
function StatusChangeModal({ open, onClose, ticket, deviceId }) {
  const updateStatus      = useUpdateTicketStatus(ticket?.id);
  const updateDeviceStatus = useUpdateDeviceStatus(deviceId);
  const allowed = ALLOWED_TRANSITIONS[ticket?.status] ?? [];

  const [selected,   setSelected]   = useState("");
  const [resolution, setResolution] = useState("fixed");
  const [note,       setNote]       = useState("");
  const [error,      setError]      = useState(null);

  useEffect(() => {
    if (open) {
      setSelected(allowed[0] ?? "");
      setNote("");
      setError(null);
      setResolution("fixed");
    }
  }, [open]);

  async function handleSave() {
    if (!selected) return;
    if (selected === "cancelled" && !note.trim()) {
      setError("A note is required when cancelling a ticket.");
      return;
    }
    setError(null);
    try {
      // FIX: send new_status (not status) to match fixed backend schema
      await updateStatus.mutateAsync({ new_status: selected, note: note.trim() || undefined });

      if (deviceId) {
        let newDeviceStatus;
        if (selected === "closed") {
          const res = CLOSED_RESOLUTIONS.find((r) => r.value === resolution);
          newDeviceStatus = res?.deviceStatus ?? "active";
        } else {
          newDeviceStatus = TICKET_TO_DEVICE_STATUS[selected];
        }
        if (newDeviceStatus) {
          await updateDeviceStatus.mutateAsync(newDeviceStatus);
        }
      }

      setNote("");
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  const loading = updateStatus.isPending || updateDeviceStatus.isPending;
  if (!allowed.length) return null;

  return (
    <Modal open={open} onClose={onClose} title="Change Status" size="sm">
      <div className="space-y-4">
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="space-y-2">
          {allowed.map((s) => {
            const meta = STATUS_META[s] ?? { label: s, dot: "bg-gray-400", icon: MdTimeline };
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSelected(s)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all
                  ${selected === s ? "border-blue-500 bg-blue-50" : "border-gray-100 hover:border-gray-200 bg-white"}`}
              >
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dot}`} />
                <span className="text-sm font-medium text-gray-700">{meta.label}</span>
                {selected === s && <MdCheckCircle className="ml-auto text-blue-500 text-lg" />}
              </button>
            );
          })}
        </div>

        {selected === "closed" && (
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Resolution{" "}
              <span className="text-gray-400 normal-case font-normal">(affects device status)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CLOSED_RESOLUTIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setResolution(r.value)}
                  className={`flex flex-col px-3 py-2.5 rounded-xl border-2 text-left transition-all
                    ${resolution === r.value ? "border-blue-500 bg-blue-50" : "border-gray-100 hover:border-gray-200"}`}
                >
                  <span className="text-xs font-semibold text-gray-700">{r.label}</span>
                  <span className={`text-xs mt-0.5 font-mono
                    ${r.deviceStatus === "retired" ? "text-red-400" : "text-green-500"}`}>
                    → Device: {r.deviceStatus}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {selected && selected !== "closed" && deviceId && (
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
            <span className="text-xs text-gray-400">Device will be set to:</span>
            <span className={`text-xs font-semibold
              ${TICKET_TO_DEVICE_STATUS[selected] === "in_maintenance"
                ? "text-amber-600"
                : TICKET_TO_DEVICE_STATUS[selected] === "retired"
                  ? "text-red-500"
                  : "text-green-600"}`}>
              {TICKET_TO_DEVICE_STATUS[selected]}
            </span>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Note {selected === "cancelled" && <span className="text-red-400">* required</span>}
          </label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={selected === "cancelled" ? "Cancellation reason is required..." : "Optional note..."}
            className="input-field resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || !selected}
            className="flex-1 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700
              disabled:bg-blue-400 text-white rounded-lg transition-colors"
          >
            {loading ? "Saving..." : "Apply"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Assign modal ──────────────────────────────────────────
function AssignModal({ open, onClose, ticketId }) {
  const assign = useAssignTicket(ticketId);
  const { data: users = [] } = useUsers();
  const [selected, setSelected] = useState("");
  const [error,    setError]    = useState(null);

  useEffect(() => {
    if (open) { setSelected(""); setError(null); }
  }, [open]);

  const activeUsers = users.filter((u) => u.is_active);

  async function handleSave() {
    if (!selected) return;
    setError(null);
    try {
      await assign.mutateAsync({ assigned_to: selected });
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Assign Ticket" size="sm">
      <div className="space-y-4">
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Assign to (System User)
          </label>
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className="input-field">
            <option value="">— Select user —</option>
            {activeUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.role?.replace("_", " ")})
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">Only system users can be assigned to tickets.</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={assign.isPending || !selected}
            className="flex-1 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700
              disabled:bg-blue-400 text-white rounded-lg transition-colors"
          >
            {assign.isPending ? "Assigning..." : "Assign"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Add note panel ────────────────────────────────────────
function AddNotePanel({ ticketId, disabled }) {
  const addUpdate = useAddTicketUpdate(ticketId);
  const [note,  setNote]  = useState("");
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!note.trim()) return;
    setError(null);
    try {
      await addUpdate.mutateAsync({ note: note.trim() });
      setNote("");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Add Note</h3>
      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={disabled}
          placeholder={disabled ? "Ticket is closed — no new notes" : "Write a note or update..."}
          className="input-field flex-1 disabled:bg-gray-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={addUpdate.isPending || !note.trim() || disabled}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
            text-white rounded-lg transition-colors shrink-0 flex items-center gap-1.5 text-sm font-medium"
        >
          <MdSend className="text-base" />
          {addUpdate.isPending ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: ticket, isLoading, isError } = useTicket(id);
  // FIX: removed useDevices() and useEmployees() — the enriched TicketDetailResponse
  // already includes device_name, department_name, assigned_to_name from the backend.
  // useUsers() is still needed to populate the Assign modal dropdown.
  const { data: users = [] } = useUsers();

  const [statusOpen, setStatusOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen,   setEditOpen]   = useState(false);

  if (isLoading)
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  if (isError || !ticket)
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <p className="text-gray-500">Ticket not found.</p>
        <button onClick={() => navigate("/tickets")} className="text-sm text-blue-600 hover:underline">
          ← Back
        </button>
      </div>
    );

  // FIX: use pre-resolved name fields from TicketDetailResponse instead of
  // client-side lookup across useDevices() / useEmployees() arrays.
  const isClosed  = ticket.status === "closed" || ticket.status === "cancelled";
  const canChange = (ALLOWED_TRANSITIONS[ticket.status] ?? []).length > 0;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link to="/tickets" className="hover:text-gray-600 transition-colors">Tickets</Link>
        <span>/</span>
        <span className="text-gray-700 font-mono">{ticket.ticket_number}</span>
      </div>

      {/* ── Header ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <button
              onClick={() => navigate("/tickets")}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors shrink-0 mt-0.5"
            >
              <MdArrowBack className="text-lg" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap mb-1">
                <span className="font-mono text-xs text-gray-400">{ticket.ticket_number}</span>
                <TicketStatusBadge status={ticket.status} />
                <TicketPriorityBadge priority={ticket.priority} />
              </div>
              <h1 className="text-lg font-bold text-gray-900">{ticket.title}</h1>
              {ticket.description && (
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">{ticket.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {!isClosed && (
              <button
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200
                  rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
              >
                <MdEdit className="text-base" /> Edit
              </button>
            )}
            {canChange && (
              <button
                onClick={() => setStatusOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200
                  rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
              >
                <MdSwapHoriz className="text-base" /> Change Status
              </button>
            )}
            <button
              onClick={() => setAssignOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600
                hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <MdAssignment className="text-base" /> Assign
            </button>
          </div>
        </div>
      </div>

      {/* ── Two column ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: timeline + add note */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Activity Timeline</h3>
            {ticket.updates?.length ? (
              <div>
                {[...ticket.updates].reverse().map((u) => (
                  <TimelineEntry key={u.id} update={u} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">No activity yet.</p>
            )}
          </div>
          <AddNotePanel ticketId={id} disabled={isClosed} />
        </div>

        {/* Right: ticket info — using enriched name fields from API */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Ticket Info</h3>
            <InfoRow icon={MdPerson}   label="Reported by" value={ticket.reported_by ? "Employee" : null} />
            <InfoRow
              icon={MdAssignment}
              label="Assigned to"
              // FIX: use pre-resolved assigned_to_name from TicketDetailResponse
              value={ticket.assigned_to_name ?? null}
            />

            {/* Device — clickable link using enriched device_name */}
            <div className="flex items-start gap-3 py-2.5 border-b border-gray-50">
              <MdDevices className="text-gray-400 text-base shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs text-gray-400">Device</p>
                {ticket.device_id ? (
                  <button
                    onClick={() => navigate(`/devices/${ticket.device_id}`)}
                    className="text-sm font-medium text-blue-600 hover:underline text-left"
                  >
                    {/* FIX: use pre-resolved device_name from TicketDetailResponse */}
                    {ticket.device_name ?? ticket.device_id}
                  </button>
                ) : (
                  <p className="text-sm font-medium text-gray-800">—</p>
                )}
              </div>
            </div>

            {/* Department — from enriched response */}
            {ticket.department_name && (
              <InfoRow icon={MdDevices} label="Department" value={ticket.department_name} />
            )}

            <InfoRow icon={MdCalendarToday} label="Opened"   value={fmtDate(ticket.created_at)}  />
            <InfoRow icon={MdCalendarToday} label="Resolved" value={fmtDate(ticket.resolved_at)} />
          </div>
        </div>
      </div>

      {/* Modals */}
      <StatusChangeModal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        ticket={ticket}
        deviceId={ticket.device_id}
      />
      <AssignModal open={assignOpen} onClose={() => setAssignOpen(false)} ticketId={id} />
      <TicketForm open={editOpen} onClose={() => setEditOpen(false)} ticket={ticket} />
    </div>
  );
}
