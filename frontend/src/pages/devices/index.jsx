import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import {
    GridComponent,
    ColumnsDirective,
    ColumnDirective,
    Inject,
    Sort,
    Filter,
    Toolbar,
    ExcelExport,
    PdfExport,
    ColumnChooser,
    Page,
    Resize,
    Search,
    SelectionSettings,
} from "@syncfusion/ej2-react-grids";
import { deviceKeys, fetchDevices, fetchDeviceTypes, useDevicesHardwareBulk, useDeleteDevice } from "../../features/devices/hooks/useDevices";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { empKeys, fetchEmployees } from "../../features/employees/hooks/useEmployees";
import { deptKeys, fetchDepartments } from "../../features/departments/hooks/useDepartments";
import DeviceStatusBadge from "../../features/devices/components/DeviceStatusBadge";
import DeviceForm from "../../features/devices/components/DeviceForm";
import { MdAdd, MdDevices, MdBuild, MdArchive, MdSettings, MdDelete } from "react-icons/md";
import { DeviceTypeForm, DeviceModelForm } from "../../features/devices/components/DeviceTypeModelForms";

const MenuAction = ({ icon: Icon, label, onClick, danger = false }) => {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors
        ${danger ? "text-red-600 hover:bg-red-50" : "text-gray-700 hover:bg-gray-50"}
      `}
        >
            {Icon && <Icon className="text-base" />}
            <span>{label}</span>
        </button>
    );
};

const ManageDropdown = ({ setTypeFormOpen, setModelFormOpen }) => {
    const [open, setOpen] = useState(false);
    const menuRef = useRef();

    // close on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={menuRef}>
            {/* Button */}
            <button
                onClick={() => setOpen((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
            >
                <MdSettings className="text-base" />
                <span>Manage</span>
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50">
                    <MenuAction
                        icon={MdAdd}
                        label="Add Device Type"
                        onClick={() => {
                            setTypeFormOpen(true);
                            setOpen(false);
                        }}
                    />

                    <MenuAction
                        icon={MdDevices}
                        label="Add Device Model"
                        onClick={() => {
                            setModelFormOpen(true);
                            setOpen(false);
                        }}
                    />
                </div>
            )}
        </div>
    );
};

// ── helpers ────────────────────────────────────────────────
function mb(val) {
    if (!val) return null;
    return val >= 1024 ? `${(val / 1024).toFixed(0)} GB` : `${val} MB`;
}

function StatCard({ icon: Icon, iconBg, label, value }) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                <Icon className="text-white text-lg" />
            </div>
            <div>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-xl font-bold text-gray-900">{value ?? "—"}</p>
            </div>
        </div>
    );
}

// ── Column templates (defined outside component — stable references) ──
const TplName = (r) => <span className="font-medium text-gray-800">{r.name}</span>;
const TplType = (r) => <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{r._typeName || "—"}</span>;
const TplIp = (r) => {
    if (!r._allIps?.length) return <span className="text-xs text-gray-400">—</span>;
    return (
        <div className="flex flex-col gap-0.5">
            {r._allIps.map((ip, i) => (
                <span key={i} className="font-mono text-xs text-gray-600 leading-tight">
                    {ip}
                </span>
            ))}
        </div>
    );
};
const TplMac = (r) => <span className="font-mono text-xs text-gray-400">{r.eth_mac || "—"}</span>;
const TplCpu = (r) => <span className="text-xs text-gray-600">{r.cpu_model || "—"}</span>;
const TplRam = (r) => {
    const size = mb(r.ram_total_mb);
    if (!size) return <span className="text-xs text-gray-400">—</span>;
    return (
        <span className="text-xs text-gray-600">
            {size}
            {r.ram_type ? ` ${r.ram_type}` : ""}
        </span>
    );
};
const TplOs = (r) => <span className="text-xs text-gray-600">{r._osName || "—"}</span>;
const TplDept = (r) => <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">{r._deptName || "—"}</span>;
const TplEmployee = (r) => <span className="text-sm text-gray-600">{r._employeeName || "Unassigned"}</span>;
const TplMonitor = (r) => {
    const m = r.monitors?.[0];
    if (!m) return <span className="text-xs text-gray-400">—</span>;
    return <span className="text-xs text-gray-600">{[m.manufacturer, m.model, m.resolution].filter(Boolean).join(" · ")}</span>;
};

export default function DeviceList() {
    const navigate = useNavigate();
    const gridRef = useRef(null);

    const results = useQueries({
        queries: [
            {
                queryKey: deviceKeys.list({}),
                queryFn: () => fetchDevices(),
            },
            {
                queryKey: empKeys.list({}),
                queryFn: () => fetchEmployees(),
            },
            {
                queryKey: deptKeys.lists(),
                queryFn: () => fetchDepartments(),
            },
            {
                queryKey: deviceKeys.types(),
                queryFn: () => fetchDeviceTypes(),
            },
        ],
    });

    const isLoading = results.some((r) => r.isLoading);
    const isError = results.some((r) => r.isError);

    const devices = results[0].data ?? [];
    const employees = results[1].data ?? [];
    const departments = results[2].data ?? [];
    const deviceTypes = results[3].data ?? [];

    const deleteMut = useDeleteDevice();

    // Bulk fetch hardware for all devices
    const deviceIds = useMemo(() => devices.map((d) => d.id), [devices]);
    const { data: hwMap = {} } = useDevicesHardwareBulk(deviceIds);

    const [formOpen, setFormOpen] = useState(false);
    const [typeFormOpen, setTypeFormOpen] = useState(false);
    const [modelFormOpen, setModelFormOpen] = useState(false);

    // ── Bulk-delete state ──────────────────────────────────
    // selectedCount: lightweight number — only triggers a re-render to show/hide
    // the action bar. Actual IDs are read from the grid on demand (no React state).
    const [selectedCount, setSelectedCount] = useState(0);
    const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [bulkResult, setBulkResult] = useState(null);

    const selectionSettings = useMemo(() => ({ type: "Multiple", checkboxOnly: true }), []);

    // ── Enrich rows ────────────────────────────────────────
    const enriched = useMemo(
        () =>
            devices.map((d) => {
                const hw = hwMap[d.id] ?? {};
                const allIps = [...(hw.eth_connections ?? []).map((c) => c.ip).filter(Boolean), ...(hw.wifi_connections ?? []).map((c) => c.ip).filter(Boolean)];
                return {
                    ...d,
                    _typeName: deviceTypes.find((t) => t.id === d.device_type_id)?.name ?? "",
                    _employeeName: employees.find((e) => e.id === d.employee_id)?.full_name ?? "",
                    _deptName: departments.find((p) => p.id === d.department_id)?.name ?? "",
                    _osName: d.operating_system?.name ?? "",
                    cpu_model: hw.cpu_model ?? "",
                    ram_total_mb: hw.ram_total_mb ?? null,
                    ram_type: hw.ram_type ?? "",
                    eth_mac: hw.eth_mac ?? "",
                    monitors: hw.monitors ?? [],
                    _allIps: allIps,
                    _ipStr: allIps.join(" "),
                };
            }),
        [devices, hwMap, employees, departments, deviceTypes],
    );

    const total = enriched.length;
    const active = enriched.filter((d) => d.status === "active").length;
    const maintenance = enriched.filter((d) => d.status === "in_maintenance").length;
    const retired = enriched.filter((d) => d.status === "retired").length;

    const toolbar = useMemo(
        () => [
            "Search",
            "ColumnChooser",
            { text: "Excel", id: "devgrid_excelexport", prefixIcon: "e-excelexport" },
            { text: "PDF", id: "devgrid_pdfexport", prefixIcon: "e-pdfexport" },
            { text: "CSV", id: "devgrid_csvexport", prefixIcon: "e-csvexport" },
        ],
        [],
    );

    const toolbarClick = useCallback((args) => {
        if (!gridRef.current) return;
        if (args.item.id === "devgrid_excelexport") gridRef.current.excelExport();
        if (args.item.id === "devgrid_pdfexport") gridRef.current.pdfExport();
        if (args.item.id === "devgrid_csvexport") gridRef.current.csvExport();
    }, []);

    // ── Grid selection handler ─────────────────────────────
    // Only updates a count — zero data processing, zero array allocation.
    // Actual IDs are read from the grid only when an action button is clicked.
    const syncSelection = useCallback(() => {
        const count = gridRef.current?.getSelectedRecords().length ?? 0;
        setSelectedCount(count);
    }, []);

    // ── Bulk delete ────────────────────────────────────────
    // NOTE for backend: Add DELETE /devices/bulk { ids: number[] } to avoid
    // N sequential requests and enable atomic rollback.
    const handleBulkDelete = useCallback(async () => {
        // Read IDs from the grid HERE — at execution time, not at selection time
        const ids = gridRef.current?.getSelectedRecords().map((r) => r.id) ?? [];
        if (ids.length === 0) return;

        setBulkDeleting(true);
        const results = await Promise.allSettled(ids.map((id) => deleteMut.mutateAsync(id)));
        const failed = results.filter((r) => r.status === "rejected").length;
        setBulkDeleting(false);
        setBulkConfirmOpen(false);

        gridRef.current?.clearSelection();
        setSelectedCount(0);

        if (failed > 0) setBulkResult({ failed });
    }, [deleteMut]);

    if (isLoading)
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-gray-400">Loading devices...</p>
                </div>
            </div>
        );

    if (isError)
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-red-500 text-sm">Failed to load devices. Please try again.</p>
            </div>
        );

    return (
        <div className="space-y-5 max-w-full">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Devices</h1>
                    <p className="text-sm text-gray-400 mt-0.5">{total} devices total</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Manage types/models */}
                    <ManageDropdown setTypeFormOpen={setTypeFormOpen} setModelFormOpen={setModelFormOpen} />

                    <button
                        onClick={() => setFormOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700
              text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                    >
                        <MdAdd className="text-lg" /> Add Device
                    </button>
                </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={MdDevices} iconBg="bg-blue-500" label="Total" value={total} />
                <StatCard icon={MdDevices} iconBg="bg-green-500" label="Active" value={active} />
                <StatCard icon={MdBuild} iconBg="bg-amber-400" label="In Maintenance" value={maintenance} />
                <StatCard icon={MdArchive} iconBg="bg-gray-400" label="Retired" value={retired} />
            </div>

            {/* ── Bulk-action bar — appears when rows are checked ── */}
            {selectedCount > 0 && (
                <div className="flex items-center justify-center gap-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-sm font-medium text-blue-700">
                        {selectedCount} device{selectedCount > 1 ? "s" : ""} selected
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                gridRef.current?.clearSelection();
                                setSelectedCount(0);
                            }}
                            className="px-3 py-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                            Clear selection
                        </button>
                        <button
                            onClick={() => setBulkConfirmOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                        >
                            <MdDelete className="text-sm" />
                            Delete {selectedCount} device{selectedCount > 1 ? "s" : ""}
                        </button>
                    </div>
                </div>
            )}

            {/* Partial-failure notice */}
            {bulkResult && (
                <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-sm text-amber-700">
                        {bulkResult.failed} device{bulkResult.failed > 1 ? "s" : ""} could not be deleted (may have linked tickets or dependencies).
                    </p>
                    <button onClick={() => setBulkResult(null)} className="text-xs text-amber-600 hover:underline">
                        Dismiss
                    </button>
                </div>
            )}

            {/* Grid */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <GridComponent
                    id="devgrid"
                    ref={gridRef}
                    dataSource={enriched}
                    allowSorting
                    allowFiltering
                    allowResizing
                    showColumnChooser
                    allowExcelExport
                    allowPdfExport
                    allowPaging
                    filterSettings={{ type: "Menu" }}
                    pageSettings={{ pageSize: 20, pageSizes: true }}
                    searchSettings={{
                        fields: ["name", "serial_number", "_employeeName", "_deptName", "_osName", "status", "cpu_model", "eth_mac", "_ipStr", "ram_total_mb"],
                        operator: "contains",
                        ignoreCase: true,
                    }}
                    toolbarClick={toolbarClick}
                    toolbar={toolbar}
                    selectionSettings={selectionSettings}
                    checkBoxChange={syncSelection}
                    rowSelected={syncSelection}
                    rowDeselected={syncSelection}
                    recordClick={(args) => {
                        if (args.cellIndex === 0) {
                            return;
                        }

                        navigate(`/devices/${args.rowData.id}`);
                    }}
                    cssClass="e-grid-custom"
                >
                    <ColumnsDirective>
                        {/* Device name */}
                        <ColumnDirective type="checkbox" width="50" />

                        {/* Device name */}
                        <ColumnDirective field="name" headerText="Device" width="170" minWidth="130" template={TplName} />

                        {/* Device Type */}
                        <ColumnDirective field="_typeName" headerText="Type" width="110" minWidth="90" template={TplType} />

                        {/* IPv4 — all IPs stacked */}
                        <ColumnDirective field="_ipStr" headerText="IPv4" width="150" minWidth="120" template={TplIp} />

                        {/* MAC (ETH) */}
                        <ColumnDirective field="eth_mac" headerText="MAC (ETH)" width="150" minWidth="120" template={TplMac} />

                        {/* CPU */}
                        <ColumnDirective field="cpu_model" headerText="CPU" width="190" minWidth="130" template={TplCpu} />

                        {/* RAM */}
                        <ColumnDirective field="ram_total_mb" headerText="RAM" width="120" minWidth="90" template={TplRam} />

                        {/* OS */}
                        <ColumnDirective field="_osName" headerText="OS" width="160" minWidth="120" template={TplOs} />

                        {/* Department */}
                        <ColumnDirective field="_deptName" headerText="Department" width="140" minWidth="110" template={TplDept} />

                        {/* Employee */}
                        <ColumnDirective field="_employeeName" headerText="Assigned To" width="150" minWidth="120" template={TplEmployee} />

                        {/* Monitor */}
                        <ColumnDirective field="monitor" headerText="Monitor" width="180" minWidth="130" template={TplMonitor} />
                    </ColumnsDirective>
                    <Inject services={[Sort, Filter, Toolbar, ExcelExport, PdfExport, ColumnChooser, Page, Resize, Search]} />
                </GridComponent>
            </div>

            {/* Modals */}
            <DeviceForm open={formOpen} onClose={() => setFormOpen(false)} />
            <DeviceTypeForm open={typeFormOpen} onClose={() => setTypeFormOpen(false)} />
            <DeviceModelForm open={modelFormOpen} onClose={() => setModelFormOpen(false)} />

            {/* Bulk delete confirm */}
            <ConfirmDialog
                open={bulkConfirmOpen}
                onClose={() => setBulkConfirmOpen(false)}
                onConfirm={handleBulkDelete}
                loading={bulkDeleting}
                title="Delete Devices"
                message={`Permanently delete ${selectedCount} selected device${selectedCount > 1 ? "s" : ""}? This cannot be undone.`}
                confirmLabel={`Delete ${selectedCount} device${selectedCount > 1 ? "s" : ""}`}
                danger
            />
        </div>
    );
}
