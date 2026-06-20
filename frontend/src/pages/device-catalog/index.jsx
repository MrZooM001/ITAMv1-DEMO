import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDeviceTypes, useDeviceModels, deviceKeys } from "../../features/devices/hooks/useDevices";
import { api } from "../../api/fetch.instance";
import { DeviceTypeForm, DeviceModelForm } from "../../features/devices/components/DeviceTypeModelForms";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { MdAdd, MdEdit, MdDelete, MdDevices, MdCategory } from "react-icons/md";

// ── Inline edit/delete for a type row ─────────────────────
function TypeRow({ type, onEdit, onDelete }) {
    return (
        <div
            className="flex items-center justify-between px-4 py-3 border-b border-gray-50
      last:border-0 hover:bg-gray-50/50 transition-colors group"
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <MdDevices className="text-blue-500 text-sm" />
                </div>
                <span className="text-sm font-medium text-gray-800">{type.name}</span>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEdit(type)} className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                    <MdEdit className="text-base" />
                </button>
                <button onClick={() => onDelete(type)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                    <MdDelete className="text-base" />
                </button>
            </div>
        </div>
    );
}

// ── Inline model row ──────────────────────────────────────
function ModelRow({ model, typeName, onEdit, onDelete }) {
    return (
        <div
            className="flex items-center justify-between px-4 py-3 border-b border-gray-50
      last:border-0 hover:bg-gray-50/50 transition-colors group"
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                    <MdCategory className="text-purple-500 text-sm" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{[model.manufacturer, model.model_name].filter(Boolean).join(" ")}</p>
                    <p className="text-xs text-gray-400">{typeName ?? "—"}</p>
                </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEdit(model)} className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                    <MdEdit className="text-base" />
                </button>
                <button onClick={() => onDelete(model)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                    <MdDelete className="text-base" />
                </button>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────
export default function DeviceCatalog() {
    const qc = useQueryClient();
    const { data: types = [] } = useDeviceTypes();
    const { data: models = [] } = useDeviceModels();

    const [typeFormOpen, setTypeFormOpen] = useState(false);
    const [modelFormOpen, setModelFormOpen] = useState(false);
    const [editType, setEditType] = useState(null);
    const [editModel, setEditModel] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null); // { kind, item }
    const [deleteErr, setDeleteErr] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Filter models by type for grouped display
    const [activeType, setActiveType] = useState(null);
    const filteredModels = activeType ? models.filter((m) => m.device_type_id === activeType) : models;

    async function handleDelete() {
        if (!deleteTarget) return;
        setDeleteErr(null);
        setDeleteLoading(true);
        const { kind, item } = deleteTarget;
        try {
            const endpoint = kind === "type" ? `/devices/types/${item.id}` : `/devices/models/${item.id}`;
            await api(endpoint, { method: "DELETE" });
            qc.invalidateQueries({ queryKey: kind === "type" ? deviceKeys.types() : deviceKeys.models() });
            setDeleteTarget(null);
        } catch (err) {
            setDeleteErr(err.message);
        } finally {
            setDeleteLoading(false);
        }
    }

    return (
        <div className="max-w-5xl mx-auto space-y-5">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold text-gray-900">Device Catalog</h1>
                <p className="text-sm text-gray-400 mt-0.5">Manage device types and models</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* ── Device Types ──────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-800">Device Types</h2>
                            <p className="text-xs text-gray-400 mt-0.5">{types.length} types</p>
                        </div>
                        <button
                            onClick={() => {
                                setEditType(null);
                                setTypeFormOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700
                text-white rounded-lg transition-colors"
                        >
                            <MdAdd className="text-base" /> Add Type
                        </button>
                    </div>

                    {types.length === 0 ? (
                        <div className="py-10 text-center text-sm text-gray-400">No device types yet.</div>
                    ) : (
                        <div>
                            {types.map((t) => (
                                <TypeRow
                                    key={t.id}
                                    type={t}
                                    onEdit={(t) => {
                                        setEditType(t);
                                        setTypeFormOpen(true);
                                    }}
                                    onDelete={(t) => {
                                        setDeleteErr(null);
                                        setDeleteTarget({ kind: "type", item: t });
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Device Models ─────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-800">Device Models</h2>
                            <p className="text-xs text-gray-400 mt-0.5">{models.length} models</p>
                        </div>
                        <button
                            onClick={() => {
                                setEditModel(null);
                                setModelFormOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700
                text-white rounded-lg transition-colors"
                        >
                            <MdAdd className="text-base" /> Add Model
                        </button>
                    </div>

                    {/* Filter by type */}
                    {types.length > 0 && (
                        <div className="flex gap-2 px-4 py-2 border-b border-gray-50 overflow-x-auto">
                            <button
                                onClick={() => setActiveType(null)}
                                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors
                  ${!activeType ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                            >
                                All
                            </button>
                            {types.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => setActiveType(activeType === t.id ? null : t.id)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors
                    ${activeType === t.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                                >
                                    {t.name}
                                </button>
                            ))}
                        </div>
                    )}

                    {filteredModels.length === 0 ? (
                        <div className="py-10 text-center text-sm text-gray-400">No models found.</div>
                    ) : (
                        <div className="max-h-[500px] overflow-y-auto">
                            {filteredModels.map((m) => (
                                <ModelRow
                                    key={m.id}
                                    model={m}
                                    typeName={types.find((t) => t.id === m.device_type_id)?.name}
                                    onEdit={(m) => {
                                        setEditModel(m);
                                        setModelFormOpen(true);
                                    }}
                                    onDelete={(m) => {
                                        setDeleteErr(null);
                                        setDeleteTarget({ kind: "model", item: m });
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <DeviceTypeForm
                open={typeFormOpen}
                onClose={() => {
                    setTypeFormOpen(false);
                    setEditType(null);
                }}
                type={editType}
            />
            <DeviceModelForm
                open={modelFormOpen}
                onClose={() => {
                    setModelFormOpen(false);
                    setEditModel(null);
                }}
                model={editModel}
            />
            <ConfirmDialog
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                loading={deleteLoading}
                title={`Delete ${deleteTarget?.kind === "type" ? "Device Type" : "Device Model"}`}
                message={deleteErr ?? `Delete "${deleteTarget?.item?.name ?? deleteTarget?.item?.model_name}"? This cannot be undone.`}
                danger
            />
        </div>
    );
}
