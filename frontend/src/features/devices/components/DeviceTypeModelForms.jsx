import { useState, useEffect } from "react";
import Modal from "../../../components/ui/Modal";
import { useDeviceTypes, useDeviceModels, useUpdateDeviceType, useDeleteDeviceType, useUpdateDeviceModel, useDeleteDeviceModel, deviceKeys } from "../hooks/useDevices";
import { api } from "../../../api/fetch.instance";
import { useQueryClient } from "@tanstack/react-query";

// ── Device Type Form ──────────────────────────────────────
export function DeviceTypeForm({ open, onClose, type = null }) {
    const isEdit = !!type;
    const qc = useQueryClient();
    const updateType = useUpdateDeviceType();
    const [name, setName] = useState("");
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setName(type?.name ?? "");
        setError(null);
    }, [type, open]);

    async function handleSubmit(e) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            if (isEdit) {
                await updateType.mutateAsync({ id: type.id, data: { name } });
            } else {
                await api("/devices/types", { method: "POST", body: JSON.stringify({ name }) });
                qc.invalidateQueries({ queryKey: deviceKeys.types() });
            }
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Modal open={open} onClose={onClose} title={isEdit ? "Edit Device Type" : "Add Device Type"} size="sm">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div
                        className="px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800
            rounded-lg text-sm text-red-600 dark:text-red-400"
                    >
                        {error}
                    </div>
                )}
                <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                        Type name <span className="text-red-400">*</span>
                    </label>
                    <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. PC, Laptop, Printer" className="input-field" />
                </div>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2.5 text-sm border border-[var(--border-color)] rounded-lg
              text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading || updateType.isPending}
                        className="flex-1 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700
              disabled:bg-blue-400 text-white rounded-lg transition-colors"
                    >
                        {loading ? "Saving..." : isEdit ? "Save changes" : "Add type"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

// ── Device Model Form ─────────────────────────────────────
export function DeviceModelForm({ open, onClose, model = null }) {
    const isEdit = !!model;
    const qc = useQueryClient();
    const updateModel = useUpdateDeviceModel();
    const { data: deviceTypes = [] } = useDeviceTypes();

    const [form, setForm] = useState({ device_type_id: "", manufacturer: "", model_name: "" });
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setForm({
            device_type_id: model?.device_type_id ?? "",
            manufacturer: model?.manufacturer ?? "",
            model_name: model?.model_name ?? "",
        });
        setError(null);
    }, [model, open]);

    async function handleSubmit(e) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        const payload = { ...form, manufacturer: form.manufacturer || null };
        try {
            if (isEdit) {
                await updateModel.mutateAsync({ id: model.id, data: payload });
            } else {
                await api("/devices/models", { method: "POST", body: JSON.stringify(payload) });
                qc.invalidateQueries({ queryKey: deviceKeys.models() });
            }
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Modal open={open} onClose={onClose} title={isEdit ? "Edit Device Model" : "Add Device Model"} size="sm">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div
                        className="px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800
            rounded-lg text-sm text-red-600 dark:text-red-400"
                    >
                        {error}
                    </div>
                )}
                <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                        Device type <span className="text-red-400">*</span>
                    </label>
                    <select required value={form.device_type_id} onChange={(e) => setForm((f) => ({ ...f, device_type_id: e.target.value }))} className="input-field">
                        <option value="">— Select type —</option>
                        {deviceTypes.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Manufacturer</label>
                    <input
                        value={form.manufacturer}
                        onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))}
                        placeholder="e.g. Dell, HP"
                        className="input-field"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                        Model name <span className="text-red-400">*</span>
                    </label>
                    <input
                        required
                        value={form.model_name}
                        onChange={(e) => setForm((f) => ({ ...f, model_name: e.target.value }))}
                        placeholder="e.g. OptiPlex 990"
                        className="input-field"
                    />
                </div>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2.5 text-sm border border-[var(--border-color)] rounded-lg
              text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading || updateModel.isPending}
                        className="flex-1 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700
              disabled:bg-blue-400 text-white rounded-lg transition-colors"
                    >
                        {loading ? "Saving..." : isEdit ? "Save changes" : "Add model"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
