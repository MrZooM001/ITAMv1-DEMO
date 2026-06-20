import { useState, useEffect, useRef, useMemo } from "react";
import Modal from "../../../components/ui/Modal";
import {
    useCreateDevice,
    useUpdateDevice,
    useAssignEmployee,
    useAssignDepartment,
    useDeviceTypes,
    useDeviceModels,
    useDeviceHardware,
    useUpdateHardware,
    deviceKeys,
} from "../hooks/useDevices";
import { useEmployees }   from "../../employees/hooks/useEmployees";
import { useDepartments } from "../../departments/hooks/useDepartments";
import { useAuthStore }   from "../../../store/auth.store";
import { useQueryClient } from "@tanstack/react-query";
import {
    MdUploadFile, MdCheckCircle, MdError,
    MdFolderOpen, MdArrowForward, MdArrowBack,
} from "react-icons/md";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// ── helpers ────────────────────────────────────────────────
function mb(val) {
    if (!val) return "";
    return val >= 1024
        ? `${(val / 1024).toFixed(val % 1024 === 0 ? 0 : 1)} GB`
        : `${val} MB`;
}

// ── File status icon ───────────────────────────────────────
const STATUS_ICON = {
    pending: <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />,
    loading: <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />,
    success: <MdCheckCircle className="text-green-500 text-base shrink-0" />,
    updated: <MdCheckCircle className="text-blue-500 text-base shrink-0" />,
    skipped: <MdError className="text-[var(--text-muted)] text-base shrink-0" />,
    error:   <MdError className="text-red-400 text-base shrink-0" />,
};

function ResultRow({ file, action, error }) {
    const status = error
        ? "error"
        : action === "created" ? "success"
        : action === "updated" ? "updated"
        : "pending";

    return (
        <div className="flex items-center gap-2 py-1.5 text-xs">
            {STATUS_ICON[status]}
            <span className={`flex-1 truncate ${error ? "text-red-500" : "text-[var(--text-secondary)]"}`}>
                {file}
            </span>
            {action && !error && (
                <span className={`shrink-0 font-medium capitalize
                    ${action === "created" ? "text-green-600"
                    : action === "updated" ? "text-blue-600"
                    : "text-[var(--text-muted)]"}`}>
                    {action}
                </span>
            )}
            {error && (
                <span className="text-red-400 shrink-0 max-w-[160px] truncate" title={error}>
                    {error}
                </span>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════
// STEP 1 — Bulk Import via POST /devices/bulk-import
// ═══════════════════════════════════════════════════════════
function Step1({ onNext, onAddComplete }) {
    const qc      = useQueryClient();
    const fileRef   = useRef(null);
    const folderRef = useRef(null);
    const token   = useAuthStore.getState().token;

    const { data: departments = [] } = useDepartments();

    const [files,   setFiles]   = useState([]);
    const [deptId,  setDeptId]  = useState("");
    const [results, setResults] = useState(null);
    const [running, setRunning] = useState(false);
    const [error,   setError]   = useState(null);

    // FIX: these two functions were duplicated outside Step1 as orphaned
    // module-level functions that referenced undefined variables (setFiles,
    // setResults, setError, setRunning, qc, token). Those outer copies caused
    // ReferenceError at runtime and contained dead JSX. Removed entirely —
    // only the correct versions inside Step1 remain.
    function handleFileChange(fileList) {
        const xmlFiles = Array.from(fileList).filter((f) => f.name.endsWith(".xml"));
        setFiles(xmlFiles);
        setResults(null);
        setError(null);
    }

    async function runImport() {
        if (!files.length || !deptId) return;
        setRunning(true);
        setError(null);
        setResults(null);

        try {
            const formData = new FormData();
            formData.append("department_id", deptId);
            for (const f of files) {
                formData.append("files", f, f.name);
            }

            const res = await fetch(`${BASE_URL}/devices/bulk-import`, {
                method:  "POST",
                headers: { Authorization: `Bearer ${token}` },
                body:    formData,
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(
                    Array.isArray(data.detail)
                        ? data.detail.map((e) => e.msg).join(" | ")
                        : (data.detail ?? "Import failed"),
                );
            }

            const data = await res.json();
            setResults(data);
            qc.invalidateQueries({ queryKey: deviceKeys.lists() });
            qc.invalidateQueries({ queryKey: ["departments"] });
            if (data.created > 0 || data.updated > 0) onAddComplete?.();
        } catch (err) {
            setError(err.message);
        } finally {
            setRunning(false);
        }
    }

    const canImport = files.length > 0 && !!deptId && !running;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                        Step 1 — Bulk Import from Speccy XML
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        Select a department, then upload XML files — device name = filename without .xml
                    </p>
                </div>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    1 of 2
                </span>
            </div>

            {/* Department selector */}
            {!results && (
                <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                        Target Department <span className="text-red-400">*</span>
                    </label>
                    <select
                        value={deptId}
                        onChange={(e) => setDeptId(e.target.value)}
                        className="input-field"
                    >
                        <option value="">— Select department —</option>
                        {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                        All imported devices will be assigned to this department.
                    </p>
                </div>
            )}

            {/* Drop zone */}
            {!results && (
                <>
                    <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); handleFileChange(e.dataTransfer.files); }}
                        className="border-2 border-dashed border-[var(--border-color)] rounded-xl p-8 text-center
                            hover:border-blue-300 hover:bg-blue-50/20 transition-colors cursor-default"
                    >
                        <MdUploadFile className="text-4xl text-[var(--text-muted)] mx-auto mb-2" />
                        <p className="text-sm text-[var(--text-muted)]">Drag & drop Speccy XML files here</p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">or use buttons below</p>
                    </div>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm
                                border border-[var(--border-color)] rounded-lg
                                hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] transition-colors"
                        >
                            <MdUploadFile className="text-base" /> Select files
                        </button>
                        <button
                            type="button"
                            onClick={() => folderRef.current?.click()}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm
                                border border-[var(--border-color)] rounded-lg
                                hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] transition-colors"
                        >
                            <MdFolderOpen className="text-base" /> Select folder
                        </button>
                    </div>

                    <input
                        ref={fileRef}
                        type="file"
                        accept=".xml"
                        multiple
                        className="hidden"
                        onChange={(e) => handleFileChange(e.target.files)}
                    />
                    <input
                        ref={folderRef}
                        type="file"
                        className="hidden"
                        webkitdirectory="true"
                        multiple
                        onChange={(e) => handleFileChange(e.target.files)}
                    />
                </>
            )}

            {/* Files preview */}
            {files.length > 0 && !results && (
                <div className="flex items-center justify-between px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                        {files.length} file{files.length > 1 ? "s" : ""} selected
                    </span>
                    <button
                        type="button"
                        onClick={() => { setFiles([]); setError(null); }}
                        className="text-xs text-blue-500 hover:text-blue-700"
                    >
                        Clear
                    </button>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200
                    dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}

            {/* Results */}
            {results && (
                <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                        {[
                            { label: "Created", value: results.created, color: "text-green-600 bg-green-50 dark:bg-green-900/20" },
                            { label: "Updated", value: results.updated, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20"   },
                            { label: "Errors",  value: results.errors,  color: "text-red-600 bg-red-50 dark:bg-red-900/20"     },
                        ].map(({ label, value, color }) => (
                            <div key={label} className={`rounded-xl px-3 py-2 ${color}`}>
                                <p className="text-xl font-bold">{value}</p>
                                <p className="text-xs">{label}</p>
                            </div>
                        ))}
                    </div>

                    {results.results?.length > 0 && (
                        <div className="border border-[var(--border-color)] rounded-xl overflow-hidden">
                            <div className="bg-[var(--bg-surface-2)] px-4 py-2 border-b border-[var(--border-color)]">
                                <span className="text-xs text-[var(--text-muted)] font-medium">
                                    {results.total} files processed
                                </span>
                            </div>
                            <div className="px-4 max-h-48 overflow-y-auto divide-y divide-[var(--border-color)]">
                                {results.results.map((r, i) => (
                                    <ResultRow key={i} {...r} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
                {files.length > 0 && !results && (
                    <button
                        type="button"
                        onClick={runImport}
                        disabled={!canImport}
                        className="flex-1 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700
                            disabled:bg-blue-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                    >
                        {running
                            ? "Importing..."
                            : !deptId
                                ? "Select a department first"
                                : `Import ${files.length} file${files.length > 1 ? "s" : ""}`}
                    </button>
                )}
                <button
                    type="button"
                    onClick={onNext}
                    className={`flex items-center justify-center gap-2 py-2.5 text-sm rounded-lg transition-colors
                        ${files.length > 0 && !results
                            ? "flex-none px-4 border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)]"
                            : "flex-1 font-medium bg-blue-600 hover:bg-blue-700 text-white"}`}
                >
                    <MdArrowForward className="text-base" />
                    {results ? "Add another manually →" : "Manual add →"}
                </button>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════
// STEP 2 — Manual Device + Hardware Edit Form
// ═══════════════════════════════════════════════════════════
const SPECCY_TYPES = ["pc", "laptop", "workstation", "server", "desktop"];
function isSpeccyType(name) {
    return SPECCY_TYPES.some((t) => name?.toLowerCase().includes(t));
}

const CUSTOM_FIELD_OPTIONS = [
    { key: "ram_gb",      label: "RAM (GB)",        type: "number"   },
    { key: "storage_gb",  label: "Storage (GB)",    type: "number"   },
    { key: "has_net",     label: "Has Network",     type: "checkbox" },
    { key: "ink_type",    label: "Ink / Toner",     type: "text"     },
    { key: "ppm",         label: "Speed (PPM)",     type: "number"   },
    { key: "dpi",         label: "Resolution (DPI)",type: "number"   },
    { key: "adf",         label: "ADF",             type: "checkbox" },
    { key: "duplex",      label: "Duplex",          type: "checkbox" },
    { key: "color",       label: "Color",           type: "checkbox" },
    { key: "ip_address",  label: "IP Address",      type: "text"     },
    { key: "mac_address", label: "MAC Address",     type: "text"     },
    { key: "firmware",    label: "Firmware",        type: "text"     },
];

function CustomFields({ fields, onChange, typeName }) {
    if (!typeName || isSpeccyType(typeName)) return null;
    const unused = CUSTOM_FIELD_OPTIONS.filter((o) => !fields.find((f) => f.key === o.key));

    return (
        <fieldset>
            <div className="flex items-center justify-between mb-3">
                <legend className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Additional Specs
                </legend>
                {unused.length > 0 && (
                    <select
                        defaultValue=""
                        onChange={(e) => {
                            if (!e.target.value) return;
                            const def = CUSTOM_FIELD_OPTIONS.find((o) => o.key === e.target.value);
                            onChange([...fields, { ...def, value: def.type === "checkbox" ? false : "" }]);
                            e.target.value = "";
                        }}
                        className="text-xs border border-dashed border-blue-300 rounded-lg
                            px-2 py-1 text-blue-600 bg-white cursor-pointer focus:outline-none"
                    >
                        <option value="">+ Add field</option>
                        {unused.map((o) => (
                            <option key={o.key} value={o.key}>{o.label}</option>
                        ))}
                    </select>
                )}
            </div>
            {fields.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] italic">
                    Use "+ Add field" to add specs for this device type.
                </p>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    {fields.map((f) => (
                        <div key={f.key} className="relative group">
                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                                {f.label}
                            </label>
                            {f.type === "checkbox" ? (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onChange(fields.map((x) => x.key === f.key ? { ...x, value: !x.value } : x))
                                        }
                                        className={`relative inline-flex h-5 w-9 rounded-full transition-colors
                                            ${f.value ? "bg-blue-600" : "bg-gray-300"}`}
                                    >
                                        <span className={`inline-block h-3.5 w-3.5 mt-0.5 transform rounded-full
                                            bg-white transition-transform
                                            ${f.value ? "translate-x-4" : "translate-x-0.5"}`}
                                        />
                                    </button>
                                    <span className="text-xs text-[var(--text-muted)]">
                                        {f.value ? "Yes" : "No"}
                                    </span>
                                </div>
                            ) : (
                                <input
                                    type={f.type}
                                    value={f.value}
                                    onChange={(e) =>
                                        onChange(fields.map((x) => x.key === f.key ? { ...x, value: e.target.value } : x))
                                    }
                                    className="input-field text-sm"
                                    placeholder={f.label}
                                />
                            )}
                            <button
                                type="button"
                                onClick={() => onChange(fields.filter((x) => x.key !== f.key))}
                                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-400
                                    text-white text-xs items-center justify-center hidden group-hover:flex leading-none"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </fieldset>
    );
}

// ── Speccy XML upload within edit form ─────────────────────
function SpeccyInlineUpload({ deviceId, onHardwareLoaded }) {
    const qc    = useQueryClient();
    const token = useAuthStore.getState().token;
    const fileRef = useRef(null);
    const [status, setStatus] = useState("idle"); // idle|loading|success|error
    const [errMsg, setErrMsg] = useState(null);

    async function handleFile(f) {
        if (!f || !f.name.endsWith(".xml")) return;
        setStatus("loading");
        setErrMsg(null);
        try {
            const formData = new FormData();
            formData.append("file", f);
            const res = await fetch(`${BASE_URL}/devices/${deviceId}/hardware`, {
                method:  "POST",
                headers: { Authorization: `Bearer ${token}` },
                body:    formData,
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(
                    Array.isArray(data.detail)
                        ? data.detail.map((e) => e.msg).join(", ")
                        : (data.detail ?? "Import failed"),
                );
            }
            const hw = await res.json();
            qc.invalidateQueries({ queryKey: deviceKeys.hardware(deviceId) });
            setStatus("success");
            onHardwareLoaded?.(hw);
        } catch (err) {
            setErrMsg(err.message);
            setStatus("error");
        }
    }

    return (
        <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all
                ${status === "success" ? "border-green-300 bg-green-50"
                : status === "error"   ? "border-red-200 bg-red-50"
                : status === "loading" ? "border-blue-200 bg-blue-50"
                : "border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50/30"}`}
            onClick={() => status !== "loading" && fileRef.current?.click()}
        >
            {status === "loading" && (
                <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
            )}
            {status === "success" && <MdCheckCircle className="text-green-500 text-xl shrink-0" />}
            {status === "error"   && <MdError       className="text-red-400   text-xl shrink-0" />}
            {status === "idle"    && <MdUploadFile  className="text-gray-300  text-xl shrink-0" />}

            <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium
                    ${status === "success" ? "text-green-700"
                    : status === "error"   ? "text-red-600"
                    : "text-[var(--text-muted)]"}`}>
                    {status === "idle"    && "Upload Speccy XML to auto-fill hardware fields"}
                    {status === "loading" && "Importing hardware data..."}
                    {status === "success" && "Hardware data loaded! Fields updated below."}
                    {status === "error"   && (errMsg ?? "Import failed")}
                </p>
                {status === "success" && (
                    <p className="text-xs text-green-600 mt-0.5">Review and save changes when ready.</p>
                )}
            </div>

            {status !== "loading" && (
                <span className="text-xs text-[var(--text-muted)] shrink-0">
                    Click to {status === "success" ? "re-upload" : "browse"}
                </span>
            )}
            <input
                ref={fileRef}
                type="file"
                accept=".xml"
                className="hidden"
                onChange={(e) => handleFile(e.target.files[0])}
            />
        </div>
    );
}

function Step2({ onBack, onDone, device, open }) {
    const isEdit = !!device;

    const { data: deviceTypes  = [] } = useDeviceTypes();
    const { data: deviceModels = [] } = useDeviceModels();
    const { data: employees    = [] } = useEmployees();
    const { data: departments  = [] } = useDepartments();
    const { data: existingHw }        = useDeviceHardware(device?.id);

    const create         = useCreateDevice();
    const update         = useUpdateDevice(device?.id);
    const updateHw       = useUpdateHardware(device?.id);
    const assignEmployee = useAssignEmployee(device?.id);
    const assignDept     = useAssignDepartment(device?.id);

    const [form, setForm] = useState({
        name: "", device_type_id: "", device_model_id: "", serial_number: "",
        department_id: "", employee_id: "", purchase_date: "",
        warranty_expiry: "", purchase_price: "", notes: "",
    });

    const [hw, setHw] = useState({
        cpu_model: "", cpu_cores: "", cpu_threads: "", cpu_speed_mhz: "",
        mb_manufacturer: "", mb_model: "", mb_bios_version: "", mb_bios_date: "",
        ram_total_mb: "", ram_type: "", ram_speed_mhz: "",
        ram_slots_total: "", ram_slots_used: "",
        gpu_model: "", gpu_manufacturer: "",
        eth_adapter: "", eth_mac: "", wifi_adapter: "", wifi_mac: "",
    });

    const [origAssign,   setOrigAssign]   = useState({ department_id: "", employee_id: "" });
    const [customFields, setCustomFields] = useState([]);
    const [error,        setError]        = useState(null);
    const [hwDirty,      setHwDirty]      = useState(false);

    const selectedTypeName = deviceTypes.find((t) => t.id === form.device_type_id)?.name ?? "";
    const showHwFields     = isEdit && isSpeccyType(selectedTypeName);
    const filteredModels   = deviceModels.filter(
        (m) => !form.device_type_id || m.device_type_id === form.device_type_id,
    );
    const filteredEmps = useMemo(
        () => form.department_id
            ? employees.filter((e) => e.is_active && e.department_id === form.department_id)
            : employees.filter((e) => e.is_active),
        [employees, form.department_id],
    );

    useEffect(() => {
        setError(null);
        setHwDirty(false);
        if (device) {
            setForm({
                name:            device.name            ?? "",
                device_type_id:  device.device_type_id  ?? "",
                device_model_id: device.device_model_id ?? "",
                serial_number:   device.serial_number   ?? "",
                department_id:   device.department_id   ?? "",
                employee_id:     device.employee_id     ?? "",
                purchase_date:   device.purchase_date   ?? "",
                warranty_expiry: device.warranty_expiry ?? "",
                purchase_price:  device.purchase_price  ? String(device.purchase_price) : "",
                notes:           device.notes           ?? "",
            });
            setOrigAssign({
                department_id: device.department_id ?? "",
                employee_id:   device.employee_id   ?? "",
            });
        } else {
            setForm({
                name: "", device_type_id: "", device_model_id: "", serial_number: "",
                department_id: "", employee_id: "", purchase_date: "",
                warranty_expiry: "", purchase_price: "", notes: "",
            });
            setOrigAssign({ department_id: "", employee_id: "" });
            setCustomFields([]);
        }
    }, [device?.id, open]);

    useEffect(() => {
        if (!existingHw) return;
        fillHwFromData(existingHw);
    }, [existingHw]);

    function fillHwFromData(data) {
        setHw({
            cpu_model:       data.cpu_model       ?? "",
            cpu_cores:       data.cpu_cores       ?? "",
            cpu_threads:     data.cpu_threads     ?? "",
            cpu_speed_mhz:   data.cpu_speed_mhz   ?? "",
            mb_manufacturer: data.mb_manufacturer ?? "",
            mb_model:        data.mb_model        ?? "",
            mb_bios_version: data.mb_bios_version ?? "",
            mb_bios_date:    data.mb_bios_date    ?? "",
            ram_total_mb:    data.ram_total_mb    ?? "",
            ram_type:        data.ram_type        ?? "",
            ram_speed_mhz:   data.ram_speed_mhz   ?? "",
            ram_slots_total: data.ram_slots_total ?? "",
            ram_slots_used:  data.ram_slots_used  ?? "",
            gpu_model:       data.gpu_model       ?? "",
            gpu_manufacturer:data.gpu_manufacturer?? "",
            eth_adapter:     data.eth_adapter     ?? "",
            eth_mac:         data.eth_mac         ?? "",
            wifi_adapter:    data.wifi_adapter    ?? "",
            wifi_mac:        data.wifi_mac        ?? "",
        });
    }

    function setF(field) {
        return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
    }
    function setH(field) {
        return (e) => {
            setHw((h) => ({ ...h, [field]: e.target.value }));
            setHwDirty(true);
        };
    }

    function handleHardwareLoaded(data) {
        fillHwFromData(data);
        setHwDirty(false);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError(null);

        const payload = {
            name:            form.name,
            device_type_id:  form.device_type_id,
            device_model_id: form.device_model_id || null,
            serial_number:   form.serial_number   || null,
            purchase_date:   form.purchase_date   || null,
            warranty_expiry: form.warranty_expiry || null,
            purchase_price:  form.purchase_price  ? Number(form.purchase_price) : null,
            notes:           form.notes           || null,
        };

        try {
            if (isEdit) {
                await update.mutateAsync(payload);

                if (form.employee_id && form.employee_id !== origAssign.employee_id)
                    await assignEmployee.mutateAsync(form.employee_id);
                else if (form.department_id && !form.employee_id && form.department_id !== origAssign.department_id)
                    await assignDept.mutateAsync(form.department_id);

                if (hwDirty && showHwFields) {
                    const NUM = ["cpu_cores","cpu_threads","cpu_speed_mhz","ram_total_mb",
                                 "ram_speed_mhz","ram_slots_total","ram_slots_used"];
                    const hwPayload = {};
                    for (const [k, v] of Object.entries(hw)) {
                        hwPayload[k] = v === "" ? null : NUM.includes(k) ? (v ? Number(v) : null) : v;
                    }
                    await updateHw.mutateAsync(hwPayload);
                }
            } else {
                await create.mutateAsync({
                    ...payload,
                    department_id: form.department_id || null,
                    employee_id:   form.employee_id   || null,
                });
            }
            onDone();
        } catch (err) {
            setError(err.message);
        }
    }

    const loading = create.isPending || update.isPending ||
                    assignEmployee.isPending || assignDept.isPending || updateHw.isPending;

    function HwField({ label, field, type = "text", placeholder }) {
        return (
            <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{label}</label>
                <input
                    type={type}
                    value={hw[field]}
                    onChange={setH(field)}
                    placeholder={placeholder ?? label}
                    className="input-field text-sm"
                />
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-center justify-between">
                {!isEdit && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    >
                        <MdArrowBack className="text-base" /> Back
                    </button>
                )}
                {!isEdit && (
                    <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        2 of 2
                    </span>
                )}
            </div>

            {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                    {error}
                </div>
            )}

            {/* Speccy upload (edit + speccy-type only) */}
            {isEdit && showHwFields && (
                <div>
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                        Hardware — Import from Speccy
                    </p>
                    <SpeccyInlineUpload deviceId={device?.id} onHardwareLoaded={handleHardwareLoaded} />
                </div>
            )}

            {/* ── Device info ──────────────────────────────── */}
            <fieldset>
                <legend className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                    Device Information
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                            Device name <span className="text-red-400">*</span>
                        </label>
                        <input
                            required
                            value={form.name}
                            onChange={setF("name")}
                            placeholder="e.g. DESKTOP-IT-001"
                            className="input-field"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                            Device type <span className="text-red-400">*</span>
                        </label>
                        <select
                            required
                            value={form.device_type_id}
                            onChange={(e) => setForm((f) => ({ ...f, device_type_id: e.target.value, device_model_id: "" }))}
                            className="input-field"
                        >
                            <option value="">— Select type —</option>
                            {deviceTypes.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                            Device model
                        </label>
                        <select value={form.device_model_id} onChange={setF("device_model_id")} className="input-field">
                            <option value="">— Select model —</option>
                            {filteredModels.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {[m.manufacturer, m.model_name].filter(Boolean).join(" ")}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                            Serial number
                        </label>
                        <input
                            value={form.serial_number}
                            onChange={setF("serial_number")}
                            placeholder="e.g. SN123456789"
                            className="input-field"
                        />
                    </div>
                </div>
            </fieldset>

            <CustomFields fields={customFields} onChange={setCustomFields} typeName={selectedTypeName} />

            {/* ── Hardware fields (edit + speccy type only) ── */}
            {showHwFields && (
                <fieldset>
                    <legend className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                        Hardware Specs
                        {hwDirty && (
                            <span className="ml-2 text-blue-500 normal-case font-normal">
                                (modified — will save on submit)
                            </span>
                        )}
                    </legend>
                    <div className="space-y-4">
                        <div>
                            <p className="text-xs font-medium text-[var(--text-muted)] mb-2 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" /> CPU
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <HwField label="Model"       field="cpu_model"     />
                                <HwField label="Cores"       field="cpu_cores"     type="number" />
                                <HwField label="Threads"     field="cpu_threads"   type="number" />
                                <HwField label="Speed (MHz)" field="cpu_speed_mhz" type="number" />
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-[var(--text-muted)] mb-2 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" /> Motherboard
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <HwField label="Manufacturer" field="mb_manufacturer" />
                                <HwField label="Model"        field="mb_model"        />
                                <HwField label="BIOS Version" field="mb_bios_version" />
                                <HwField label="BIOS Date"    field="mb_bios_date" type="date" />
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-[var(--text-muted)] mb-2 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> RAM
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                <HwField label="Total (MB)"  field="ram_total_mb"   type="number" />
                                <HwField label="Type"        field="ram_type"       placeholder="DDR4" />
                                <HwField label="Speed (MHz)" field="ram_speed_mhz"  type="number" />
                                <HwField label="Slots total" field="ram_slots_total" type="number" />
                                <HwField label="Slots used"  field="ram_slots_used"  type="number" />
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-[var(--text-muted)] mb-2 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" /> GPU
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
                                <HwField label="Manufacturer" field="gpu_manufacturer" />
                                <HwField label="Model"        field="gpu_model"        />
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-[var(--text-muted)] mb-2 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" /> Network
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <HwField label="ETH Adapter"  field="eth_adapter"  />
                                <HwField label="ETH MAC"      field="eth_mac"      placeholder="XX:XX:XX:XX:XX:XX" />
                                <HwField label="WiFi Adapter" field="wifi_adapter" />
                                <HwField label="WiFi MAC"     field="wifi_mac"     placeholder="XX:XX:XX:XX:XX:XX" />
                            </div>
                        </div>
                    </div>
                </fieldset>
            )}

            {/* ── Assignment ───────────────────────────────── */}
            <fieldset>
                <legend className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                    Assignment
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                            Department
                        </label>
                        <select
                            value={form.department_id}
                            onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value, employee_id: "" }))}
                            className="input-field"
                        >
                            <option value="">— No department —</option>
                            {departments.map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                            Employee{" "}
                            {form.department_id && (
                                <span className="text-xs text-[var(--text-muted)] font-normal">
                                    ({filteredEmps.length} in dept)
                                </span>
                            )}
                        </label>
                        <select value={form.employee_id} onChange={setF("employee_id")} className="input-field">
                            <option value="">— Unassigned —</option>
                            {filteredEmps.map((e) => (
                                <option key={e.id} value={e.id}>{e.full_name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </fieldset>

            {/* ── Purchase & Warranty ──────────────────────── */}
            <fieldset>
                <legend className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                    Purchase & Warranty
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                            Purchase date
                        </label>
                        <input type="date" value={form.purchase_date} onChange={setF("purchase_date")} className="input-field" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                            Warranty expiry
                        </label>
                        <input type="date" value={form.warranty_expiry} onChange={setF("warranty_expiry")} className="input-field" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                            Price ($)
                        </label>
                        <input
                            type="number" min="0" step="0.01"
                            value={form.purchase_price}
                            onChange={setF("purchase_price")}
                            placeholder="0.00"
                            className="input-field"
                        />
                    </div>
                </div>
            </fieldset>

            <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Notes</label>
                <textarea
                    rows={2}
                    value={form.notes}
                    onChange={setF("notes")}
                    placeholder="Optional notes..."
                    className="input-field resize-none"
                />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
                <button
                    type="button"
                    onClick={onDone}
                    className="flex-1 py-2.5 text-sm border border-[var(--border-color)] rounded-lg
                        text-[var(--text-secondary)] hover:bg-gray-50 transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700
                        disabled:bg-blue-400 text-white rounded-lg transition-colors"
                >
                    {loading ? "Saving..." : isEdit ? "Save changes" : "Add device"}
                </button>
            </div>
        </form>
    );
}

// ═══════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════
export default function DeviceForm({ open, onClose, device = null }) {
    const isEdit = !!device;
    const [step, setStep] = useState(1);

    useEffect(() => {
        if (open) setStep(isEdit ? 2 : 1);
    }, [open, isEdit]);

    return (
        <Modal open={open} onClose={onClose} title={isEdit ? "Edit Device" : "Add Device"} size="lg">
            {step === 1 && !isEdit && (
                <Step1 onNext={() => setStep(2)} onAddComplete={() => {}} />
            )}
            {(step === 2 || isEdit) && (
                <Step2 onBack={() => setStep(1)} onDone={onClose} device={device} open={open} />
            )}
        </Modal>
    );
}
