import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useEmployee, useDeleteEmployee } from "../../features/employees/hooks/useEmployees";
import EmployeeForm    from "../../features/employees/components/EmployeeForm";
import ConfirmDialog   from "../../components/ui/ConfirmDialog";
import DeviceStatusBadge from "../../features/devices/components/DeviceStatusBadge";
import {
  MdArrowBack, MdEdit, MdDelete,
  MdEmail, MdPhone, MdWork, MdBusiness,
  MdDevices, MdCalendarToday,
} from "react-icons/md";

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
        <Icon className="text-gray-400 text-base" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-800 truncate">{value || "—"}</p>
      </div>
    </div>
  );
}

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  // FIX: removed useDevices() (fetched ALL devices then filtered client-side).
  // useEmployee now returns EmployeeDetailResponse which embeds:
  //   - assigned_devices: [{id, name, status}]
  //   - open_ticket_list: [{id, ticket_number, title, status, priority}]
  //   - department_name, device_count, open_tickets (counts)
  // So we only need one API call total.
  const { data: employee, isLoading, isError } = useEmployee(id);
  const deleteMut = useDeleteEmployee();

  const [editOpen,   setEditOpen]   = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteErr,  setDeleteErr]  = useState(null);

  async function handleDelete() {
    setDeleteErr(null);
    try {
      await deleteMut.mutateAsync(id);
      navigate("/employees");
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

  if (isError || !employee)
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <p className="text-gray-500">Employee not found.</p>
        <button onClick={() => navigate("/employees")} className="text-sm text-blue-600 hover:underline">
          ← Back to employees
        </button>
      </div>
    );

  // Use embedded data from EmployeeDetailResponse
  const empDevices = employee.assigned_devices ?? [];
  const deptName   = employee.department_name;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link to="/employees" className="hover:text-gray-600 transition-colors">Employees</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{employee.full_name}</span>
      </div>

      {/* ── Header ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => navigate("/employees")}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors shrink-0"
            >
              <MdArrowBack className="text-lg" />
            </button>
            {/* Avatar */}
            <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center shrink-0">
              <span className="text-2xl font-bold text-blue-600">
                {employee.full_name?.[0]?.toUpperCase() ?? "?"}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{employee.full_name}</h1>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium
                  ${employee.is_active ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                  {employee.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                {employee.job_title ?? "No title"} {deptName ? `· ${deptName}` : ""}
              </p>
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
              onClick={() => { setDeleteErr(null); setDeleteOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-red-200
                rounded-lg hover:bg-red-50 text-red-500 transition-colors"
            >
              <MdDelete className="text-base" /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Contact info */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Contact Information</h2>
          <InfoRow icon={MdEmail}         label="Email"      value={employee.email} />
          <InfoRow icon={MdPhone}         label="Phone"      value={employee.phone} />
          <InfoRow icon={MdWork}          label="Job title"  value={employee.job_title} />
          {/* FIX: use pre-resolved department_name from EmployeeDetailResponse */}
          <InfoRow icon={MdBusiness}      label="Department" value={deptName} />
          <InfoRow icon={MdCalendarToday} label="Joined"     value={fmtDate(employee.created_at)} />
        </div>

        {/* Right: Assigned devices from embedded assigned_devices array */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <MdDevices className="text-gray-400 text-lg" />
              <h2 className="text-sm font-semibold text-gray-700">Assigned Devices</h2>
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                {empDevices.length}
              </span>
            </div>
          </div>

          {empDevices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MdDevices className="text-4xl text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">No devices assigned to this employee.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Device", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {/* FIX: empDevices comes from employee.assigned_devices (embedded).
                    AssignedDeviceInfo has {id, name, status} — no serial/OS/warranty
                    (those are in DeviceResponse, not this summary). Navigate to detail for full info. */}
                {empDevices.map((device) => (
                  <tr
                    key={device.id}
                    className="hover:bg-gray-50/60 transition-colors cursor-pointer"
                    onClick={() => navigate(`/devices/${device.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-800">{device.name}</td>
                    <td className="px-4 py-3">
                      <DeviceStatusBadge status={device.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modals */}
      <EmployeeForm open={editOpen} onClose={() => setEditOpen(false)} employee={employee} />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        loading={deleteMut.isPending}
        title="Delete Employee"
        message={deleteErr ?? `Delete "${employee.full_name}"? This will fail if the employee has assigned devices.`}
        danger
      />
    </div>
  );
}
