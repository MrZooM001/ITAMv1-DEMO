import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GridComponent, ColumnsDirective, ColumnDirective, Inject, Sort, Filter, Toolbar, ExcelExport, PdfExport, ColumnChooser, Page, Resize } from "@syncfusion/ej2-react-grids";
import { useEmployees, useDeleteEmployee } from "../../features/employees/hooks/useEmployees";
import { useDepartments } from "../../features/departments/hooks/useDepartments";
import EmployeeForm from "../../features/employees/components/EmployeeForm";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { MdAdd, MdPeople, MdEdit, MdDelete, MdFilterList } from "react-icons/md";

export default function EmployeeList() {
    const navigate = useNavigate();
    const gridRef = useRef(null);
    const deleteMut = useDeleteEmployee();

    const [deptFilter, setDeptFilter] = useState("");
    const [formOpen, setFormOpen] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteErr, setDeleteErr] = useState(null);

    const { data: employees = [], isLoading, isError } = useEmployees(deptFilter ? { department_id: deptFilter } : {});
    const { data: departments = [] } = useDepartments();

    const total = employees?.length ?? 0;
    const active = employees?.filter((e) => e.is_active).length ?? 0;
    const inactive = total - active;

    function toolbarClick(args) {
        if (!gridRef.current) return;
        if (args.item.id === "grid_excelexport") gridRef.current.excelExport();
        if (args.item.id === "grid_pdfexport") gridRef.current.pdfExport();
        if (args.item.id === "grid_csvexport") gridRef.current.csvExport();
    }

    async function handleDelete() {
        setDeleteErr(null);
        try {
            await deleteMut.mutateAsync(deleteTarget.id);
            setDeleteTarget(null);
        } catch (err) {
            setDeleteErr(err.message);
        }
    }

    function ActionsTemplate(row) {
        return (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                    onClick={() => {
                        setEditTarget(row);
                        setFormOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                    <MdEdit className="text-base" />
                </button>
                <button
                    onClick={() => {
                        setDeleteErr(null);
                        setDeleteTarget(row);
                    }}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-red-50 hover:text-red-500 transition-colors"
                >
                    <MdDelete className="text-base" />
                </button>
            </div>
        );
    }

    if (isLoading)
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );

    if (isError)
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-red-500 text-sm">Failed to load employees.</p>
            </div>
        );

    return (
        <div className="space-y-5 max-w-full">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-xl font-bold text-[var(--text-primary)]">Employees</h1>
                    <p className="text-sm text-[var(--text-muted)] mt-0.5">{total} employees</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Department filter */}
                    <div
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200
            rounded-lg text-sm text-[var(--text-secondary)] shadow-sm"
                    >
                        <MdFilterList className="text-[var(--text-muted)]" />
                        <select
                            value={deptFilter}
                            onChange={(e) => setDeptFilter(e.target.value)}
                            className="bg-transparent focus:outline-none text-sm text-[var(--text-secondary)] cursor-pointer"
                        >
                            <option value="">All Departments</option>
                            {departments?.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={() => {
                            setEditTarget(null);
                            setFormOpen(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700
              text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                    >
                        <MdAdd className="text-lg" /> Add Employee
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "Total", value: total, color: "bg-blue-500" },
                    { label: "Active", value: active, color: "bg-green-500" },
                    { label: "Inactive", value: inactive, color: "bg-gray-400" },
                ].map(({ label, value, color }) => (
                    <div key={label} className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-color)] shadow-sm p-4 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                            <MdPeople className="text-white text-lg" />
                        </div>
                        <div>
                            <p className="text-xs text-[var(--text-muted)]">{label}</p>
                            <p className="text-xl font-bold text-[var(--text-primary)]">{value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Grid */}
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden">
                <GridComponent
                    id="emp-grid"
                    ref={gridRef}
                    dataSource={employees ?? []}
                    allowSorting
                    allowFiltering
                    allowResizing
                    showColumnChooser
                    allowExcelExport
                    allowPdfExport
                    allowPaging
                    filterSettings={{ type: "Menu" }}
                    pageSettings={{ pageSize: 15 }}
                    toolbarClick={toolbarClick}
                    toolbar={[
                        "Search",
                        "ColumnChooser",
                        { text: "Excel", id: "grid_excelexport", prefixIcon: "e-excelexport" },
                        { text: "PDF", id: "grid_pdfexport", prefixIcon: "e-pdfexport" },
                        { text: "CSV", id: "grid_csvexport", prefixIcon: "e-csvexport" },
                    ]}
                    rowSelected={(args) => navigate(`/employees/${args.data.id}`)}
                    cssClass="e-grid-custom"
                >
                    <ColumnsDirective>
                        <ColumnDirective
                            field="full_name"
                            headerText="Employee"
                            width="200"
                            minWidth="150"
                            template={(r) => (
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                        <span className="text-xs font-semibold text-blue-600">{r.full_name?.[0]?.toUpperCase() ?? "?"}</span>
                                    </div>
                                    <span className="font-medium text-[var(--text-primary)]">{r.full_name}</span>
                                </div>
                            )}
                        />
                        <ColumnDirective
                            field="job_title"
                            headerText="Job Title"
                            width="170"
                            minWidth="130"
                            template={(r) => <span className="text-sm text-[var(--text-secondary)]">{r.job_title ?? "—"}</span>}
                        />
                        <ColumnDirective
                            field="department_name"
                            headerText="Department"
                            width="160"
                            minWidth="120"
                            template={(r) => (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                                    {r.department_name ?? "—"}
                                </span>
                            )}
                        />
                        <ColumnDirective
                            field="email"
                            headerText="Email"
                            width="200"
                            minWidth="150"
                            template={(r) => <span className="text-xs text-[var(--text-muted)]">{r.email ?? "—"}</span>}
                        />
                        <ColumnDirective
                            field="phone"
                            headerText="Phone"
                            width="140"
                            minWidth="110"
                            template={(r) => <span className="text-xs text-[var(--text-muted)]">{r.phone ?? "—"}</span>}
                        />
                        <ColumnDirective
                            field="device_count"
                            headerText="Devices"
                            width="90"
                            minWidth="80"
                            allowSorting
                            template={(r) => (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">{r.device_count ?? 0}</span>
                            )}
                        />
                        <ColumnDirective
                            field="open_tickets"
                            headerText="Tickets"
                            width="90"
                            minWidth="80"
                            allowSorting
                            template={(r) => (
                                <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                  ${(r.open_tickets ?? 0) > 0 ? "bg-amber-50 text-amber-600" : "bg-gray-50 text-[var(--text-muted)]"}`}
                                >
                                    {r.open_tickets ?? 0}
                                </span>
                            )}
                        />
                        <ColumnDirective
                            field="is_active"
                            headerText="Status"
                            width="110"
                            minWidth="90"
                            template={(r) => (
                                <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium
                  ${r.is_active ? "bg-green-50 text-green-600" : "bg-gray-100 text-[var(--text-muted)]"}`}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                                    {r.is_active ? "Active" : "Inactive"}
                                </span>
                            )}
                        />
                        <ColumnDirective headerText="Actions" width="90" allowSorting={false} allowFiltering={false} template={ActionsTemplate} />
                    </ColumnsDirective>
                    <Inject services={[Sort, Filter, Toolbar, ExcelExport, PdfExport, ColumnChooser, Page, Resize]} />
                </GridComponent>
            </div>

            {/* Modals */}
            <EmployeeForm
                open={formOpen}
                onClose={() => {
                    setFormOpen(false);
                    setEditTarget(null);
                }}
                employee={editTarget}
            />
            <ConfirmDialog
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                loading={deleteMut.isPending}
                title="Delete Employee"
                message={deleteErr ?? `Delete "${deleteTarget?.full_name}"? This will fail if the employee has assigned devices.`}
                danger
            />
        </div>
    );
}
