import { useState } from "react";
import Modal from "../../../components/ui/Modal";
import { api } from "../../../api/fetch.instance";
import { MdLock, MdVisibility, MdVisibilityOff, MdCheckCircle } from "react-icons/md";

// Admin resets another user's password via PUT /users/{id}/password
// Backend endpoint required: PUT /users/{id}/password { new_password: string }
export default function ResetPasswordModal({ open, onClose, user }) {
    const [newPass, setNewPass] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState(null);
    const [done, setDone] = useState(false);
    const [loading, setLoading] = useState(false);

    function reset() {
        setNewPass("");
        setError(null);
        setDone(false);
    }

    function generate() {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!";
        setNewPass(Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (newPass.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }
        setError(null);
        setLoading(true);
        try {
            await api(`/users/${user?.id}/password`, {
                method: "PUT",
                body: JSON.stringify({ new_password: newPass }),
            });
            setDone(true);
        } catch (err) {
            setError(err.message || "Failed to reset password.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Modal
            open={open}
            onClose={() => {
                reset();
                onClose();
            }}
            title={`Reset Password — ${user?.full_name}`}
            size="sm"
        >
            {done ? (
                <div className="space-y-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                        <MdCheckCircle className="text-green-500 text-2xl" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">Password reset!</p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">Share this password with the user securely:</p>
                    </div>
                    <div
                        className="flex items-center gap-2 px-4 py-3 bg-[var(--bg-surface-2)] rounded-xl font-mono text-sm
            text-[var(--text-primary)] border border-[var(--border-color)]"
                    >
                        <span className="flex-1 text-left">{newPass}</span>
                        <button type="button" onClick={() => navigator.clipboard.writeText(newPass)} className="text-xs text-blue-600 hover:underline shrink-0">
                            Copy
                        </button>
                    </div>
                    <p className="text-xs text-amber-600">⚠ Ask the user to change their password after logging in.</p>
                    <button
                        onClick={() => {
                            reset();
                            onClose();
                        }}
                        className="w-full py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                        Done
                    </button>
                </div>
            ) : (
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
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-sm font-medium text-[var(--text-primary)]">New password</label>
                            <button type="button" onClick={generate} className="text-xs text-blue-600 hover:underline">
                                Generate random
                            </button>
                        </div>
                        <div className="relative">
                            <MdLock className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-lg" />
                            <input
                                required
                                type={showPass ? "text" : "password"}
                                value={newPass}
                                onChange={(e) => setNewPass(e.target.value)}
                                placeholder="Min. 6 characters"
                                minLength={6}
                                className="input-field pl-10 pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass((s) => !s)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]
                  hover:text-[var(--text-primary)] transition-colors"
                            >
                                {showPass ? <MdVisibilityOff className="text-lg" /> : <MdVisibility className="text-lg" />}
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                reset();
                                onClose();
                            }}
                            className="flex-1 py-2.5 text-sm border border-[var(--border-color)] rounded-lg
                text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700
                disabled:bg-blue-400 text-white rounded-lg transition-colors"
                        >
                            {loading ? "Resetting..." : "Reset password"}
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
}
