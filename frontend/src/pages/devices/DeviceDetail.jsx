import { useState, Fragment } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useDevice, useDeleteDevice, useDeviceModels, useDeviceHardware } from "../../features/devices/hooks/useDevices";
import { useEmployees } from "../../features/employees/hooks/useEmployees";
import { useDepartments } from "../../features/departments/hooks/useDepartments";
import DeviceStatusBadge from "../../features/devices/components/DeviceStatusBadge";
import DeviceForm from "../../features/devices/components/DeviceForm";
import DeviceStatusModal from "../../features/devices/components/DeviceStatusModal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import TicketForm from "../../features/tickets/components/TicketForm";
import { MdArrowBack, MdEdit, MdDelete, MdAdd, MdMoreVert, MdPerson, MdBusiness, MdShield, MdConfirmationNumber, MdComputer, MdSwapHoriz } from "react-icons/md";

// ── helpers ───────────────────────────────────────────────
function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function mb(val) {
    if (!val) return "—";
    const gb = val / 1024;
    const tb = gb / 1024;
    if (tb >= 1) return `${tb.toFixed(1)} TB`;
    if (gb >= 1) return `${gb.toFixed(0)} GB`;
    return `${val} MB`;
}

function daysLeft(d) {
    if (!d) return null;
    return Math.ceil((new Date(d) - new Date()) / 86400000);
}

// ── Info Card ─────────────────────────────────────────────
function InfoCard({ icon: Icon, iconBg, label, value, sub, subColor }) {
    return (
        <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-start gap-3 shadow-sm min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                <Icon className="text-white text-base" />
            </div>
            <div className="min-w-0">
                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-gray-800 truncate">{value || "—"}</p>
                {sub && <p className={`text-xs mt-0.5 ${subColor ?? "text-gray-400"}`}>{sub}</p>}
            </div>
        </div>
    );
}

// ── Spec Table ────────────────────────────────────────────
function SpecRow({ label, value, mono }) {
    return (
        <tr className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors">
            <td className="py-2.5 px-4 text-xs text-gray-400 font-medium whitespace-nowrap w-48">{label}</td>
            <td colSpan={5} className={`py-2.5 px-4 text-sm text-gray-800 ${mono ? "font-mono text-xs" : ""}`}>
                {value ?? "—"}
            </td>
        </tr>
    );
}

function SpecGroup({ title, colorClass, children }) {
    return (
        <Fragment key={children.id}>
            <tr>
                <td colSpan={6} className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-opacity-5">
                    <span className={colorClass}>{title}</span>
                </td>
            </tr>
            {children}
        </Fragment>
    );
}

function SpecsTable({ device, hw, employees, departments }) {
    const emp = employees?.find((e) => e.id === device.employee_id);
    const dept = departments?.find((d) => d.id === device.department_id);

    const days = daysLeft(device.warranty_expiry);
    const warrantyStr = days === null ? "—" : days < 0 ? `Expired ${Math.abs(days)}d ago` : days <= 30 ? `Expires in ${days}d ⚠` : fmtDate(device.warranty_expiry);

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full">
                <colgroup>
                    <col className="w-48" />
                    <col />
                    <col className="w-24" />
                    <col className="w-24" />
                    <col className="w-24" />
                    <col className="w-32" />
                </colgroup>
                <tbody>
                    {/* ── Device ──────────────────────────────────── */}
                    <SpecGroup title="Device" colorClass="text-blue-600">
                        <SpecRow label="Name" value={device.name} />
                        <SpecRow label="Serial number" value={device.serial_number} mono />
                        <SpecRow label="Status" value={<DeviceStatusBadge status={device.status} />} />
                        <SpecRow label="Purchase date" value={fmtDate(device.purchase_date)} />
                        <SpecRow label="Purchase price" value={device.purchase_price ? `$${device.purchase_price}` : "—"} />
                        <SpecRow label="Warranty" value={warrantyStr} />
                        <SpecRow label="Notes" value={device.notes} />
                    </SpecGroup>

                    {/* ── Assignment ──────────────────────────────── */}
                    <SpecGroup title="Assignment" colorClass="text-purple-600">
                        <SpecRow label="Department" value={dept?.name} />
                        <SpecRow label="Employee" value={emp?.full_name} />
                        <SpecRow label="Job title" value={emp?.job_title} />
                    </SpecGroup>

                    {/* ── OS ──────────────────────────────────────── */}
                    <SpecGroup title="Operating System" colorClass="text-teal-600">
                        <SpecRow label="Name" value={device.operating_system?.name} />
                        <SpecRow label="Architecture" value={device.operating_system?.architecture} />
                        <SpecRow label="Install date" value={fmtDate(device.operating_system?.install_date)} />
                    </SpecGroup>

                    {hw ? (
                        <Fragment key={hw.id}>
                            {/* ── CPU ──────────────────────────────────── */}
                            <SpecGroup title="CPU" colorClass="text-blue-500">
                                {/* CPU */}
                                <SpecRow label="Model" value={hw.cpu_model} />
                                <SpecRow label="Cores" value={hw.cpu_cores ? `${hw.cpu_cores} cores` : null} />
                                <SpecRow label="Threads" value={hw.cpu_threads ? `${hw.cpu_threads} threads` : null} />
                                <SpecRow label="Base speed" value={hw.cpu_speed_mhz ? `${hw.cpu_speed_mhz} MHz` : null} />
                                <SpecRow label="Cache" value={hw.cpu_cache_kb ? `${hw.cpu_cache_kb} KB` : null} />
                            </SpecGroup>

                            {/* ── Motherboard ──────────────────────────── */}
                            <SpecGroup title="Motherboard" colorClass="text-purple-500">
                                <SpecRow label="Manufacturer" value={hw.mb_manufacturer} />
                                <SpecRow label="Model" value={hw.mb_model} />
                                <SpecRow label="BIOS version" value={hw.mb_bios_version} mono />
                                <SpecRow label="BIOS date" value={fmtDate(hw.mb_bios_date)} />
                            </SpecGroup>

                            {/* ── RAM ──────────────────────────────────── */}
                            <SpecGroup title="RAM" colorClass="text-green-600">
                                <SpecRow label="Total" value={mb(hw.ram_total_mb)} />
                                <SpecRow label="Type" value={hw.ram_type} />
                                <SpecRow label="Speed" value={hw.ram_speed_mhz ? `${hw.ram_speed_mhz} MHz` : null} />
                                <SpecRow label="Slots total" value={hw.ram_slots_total} />
                                <SpecRow label="Slots used" value={hw.ram_slots_used} />
                                {/* Slots free: computed from total - used */}
                                <SpecRow label="Slots free" value={hw.ram_slots_total != null && hw.ram_slots_used != null ? hw.ram_slots_total - hw.ram_slots_used : null} />
                                {hw.ram_modules?.map((m, i) => (
                                    <SpecRow
                                        key={i}
                                        label={`Slot ${m.slot}`}
                                        value={[m.manufacturer, m.type, mb(m.size_mb), m.speed_mhz ? `${m.speed_mhz} MHz` : null].filter(Boolean).join(" · ")}
                                    />
                                ))}
                            </SpecGroup>

                            {/* ── Storage ──────────────────────────────── */}
                            <SpecGroup title="Storage Drives" colorClass="text-amber-600">
                                {!hw.storage?.length ? (
                                    <SpecRow label="Disks" value="—" />
                                ) : (
                                    hw.storage.map((disk, di) => (
                                        <Fragment key={`disk-${di}`}>
                                            <tr key={`disk-${di}`} className="bg-neutral-100 border-b border-neutral-200">
                                                <td className="py-2 px-4 text-xs font-semibold text-amber-700 w-44 whitespace-nowrap">
                                                    {disk.type ?? "Disk"} {di + 1}
                                                </td>
                                                <td className="py-2 px-4" colSpan="5">
                                                    <div className="flex items-center gap-4 flex-wrap text-xs">
                                                        <span className="font-bold text-gray-800">{disk.model ?? "Unknown"}</span>
                                                        {disk.manufacturer && <span className="font-medium text-gray-600">{disk.manufacturer}</span>}
                                                        {disk.capacity_mb && <span className="font-medium text-gray-700 font-mono">{mb(disk.capacity_mb)}</span>}
                                                        {disk.interface && <span className="font-medium text-gray-500">{disk.interface}</span>}
                                                        {disk.serial && <span className="font-medium text-gray-500">{disk.serial}</span>}
                                                        {disk.smart_status && (
                                                            <span
                                                                className={`px-2 py-0.5 rounded-full font-medium
                                ${["good", "ok"].includes(disk.smart_status.toLowerCase()) ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}
                                                            >
                                                                {disk.smart_status}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>

                                            {disk.partitions?.length > 0 && (
                                                <Fragment key={`part-hdr-${di}`}>
                                                    <tr key={`part-hdr-${di}`} className="border-b border-gray-50 bg-gray-50/40">
                                                        {["Drive", "File System", "Size", "Used", "Free", "Usage"].map((h) => (
                                                            <td key={h} className="py-1.5 px-4 text-[10px] font-semibold text-gray-400 uppercase tracking-wider first:pl-8">
                                                                {h}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                    {disk.partitions.map((p, pi) => {
                                                        const usedPct = p.size_mb && p.used_mb ? Math.round((p.used_mb / p.size_mb) * 100) : null;
                                                        const barColor = usedPct >= 90 ? "bg-red-400" : usedPct >= 70 ? "bg-amber-400" : "bg-green-400";
                                                        return (
                                                            <tr key={`part-${di}-${pi}`} className="border-b border-gray-50 hover:bg-gray-50/40 transition-colors">
                                                                <td className="py-2 pl-8 pr-4 text-xs font-bold text-gray-700 w-24 whitespace-nowrap">
                                                                    {p.disk_letter ? `${p.disk_letter}` : (p.partition_id ?? "—")}
                                                                </td>
                                                                <td className="py-2 px-4 text-xs text-gray-500">{p.file_system ?? "—"}</td>
                                                                <td className="py-2 px-4 text-xs text-gray-600 font-mono">{mb(p.size_mb)}</td>
                                                                <td className="py-2 px-4 text-xs text-gray-600 font-mono">{mb(p.used_mb)}</td>
                                                                <td className="py-2 px-4 text-xs text-gray-600 font-mono">{mb(p.free_mb)}</td>
                                                                <td className="py-2 px-4 min-w-[120px]">
                                                                    {usedPct !== null ? (
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                                                                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${usedPct}%` }} />
                                                                            </div>
                                                                            <span
                                                                                className={`text-[10px] font-semibold w-8 text-right shrink-0
                                        ${usedPct >= 90 ? "text-red-500" : usedPct >= 70 ? "text-amber-500" : "text-gray-500"}`}
                                                                            >
                                                                                {usedPct}%
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-xs text-gray-400">—</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </Fragment>
                                            )}
                                        </Fragment>
                                    ))
                                )}
                            </SpecGroup>

                            {/* ── GPU ──────────────────────────────────── */}
                            <SpecGroup title="GPU" colorClass="text-red-500">
                                <SpecRow label="Manufacturer" value={hw.gpu_manufacturer} />
                                <SpecRow label="Model" value={hw.gpu_model} />
                                {/* GPU */}
                            </SpecGroup>

                            {/* ── Monitor ──────────────────────────────── */}
                            <SpecGroup title="Monitor" colorClass="text-teal-500">
                                {hw.monitors?.length ? (
                                    hw.monitors.map((m, i) => (
                                        <Fragment key={`${i}a`}>
                                            <SpecRow key={`${i}a`} label={`Monitor ${i + 1}`} value={[m.manufacturer, m.model].filter(Boolean).join(" ")} />
                                            <SpecRow
                                                key={`${i}b`}
                                                label="Resolution"
                                                value={m.resolution ? `${m.resolution}${m.refresh_hz ? ` @ ${m.refresh_hz}Hz` : ""}` : null}
                                            />
                                        </Fragment>
                                    ))
                                ) : (
                                    <SpecRow label="Monitor" value="—" />
                                )}
                            </SpecGroup>

                            {/* ── Network ──────────────────────────────── */}
                            <SpecGroup title="Network" colorClass="text-indigo-500">
                                <SpecRow label="ETH adapter" value={hw.eth_adapter} />
                                <SpecRow label="ETH MAC" value={hw.eth_mac} mono />
                                {hw.eth_connections?.[0] && (
                                    <Fragment key={`${hw.eth_mac}:X6`}>
                                        <SpecRow label="IP (ETH)" value={hw.eth_connections[0].ip} mono />
                                        <SpecRow label="Subnet" value={hw.eth_connections[0].subnet} mono />
                                        <SpecRow label="Gateway" value={hw.eth_connections[0].gateway} mono />
                                        <SpecRow label="DHCP" value={hw.eth_connections[0].dhcp ? "Enabled" : "Disabled"} />
                                    </Fragment>
                                )}
                                <SpecRow label="WiFi adapter" value={hw.wifi_adapter} />
                                <SpecRow label="WiFi MAC" value={hw.wifi_mac} mono />
                                {hw.wifi_connections?.[0] && <SpecRow label="IP (WiFi)" value={hw.wifi_connections[0].ip} mono />}
                            </SpecGroup>

                            {/* ── Scan info ─────────────────────────────── */}
                            <SpecGroup title="Scan Info" colorClass="text-gray-400">
                                <SpecRow label="Speccy scan date" value={fmtDate(hw.speccy_scan_date)} />
                                <SpecRow label="Last updated" value={fmtDate(hw.updated_at)} />
                            </SpecGroup>
                        </Fragment>
                    ) : (
                        <tr>
                            <td colSpan={2} className="px-4 py-6 text-center text-sm text-gray-400">
                                No hardware data — import a Speccy XML file
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

// ── Ticket status badge ───────────────────────────────────
const TICKET_STATUS = {
    open: { label: "Open", cls: "bg-blue-50 text-blue-600" },
    in_progress: { label: "In Progress", cls: "bg-amber-50 text-amber-600" },
    resolved: { label: "Resolved", cls: "bg-green-50 text-green-600" },
    closed: { label: "Closed", cls: "bg-gray-100 text-gray-500" },
    cancelled: { label: "Cancelled", cls: "bg-red-50 text-red-500" },
};

// ── Software section ──────────────────────────────────────

// Backend DeviceSoftwareResponse returns flat fields: software_name, vendor.
// Now reads from device.installed_software (embedded in DeviceDetailResponse)
// instead of firing a separate useDeviceSoftware() API call.
function SoftwareSection({ software }) {
    if (!software?.length) return <div className="py-8 text-center text-sm text-gray-400">No software installed.</div>;

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                        {["Software", "Version"].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {software.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50/50">
                            <td className="px-4 py-3 font-medium text-gray-800">{s.software_name ?? "—"}</td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.version ?? "—"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ── Tickets section ───────────────────────────────────────

// instead of firing a separate useDeviceTickets() API call.
function TicketsSection({ tickets }) {
    const navigate = useNavigate();
    if (!tickets?.length) return <div className="py-8 text-center text-sm text-gray-400">No open tickets.</div>;

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                        {["Ticket #", "Title", "Priority", "Status"].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {tickets.map((t) => {
                        const st = TICKET_STATUS[t.status] ?? { label: t.status, cls: "bg-gray-100 text-gray-500" };
                        return (
                            <tr key={t.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => navigate(`/tickets/${t.id}`)}>
                                <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.ticket_number}</td>
                                <td className="px-4 py-3 font-medium text-gray-800 max-w-xs truncate">{t.title}</td>
                                <td className="px-4 py-3">
                                    <span
                                        className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize
                    ${
                        t.priority === "critical"
                            ? "bg-red-100 text-red-600"
                            : t.priority === "high"
                              ? "bg-orange-100 text-orange-600"
                              : t.priority === "medium"
                                ? "bg-yellow-100 text-yellow-600"
                                : "bg-gray-100 text-gray-500"
                    }`}
                                    >
                                        {t.priority}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

const TABS = ["Specifications", "Software", "Tickets"];

// ── Main Page ─────────────────────────────────────────────
export default function DeviceDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState("Specifications");
    const [editOpen, setEditOpen] = useState(false);
    const [statusOpen, setStatusOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [ticketOpen, setTicketOpen] = useState(false);
    const [deleteErr, setDeleteErr] = useState(null);
    const [moreOpen, setMoreOpen] = useState(false);

    // hardware (snapshot), installed_software, and open_ticket_list.
    // Removed the separate useDeviceHardware, useDeviceSoftware,
    // useDeviceTickets hooks — they caused 3 extra API calls per page load.
    // We still call useDeviceHardware for the full hardware detail in SpecsTable.
    const { data: device, isLoading, isError } = useDevice(id);
    const { data: hw } = useDeviceHardware(id); // full hardware detail for SpecsTable
    const { data: employees = [] } = useEmployees();
    const { data: departments = [] } = useDepartments();
    const { data: device_model = [] } = useDeviceModels();
    const deleteMut = useDeleteDevice();

    async function handleDelete() {
        setDeleteErr(null);
        try {
            await deleteMut.mutateAsync(id);
            navigate("/devices");
        } catch (err) {
            setDeleteErr(err.message);
        }
    }

    if (isLoading)
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );

    if (isError || !device)
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
                <p className="text-gray-500">Device not found.</p>
                <button onClick={() => navigate("/devices")} className="text-sm text-blue-600 hover:underline">
                    ← Back
                </button>
            </div>
        );

    const emp = employees.find((e) => e.id === device.employee_id);
    const dept = departments.find((d) => d.id === device.department_id);
    const dev_model = device_model.find((m) => m.id === device.device_model_id);
    const days = daysLeft(device.warranty_expiry);

    const warrantyLabel = days === null ? "No warranty" : days < 0 ? `Expired ${Math.abs(days)}d ago` : days <= 30 ? `Expires in ${days}d` : fmtDate(device.warranty_expiry);

    // DeviceDetailResponse embeds open_ticket_list directly.
    const openTickets = device.open_ticket_list ?? [];

    const totalStorageMb = hw?.storage?.reduce((sum, disk) => sum + (disk.capacity_mb || 0), 0);
    const disksCount = hw?.storage?.length || 0;

    return (
        <div className="max-w-6xl mx-auto space-y-5">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-gray-400">
                <Link to="/devices" className="hover:text-gray-600 transition-colors">
                    Devices
                </Link>
                <span>/</span>
                <span className="text-gray-700 font-medium truncate">{device.name}</span>
            </div>

            {/* ── Header ──────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                        <button onClick={() => navigate("/devices")} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors shrink-0">
                            <MdArrowBack className="text-lg" />
                        </button>
                        <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                            <MdComputer className="text-blue-600 text-xl" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h1 className="text-xl font-bold text-gray-900 truncate">{device.name}</h1>
                                <DeviceStatusBadge status={device.status} size="lg" />
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5 font-mono">{device.serial_number ?? "No serial number"}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => setEditOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200
                rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
                        >
                            <MdEdit className="text-base" /> Edit
                        </button>
                        <button
                            onClick={() => setStatusOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200
                rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
                        >
                            <MdSwapHoriz className="text-base" /> Status
                        </button>
                        <button
                            onClick={() => setTicketOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600
                hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                            <MdAdd className="text-base" /> New Ticket
                        </button>
                        <div className="relative">
                            <button onClick={() => setMoreOpen((o) => !o)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors">
                                <MdMoreVert className="text-lg" />
                            </button>
                            {moreOpen && (
                                <div
                                    className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-100
                  rounded-xl shadow-lg py-1 z-20"
                                >
                                    <button
                                        onClick={() => {
                                            setMoreOpen(false);
                                            setDeleteOpen(true);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-nowrap text-red-500 hover:bg-red-50 flex items-center gap-2"
                                    >
                                        <MdDelete className="text-base" /> Delete device
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── System Summary ───────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h1 className="text-xl font-bold text-gray-900 mb-4">System Summary</h1>
                <div className="flex">
                    <div className="flex flex-col flex-1">
                        <table className="w-full">
                            <tbody>
                                {hw ? (
                                    <Fragment key={hw.id}>
                                        <SpecRow label="Model" value={dev_model ? `${dev_model.manufacturer} ${dev_model.model_name}` : "—"} />

                                        <SpecRow label="CPU" value={hw.cpu_model} />
                                        <SpecRow label="RAM" value={`${mb(hw.ram_total_mb)} ${hw.ram_type ?? ""}`.trim()} />
                                        <SpecRow label="Motherboard" value={`${hw.mb_manufacturer ?? ""} ${hw.mb_model ?? ""}`.trim() || null} />
                                    </Fragment>
                                ) : (
                                    <tr>
                                        <td colSpan={2} className="px-4 py-6 text-center text-sm text-gray-400">
                                            No hardware data to view.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex flex-col flex-1">
                        <table className="w-full">
                            <tbody>
                                {hw ? (
                                    <Fragment key={hw.id}>
                                        <SpecRow label="IPv4 (Ethernet)" value={hw.eth_connections?.[0]?.ip} />
                                        <SpecRow label="OS" value={device.operating_system?.name} />

                                        <SpecRow label="GPU" value={`${hw.gpu_manufacturer ?? ""} ${hw.gpu_model ?? ""}`.trim() || null} />
                                        <SpecRow
                                            label="Storage"
                                            value={totalStorageMb ? `${disksCount} disk${disksCount > 1 ? "s" : ""} — ${disksCount > 1 ? "Total " : ""}${mb(totalStorageMb)}` : "—"}
                                        />
                                    </Fragment>
                                ) : (
                                    <tr>
                                        <td colSpan={2} className="px-4 py-6 text-center text-sm text-gray-400">
                                            No hardware data to view.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── Info cards ──────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <InfoCard icon={MdPerson} iconBg="bg-blue-500" label="Assigned to" value={emp?.full_name} sub={emp?.job_title} />
                <InfoCard icon={MdBusiness} iconBg="bg-purple-500" label="Department" value={dept?.name} />
                <InfoCard
                    icon={MdShield}
                    iconBg={days === null ? "bg-gray-400" : days < 0 ? "bg-red-400" : days <= 30 ? "bg-amber-400" : "bg-green-500"}
                    label="Warranty"
                    value={warrantyLabel}
                    subColor={days !== null && days < 0 ? "text-red-500" : days !== null && days <= 30 ? "text-amber-500" : "text-green-600"}
                />
                <InfoCard
                    icon={MdConfirmationNumber}
                    iconBg="bg-orange-400"
                    label="Open tickets"
                    // Now uses device.open_ticket_list from the enriched DeviceDetailResponse.
                    value={openTickets.length > 0 ? `${openTickets.length} open` : "No open tickets"}
                />
            </div>

            {/* ── Tabs ────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex border-b border-gray-100 px-2 pt-2 gap-1">
                    {TABS.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all border-b-2 -mb-px
                ${activeTab === tab ? "border-blue-500 text-blue-600 bg-blue-50/50" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
                <div className="p-5">
                    {activeTab === "Specifications" && <SpecsTable device={device} hw={hw} employees={employees} departments={departments} />}

                    {activeTab === "Software" && <SoftwareSection software={device.installed_software} />}
                    {activeTab === "Tickets" && <TicketsSection tickets={device.open_ticket_list} />}
                </div>
            </div>

            {/* Modals */}
            <DeviceForm open={editOpen} onClose={() => setEditOpen(false)} device={device} />
            <DeviceStatusModal open={statusOpen} onClose={() => setStatusOpen(false)} device={device} />
            <TicketForm open={ticketOpen} onClose={() => setTicketOpen(false)} defaultDeviceId={id} />
            <ConfirmDialog
                open={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                onConfirm={handleDelete}
                loading={deleteMut.isPending}
                title="Delete Device"
                message={deleteErr ?? `Delete "${device.name}"? This will fail if the device has open tickets.`}
                danger
            />
        </div>
    );
}
