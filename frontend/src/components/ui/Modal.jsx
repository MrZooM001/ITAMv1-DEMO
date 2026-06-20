import { useEffect } from "react";
import { MdClose } from "react-icons/md";

export default function Modal({ open, onClose, title, children, size = "md" }) {
    useEffect(() => {
        if (!open) return;
        const handler = (e) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, onClose]);

    if (!open) return null;

    const sizeClass =
        {
            sm: "max-w-sm",
            md: "max-w-lg",
            lg: "max-w-2xl",
            xl: "max-w-4xl",
        }[size] ?? "max-w-lg";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            {/* Panel */}
            <div
                className={`relative w-full ${sizeClass} bg-[var(--bg-surface)]
        border border-[var(--border-color)] rounded-2xl shadow-2xl
        flex flex-col max-h-[90vh]`}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-6 py-4
          border-b border-[var(--border-color)] shrink-0"
                >
                    <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-[var(--text-muted)]
              hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)] transition-colors"
                    >
                        <MdClose className="text-lg" />
                    </button>
                </div>
                {/* Body */}
                <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
            </div>
        </div>
    );
}
