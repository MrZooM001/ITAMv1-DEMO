const STATUS_CFG = {
  open:        { label: "Open",        cls: "bg-blue-50 text-blue-600" },
  in_progress: { label: "In Progress", cls: "bg-amber-50 text-amber-700" },
  resolved:    { label: "Resolved",    cls: "bg-green-50 text-green-700" },
  closed:      { label: "Closed",      cls: "bg-gray-100 text-gray-500" },
  cancelled:   { label: "Cancelled",   cls: "bg-red-50 text-red-500" },
};

const PRIORITY_CFG = {
  critical: { label: "Critical", cls: "bg-red-100 text-red-700" },
  high:     { label: "High",     cls: "bg-orange-100 text-orange-700" },
  medium:   { label: "Medium",   cls: "bg-yellow-100 text-yellow-700" },
  low:      { label: "Low",      cls: "bg-gray-100 text-gray-500" },
};

export function TicketStatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? { label: status, cls: "bg-gray-100 text-gray-500" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {cfg.label}
    </span>
  );
}

export function TicketPriorityBadge({ priority }) {
  const cfg = PRIORITY_CFG[priority] ?? { label: priority, cls: "bg-gray-100 text-gray-500" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}