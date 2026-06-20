import { useState } from "react";
import Modal from "../../../components/ui/Modal";
import { useUpdateDeviceStatus } from "../hooks/useDevices";
import { MdCheckCircle } from "react-icons/md";

const STATUSES = [
    { value: "active", label: "Active", desc: "Device is operational", dot: "bg-green-500" },
    { value: "in_maintenance", label: "In Maintenance", desc: "Device is under repair or maintenance", dot: "bg-amber-400" },
    { value: "retired", label: "Retired", desc: "Device is decommissioned — open tickets will be cancelled", dot: "bg-gray-400" },
];

export default function DeviceStatusModal({ open, onClose, device }) {
    const [selected, setSelected] = useState(device?.status ?? "active");
    const [error, setError] = useState(null);
    const updateStatus = useUpdateDeviceStatus(device?.id);

    async function handleSave() {
        if (selected === device?.status) {
            onClose();
            return;
        }
        setError(null);
        try {
            await updateStatus.mutateAsync(selected);
            onClose();
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <Modal open={open} onClose={onClose} title="Change Device Status" size="sm">
            <div className="space-y-3">
                {error && <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
                {STATUSES.map((s) => (
                    <button
                        key={s.value}
                        onClick={() => setSelected(s.value)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all
              ${selected === s.value ? "border-blue-500 bg-blue-50" : "border-gray-100 hover:border-gray-200 bg-white"}`}
                    >
                        <span className={`w-3 h-3 rounded-full shrink-0 ${s.dot}`} />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800">{s.label}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
                        </div>
                        {selected === s.value && <MdCheckCircle className="text-blue-500 text-lg shrink-0" />}
                    </button>
                ))}
                <div className="flex gap-3 pt-2">
                    <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={updateStatus.isPending}
                        className="flex-1 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700
              disabled:bg-blue-400 text-white rounded-lg transition-colors"
                    >
                        {updateStatus.isPending ? "Saving..." : "Save status"}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
