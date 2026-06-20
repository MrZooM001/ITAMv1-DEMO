import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useDepartment, useDeleteDepartment } from "../../features/departments/hooks/useDepartments";
import DepartmentForm from "../../features/departments/components/DepartmentForm";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import DeviceStatusBadge from "../../features/devices/components/DeviceStatusBadge";
import { TicketStatusBadge, TicketPriorityBadge } from "../../features/tickets/components/TicketStatusBadge";
import { MdArrowBack, MdEdit, MdDelete, MdPeople, MdDevices, MdConfirmationNumber, MdBusiness } from "react-icons/md";

const TABS = ["Overview", "Employees", "Devices", "Tickets"];

function StatCard({ icon: Icon, iconBg, label, value }) {
    return (
        <div className="bg-[var(--bg-surface-2)] rounded-xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                <Icon className="text-white text-base" />
            </div>
            <div>
                <p className="text-xs text-[var(--text-muted)]">{label}</p>
                <p className="text-xl font-bold text-[var(--text-primary)]">{value ?? 0}</p>
            </div>
        </div>
    );
}

function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function DepartmentDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    // GET /departments/{id} — returns embedded employees[] + devices[]
    // open_tickets count is embedded in the response.
    // NOTE for backend: add GET /tickets/?department_id={id} filter to enable
    // the Tickets tab to show a real list without a full table scan.
    const { data: dept, isLoading, isError } = useDepartment(id);

    // dept.open_tickets is the count from the API.
    // For the Tickets tab, we use the devices embedded in the dept response
    // to display a placeholder message until a department_id filter is added.
    const deptTickets = [];

    const deleteDept = useDeleteDepartment();
    const [activeTab, setActiveTab] = useState("Overview");
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteErr, setDeleteErr] = useState(null);

    async function handleDelete() {
        setDeleteErr(null);
        try {
            await deleteDept.mutateAsync(id);
            navigate("/departments");
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

    if (isError || !dept)
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
                <p className="text-[var(--text-muted)]">Department not found.</p>
                <button onClick={() => navigate("/departments")} className="text-sm text-blue-600 hover:underline">
                    ← Back
                </button>
            </div>
        );

    const employees = dept.employees ?? [];
    const devices = dept.devices ?? [];

    return (
        <div className="max-w-5xl mx-auto space-y-5">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <Link to="/departments" className="hover:text-[var(--text-primary)] transition-colors">
                    Departments
                </Link>
                <span>/</span>
                <span className="text-[var(--text-primary)] font-medium">{dept.name}</span>
            </div>

            {/* Header */}
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-color)] shadow-sm p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate("/departments")} className="p-2 rounded-lg hover:bg-[var(--bg-surface-2)] text-[var(--text-muted)] transition-colors">
                            <MdArrowBack className="text-lg" />
                        </button>
                        <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <MdBusiness className="text-blue-600 text-2xl" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-[var(--text-primary)]">{dept.name}</h1>
                            {dept.notes && <p className="text-sm text-[var(--text-muted)] mt-0.5">{dept.notes}</p>}
                            <p className="text-xs text-[var(--text-muted)] mt-1">Created {fmtDate(dept.created_at)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setEditOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-[var(--border-color)]
                rounded-lg hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] transition-colors"
                        >
                            <MdEdit className="text-base" /> Edit
                        </button>
                        <button
                            onClick={() => {
                                setDeleteErr(null);
                                setDeleteOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-red-200 dark:border-red-800
                rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                        >
                            <MdDelete className="text-base" /> Delete
                        </button>
                    </div>
                </div>

                {/* Stats from API response directly */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                    <StatCard icon={MdPeople} iconBg="bg-purple-500" label="Employees" value={dept.employee_count} />
                    <StatCard icon={MdDevices} iconBg="bg-blue-500" label="Devices" value={dept.device_count} />
                    <StatCard icon={MdConfirmationNumber} iconBg="bg-amber-500" label="Open Tickets" value={dept.open_tickets} />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-[var(--border-color)]">
                {TABS.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all
              ${activeTab === tab ? "border-blue-500 text-blue-600" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                    >
                        {tab}
                        {tab === "Employees" && employees.length > 0 && (
                            <span className="ml-1.5 text-xs bg-[var(--bg-surface-2)] px-1.5 py-0.5 rounded-full">{employees.length}</span>
                        )}
                        {tab === "Devices" && devices.length > 0 && <span className="ml-1.5 text-xs bg-[var(--bg-surface-2)] px-1.5 py-0.5 rounded-full">{devices.length}</span>}
                        {tab === "Tickets" && dept.open_tickets > 0 && (
                            <span className="ml-1.5 text-xs bg-[var(--bg-surface-2)] px-1.5 py-0.5 rounded-full">{dept.open_tickets}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Overview */}
            {activeTab === "Overview" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-color)] shadow-sm p-5">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Employees ({employees.length})</h3>
                        {employees.slice(0, 5).map((e) => (
                            <div
                                key={e.id}
                                onClick={() => navigate(`/employees/${e.id}`)}
                                className="flex items-center gap-3 py-2 border-b border-[var(--border-color)] last:border-0
                  cursor-pointer hover:bg-[var(--bg-surface-2)] -mx-2 px-2 rounded-lg transition-colors"
                            >
                                <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 text-xs font-bold shrink-0">
                                    {e.full_name?.[0]}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{e.full_name}</p>
                                    <p className="text-xs text-[var(--text-muted)] truncate">{e.job_title || "—"}</p>
                                </div>
                            </div>
                        ))}
                        {employees.length === 0 && <p className="text-xs text-[var(--text-muted)]">No employees yet.</p>}
                    </div>
                    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-color)] shadow-sm p-5">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Devices ({devices.length})</h3>
                        {devices.slice(0, 5).map((d) => (
                            <div
                                key={d.id}
                                onClick={() => navigate(`/devices/${d.id}`)}
                                className="flex items-center gap-3 py-2 border-b border-[var(--border-color)] last:border-0
                  cursor-pointer hover:bg-[var(--bg-surface-2)] -mx-2 px-2 rounded-lg transition-colors"
                            >
                                <MdDevices className="text-blue-500 text-lg shrink-0" />
                                <p className="text-sm font-medium text-[var(--text-primary)] flex-1 truncate">{d.name}</p>
                                <DeviceStatusBadge status={d.status} />
                            </div>
                        ))}
                        {devices.length === 0 && <p className="text-xs text-[var(--text-muted)]">No devices yet.</p>}
                    </div>
                </div>
            )}

            {/* Employees tab */}
            {activeTab === "Employees" && (
                <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden">
                    {employees.length === 0 ? (
                        <p className="text-sm text-[var(--text-muted)] p-6 text-center">No employees in this department.</p>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-surface-2)]">
                                    {["Name", "Job Title"].map((h) => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {employees.map((e) => (
                                    <tr
                                        key={e.id}
                                        onClick={() => navigate(`/employees/${e.id}`)}
                                        className="border-b border-[var(--border-color)] hover:bg-[var(--bg-surface-2)] cursor-pointer transition-colors"
                                    >
                                        <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">{e.full_name}</td>
                                        <td className="px-4 py-3 text-sm text-[var(--text-muted)]">{e.job_title || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Devices tab */}
            {activeTab === "Devices" && (
                <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden">
                    {devices.length === 0 ? (
                        <p className="text-sm text-[var(--text-muted)] p-6 text-center">No devices in this department.</p>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-surface-2)]">
                                    {["Device", "Status"].map((h) => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {devices.map((d) => (
                                    <tr
                                        key={d.id}
                                        onClick={() => navigate(`/devices/${d.id}`)}
                                        className="border-b border-[var(--border-color)] hover:bg-[var(--bg-surface-2)] cursor-pointer transition-colors"
                                    >
                                        <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">{d.name}</td>
                                        <td className="px-4 py-3">
                                            <DeviceStatusBadge status={d.status} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Tickets tab */}
            {activeTab === "Tickets" && (
                <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-color)] shadow-sm p-6 text-center">
                    <MdConfirmationNumber className="text-4xl text-[var(--text-muted)] mx-auto mb-2" />
                    <p className="text-sm font-medium text-[var(--text-primary)]">Ticket filtering by department coming soon</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                        This department has <span className="font-semibold text-amber-600">{dept.open_tickets ?? 0}</span> open tickets.
                        A backend filter endpoint is needed to list them here.
                    </p>
                </div>
            )}

            <DepartmentForm open={editOpen} onClose={() => setEditOpen(false)} department={dept} />
            <ConfirmDialog
                open={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                onConfirm={handleDelete}
                loading={deleteDept.isPending}
                title="Delete Department"
                message={deleteErr ?? `Delete "${dept.name}"? This will fail if it has employees or devices.`}
                danger
            />
        </div>
    );
}
