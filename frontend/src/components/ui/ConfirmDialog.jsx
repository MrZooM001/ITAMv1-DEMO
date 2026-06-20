import Modal from "./Modal";
import { MdWarning } from "react-icons/md";

export default function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title = "Are you sure?",
    message = "This action cannot be undone.",
    confirmLabel = "Delete",
    danger = true,
    loading = false,
}) {
    return (
        <Modal open={open} onClose={onClose} title={title} size="sm">
            <div className="flex flex-col items-center text-center gap-4">
                <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center
          ${danger ? "bg-red-100 dark:bg-red-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}
                >
                    <MdWarning className={`text-2xl ${danger ? "text-red-500" : "text-amber-500"}`} />
                </div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{message}</p>
                <div className="flex gap-3 w-full mt-1">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 text-sm border border-[var(--border-color)] rounded-lg
              text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className={`flex-1 py-2.5 text-sm font-medium rounded-lg text-white transition-colors
              ${danger ? "bg-red-500 hover:bg-red-600 disabled:bg-red-300" : "bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300"}`}
                    >
                        {loading ? "Please wait..." : confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
