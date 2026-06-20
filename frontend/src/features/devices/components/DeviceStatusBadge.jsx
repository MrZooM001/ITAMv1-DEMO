const STATUS_CONFIG = {
  active:         { label: "Active",         classes: "bg-green-100 text-green-700" },
  in_maintenance: { label: "In Maintenance", classes: "bg-amber-100 text-amber-700" },
  retired:        { label: "Retired",        classes: "bg-gray-100  text-gray-600"  },
};

export default function DeviceStatusBadge({ status, size = "sm" }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, classes: "bg-gray-100 text-gray-600" };
  const sizeClass = size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs";

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-full ${sizeClass} ${cfg.classes}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {cfg.label}
    </span>
  );
}