import { useState } from "react";
import Modal from "../../../components/ui/Modal";
import { api } from "../../../api/fetch.instance";
import { useAuthStore } from "../../../store/auth.store";
import { MdVisibility, MdVisibilityOff, MdLock } from "react-icons/md";

// This modal handles TWO cases:
// 1. Admin changes another user's password via /users/:id (not in current API — using change-password)
// 2. User changes their own password via /auth/change-password
export default function ChangePasswordModal({ open, onClose, user, isSelf = false }) {
    const currentUser = useAuthStore((s) => s.user);
    const [form, setForm] = useState({ old_password: "", new_password: "", confirm: "" });
    const [show, setShow] = useState({ old: false, new: false });
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    function reset() {
        setForm({ old_password: "", new_password: "", confirm: "" });
        setError(null);
        setSuccess(false);
        setShow({ old: false, new: false });
    }

    function set(field) {
        return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (form.new_password !== form.confirm) {
            setError("New passwords do not match.");
            return;
        }
        if (form.new_password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }
        setError(null);
        setLoading(true);
        try {
            await api("/auth/change-password", {
                method: "PUT",
                body: JSON.stringify({
                    old_password: form.old_password,
                    new_password: form.new_password,
                }),
            });
            setSuccess(true);
            setTimeout(() => {
                reset();
                onClose();
            }, 1500);
        } catch (err) {
            setError(err.message);
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
            title="Change Password"
            size="sm"
        >
            {success ? (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                        <MdLock className="text-green-500 text-2xl" />
                    </div>
                    <p className="text-sm font-semibold text-gray-800">Password changed successfully!</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

                    {/* Old password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Current password</label>
                        <div className="relative">
                            <input
                                required
                                type={show.old ? "text" : "password"}
                                value={form.old_password}
                                onChange={set("old_password")}
                                placeholder="Current password"
                                className="input-field pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShow((s) => ({ ...s, old: !s.old }))}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {show.old ? <MdVisibilityOff className="text-lg" /> : <MdVisibility className="text-lg" />}
                            </button>
                        </div>
                    </div>

                    {/* New password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
                        <div className="relative">
                            <input
                                required
                                type={show.new ? "text" : "password"}
                                minLength={6}
                                value={form.new_password}
                                onChange={set("new_password")}
                                placeholder="Min. 6 characters"
                                className="input-field pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShow((s) => ({ ...s, new: !s.new }))}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {show.new ? <MdVisibilityOff className="text-lg" /> : <MdVisibility className="text-lg" />}
                            </button>
                        </div>
                    </div>

                    {/* Confirm */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm new password</label>
                        <input required type="password" value={form.confirm} onChange={set("confirm")} placeholder="Repeat new password" className="input-field" />
                    </div>

                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={() => {
                                reset();
                                onClose();
                            }}
                            className="flex-1 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700
                disabled:bg-blue-400 text-white rounded-lg transition-colors"
                        >
                            {loading ? "Saving..." : "Change password"}
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
}
