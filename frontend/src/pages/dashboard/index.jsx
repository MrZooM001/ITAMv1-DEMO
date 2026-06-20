import { useNavigate } from "react-router-dom";
import { useDevices, useDeviceTypes, useDevicesHardwareBulk } from "../../features/devices/hooks/useDevices";
import { useEmployees } from "../../features/employees/hooks/useEmployees";
import { useDepartments } from "../../features/departments/hooks/useDepartments";
import { useTickets } from "../../features/tickets/hooks/useTickets";
import { useAuthStore } from "../../store/auth.store";
import { useUsers } from "../../features/users/hooks/useUsers";
import { useMemo } from "react";
import { MdDevices, MdConfirmationNumber, MdPeople, MdBusiness, MdPeopleAlt, MdWarning, MdComputer } from "react-icons/md";
import { TbCpu } from "react-icons/tb";

function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function daysLeft(d) {
    if (!d) return null;
    return Math.ceil((new Date(d) - new Date()) / 86400000);
}

// Normalize OS/CPU name: trim + collapse spaces
function normalize(s) {
    return s?.trim().replace(/\s+/g, " ") ?? "";
}

// Group OS names by edition family e.g. "Windows 7"
function groupByFamily(map) {
    const families = {};
    for (const [name, count] of Object.entries(map)) {
        const norm = normalize(name);
        // Family = first two words e.g. "Windows 10", "Ubuntu 22"
        const parts = norm.split(" ");
        const family = parts.slice(0, 2).join(" ");
        if (!families[family]) families[family] = { total: 0, editions: {} };
        families[family].total += count;
        families[family].editions[norm] = (families[family].editions[norm] ?? 0) + count;
    }
    return Object.entries(families).sort((a, b) => b[1].total - a[1].total);
}

// ── Stat Card ─────────────────────────────────────────────
function StatCard({ icon: Icon, iconBg, label, value, sub, subColor, onClick }) {
    return (
        <div
            onClick={onClick}
            className={`bg-white rounded-2xl border border-gray-100 p-5 flex items-start gap-4 shadow-sm
        ${onClick ? "cursor-pointer hover:border-blue-200 hover:shadow-md transition-all" : ""}`}
        >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                <Icon className="text-xl text-white" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{value ?? "—"}</p>
                {sub && <p className={`text-xs mt-1 ${subColor ?? "text-gray-400"}`}>{sub}</p>}
            </div>
        </div>
    );
}

// ── Section ───────────────────────────────────────────────
function Section({ title, action, actionLabel, children }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
                {action && (
                    <button onClick={action} className="text-xs text-blue-600 hover:underline">
                        {actionLabel ?? "See all"}
                    </button>
                )}
            </div>
            <div className="p-4">{children}</div>
        </div>
    );
}

// ── Bar row ───────────────────────────────────────────────
function BarRow({ label, count, total, color = "bg-blue-400", indent = false }) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <div className={`flex items-center gap-3 py-1.5 ${indent ? "pl-4" : ""}`}>
            <span className={`truncate shrink-0 ${indent ? "text-xs text-gray-400 w-48" : "text-xs text-gray-500 font-medium w-44"}`}>{indent ? `↳ ${label}` : label}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-semibold text-gray-700 w-8 text-right shrink-0">{count}</span>
            <span className="text-xs text-gray-400 w-8 text-right shrink-0">{pct}%</span>
        </div>
    );
}

// ── Device type row ───────────────────────────────────────
const TYPE_COLORS = ["bg-blue-500", "bg-purple-500", "bg-teal-500", "bg-orange-400", "bg-pink-400", "bg-indigo-500", "bg-green-500", "bg-amber-500"];

export default function Dashboard() {
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const isAdmin = user?.role === "admin" || user?.role === "super_admin";

    const { data: devices = [] } = useDevices();
    const { data: employees = [] } = useEmployees();
    const { data: departments = [] } = useDepartments();
    const { data: deviceTypes = [] } = useDeviceTypes();
    const { data: tickets = [] } = useTickets();
    const { data: users = [] } = useUsers();

    // Bulk hardware for OS + CPU data
    const deviceIds = useMemo(() => devices.map((d) => d.id), [devices]);
    const { data: hwMap = {} } = useDevicesHardwareBulk(deviceIds);

    // ── Counts ────────────────────────────────────────────
    const activeDevices = devices.filter((d) => d.status !== "retired");
    const totalActive = activeDevices.length;
    const openTickets = tickets.filter((t) => t.status === "open" || t.status === "in_progress");

    // By type
    const byType = deviceTypes
        .map((t, i) => ({
            label: t.name,
            count: activeDevices.filter((d) => d.device_type_id === t.id).length,
            color: TYPE_COLORS[i % TYPE_COLORS.length],
        }))
        .filter((t) => t.count > 0)
        .sort((a, b) => b.count - a.count);

    // ── OS grouping ───────────────────────────────────────
    const osRaw = useMemo(() => {
        const map = {};
        activeDevices.forEach((d) => {
            const name = normalize(d.operating_system?.name ?? "");
            if (name) map[name] = (map[name] ?? 0) + 1;
        });
        return map;
    }, [activeDevices]);
    const osGroups = useMemo(() => groupByFamily(osRaw), [osRaw]);
    const osTotalWithOS = Object.values(osRaw).reduce((s, c) => s + c, 0);

    // ── CPU grouping ──────────────────────────────────────
    const cpuRaw = useMemo(() => {
        const map = {};
        activeDevices.forEach((d) => {
            const hw = hwMap[d.id];
            const name = normalize(hw?.cpu_model ?? "");
            if (name) map[name] = (map[name] ?? 0) + 1;
        });
        return map;
    }, [activeDevices, hwMap]);
    const cpuGroups = useMemo(() => groupByFamily(cpuRaw), [cpuRaw]);
    const cpuTotal = Object.values(cpuRaw).reduce((s, c) => s + c, 0);

    // ── Expiring warranty ──────────────────────────────────
    const expiringWarranty = activeDevices
        .filter((d) => {
            const days = daysLeft(d.warranty_expiry);
            return days !== null && days >= 0 && days <= 30;
        })
        .sort((a, b) => daysLeft(a.warranty_expiry) - daysLeft(b.warranty_expiry))
        .slice(0, 5);

    return (
        <div className="space-y-5 max-w-7xl mx-auto">
            {/* ── Top stat cards ─────────────────────────────── */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard icon={MdDevices} iconBg="bg-blue-500" label="Total Devices" value={totalActive} sub="Excluding retired" onClick={() => navigate("/devices")} />
                <StatCard
                    icon={MdConfirmationNumber}
                    iconBg="bg-orange-400"
                    label="Open Tickets"
                    value={openTickets.length}
                    sub="Open + In Progress"
                    onClick={() => navigate("/tickets")}
                />
                <StatCard
                    icon={MdPeople}
                    iconBg="bg-purple-500"
                    label="Employees"
                    value={employees.length}
                    sub={`${employees.filter((e) => e.is_active).length} active`}
                    onClick={() => navigate("/employees")}
                />
                <StatCard icon={MdBusiness} iconBg="bg-teal-500" label="Departments" value={departments.length} onClick={() => navigate("/departments")} />
            </div>

            {/* ── Admin: users stats ─────────────────────────── */}
            {isAdmin && (
                <div className="grid grid-cols-2 gap-4">
                    <StatCard icon={MdPeopleAlt} iconBg="bg-indigo-500" label="System Users" value={users.length} sub="Total accounts" onClick={() => navigate("/users")} />
                    <StatCard
                        icon={MdPeopleAlt}
                        iconBg="bg-green-500"
                        label="Active Users"
                        value={users.filter((u) => u.is_active).length}
                        sub="Currently enabled"
                        onClick={() => navigate("/users")}
                    />
                </div>
            )}

            {/* ── Device types + OS groups ────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Device types */}
                <Section title="Devices by Type" action={() => navigate("/devices")} actionLabel="View all">
                    {byType.length === 0 ? (
                        <p className="text-sm text-gray-400 py-4 text-center">No device types found</p>
                    ) : (
                        byType.map((t) => <BarRow key={t.label} {...t} total={totalActive} />)
                    )}
                </Section>

                {/* OS versions — grouped by family */}
                <Section title={`OS Versions (${osTotalWithOS} devices)`} action={() => navigate("/devices")} actionLabel="View all">
                    {osGroups.length === 0 ? (
                        <p className="text-sm text-gray-400 py-4 text-center">No OS data — import Speccy XML files</p>
                    ) : (
                        osGroups.map(([family, data]) => (
                            <div key={family} className="mb-1">
                                <BarRow label={family} count={data.total} total={osTotalWithOS} color="bg-blue-500" />
                                {Object.entries(data.editions)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(
                                        ([edition, count]) =>
                                            edition !== family && (
                                                <BarRow
                                                    key={edition}
                                                    label={edition.replace(family, "").trim() || edition}
                                                    count={count}
                                                    total={osTotalWithOS}
                                                    color="bg-blue-300"
                                                    indent
                                                />
                                            ),
                                    )}
                            </div>
                        ))
                    )}
                </Section>
            </div>

            {/* ── CPU breakdown ───────────────────────────────── */}
            <Section title={`CPU Models (${cpuTotal} devices)`} action={() => navigate("/devices")} actionLabel="View all">
                {cpuGroups.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">No CPU data — import Speccy XML files</p>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8">
                        {cpuGroups.map(([family, data]) => (
                            <div key={family} className="mb-1">
                                <BarRow label={family} count={data.total} total={cpuTotal} color="bg-purple-400" />
                                {Object.entries(data.editions)
                                    .sort((a, b) => b[1] - a[1])
                                    .filter(([edition]) => normalize(edition) !== normalize(family))
                                    .map(([edition, count]) => (
                                        <BarRow key={edition} label={edition.replace(family, "").trim() || edition} count={count} total={cpuTotal} color="bg-purple-200" indent />
                                    ))}
                            </div>
                        ))}
                    </div>
                )}
            </Section>

            {/* ── Warranty alerts ──────────────────────────────── */}
            {expiringWarranty.length > 0 && (
                <Section title={`Warranty Expiring Soon (${expiringWarranty.length})`} action={() => navigate("/reports/warranty")} actionLabel="Full report">
                    <div className="divide-y divide-gray-50">
                        {expiringWarranty.map((d) => {
                            const days = daysLeft(d.warranty_expiry);
                            return (
                                <div
                                    key={d.id}
                                    onClick={() => navigate(`/devices/${d.id}`)}
                                    className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-gray-50/60 -mx-4 px-4 rounded-lg transition-colors"
                                >
                                    <div
                                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                    ${days <= 7 ? "bg-red-100" : days <= 14 ? "bg-orange-100" : "bg-amber-100"}`}
                                    >
                                        <MdWarning className={`text-sm ${days <= 7 ? "text-red-500" : days <= 14 ? "text-orange-500" : "text-amber-500"}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">{d.name}</p>
                                        <p className="text-xs text-gray-400">{d.serial_number ?? "No serial"}</p>
                                    </div>
                                    <span
                                        className={`text-xs font-semibold shrink-0
                    ${days <= 7 ? "text-red-500" : days <= 14 ? "text-orange-500" : "text-amber-500"}`}
                                    >
                                        {days === 0 ? "Today!" : `${days}d left`}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </Section>
            )}
        </div>
    );
}
