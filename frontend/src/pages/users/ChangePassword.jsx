import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/auth.store";
import { api } from "../../api/fetch.instance";
import { MdLock, MdVisibility, MdVisibilityOff, MdArrowBack, MdCheckCircle } from "react-icons/md";

// FIX: PasswordInput was defined INSIDE ChangePassword, which caused React to
// treat it as a brand-new component type on every render (every keystroke).
// React would unmount + remount the input, instantly losing focus.
// Moving it outside the parent component fixes this — React now sees a stable
// component reference across renders and keeps the input mounted.
function PasswordInput({ label, field, value, onChange, show, onToggleShow }) {
    return (
        <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{label}</label>
            <div className="relative">
                <MdLock className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-lg pointer-events-none" />
                <input type={show ? "text" : "password"} required value={value} onChange={onChange} placeholder="••••••••" className="input-field pl-10 pr-10" />
                <button
                    type="button"
                    onClick={onToggleShow}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]
                        hover:text-[var(--text-primary)] transition-colors"
                >
                    {show ? <MdVisibilityOff className="text-lg" /> : <MdVisibility className="text-lg" />}
                </button>
            </div>
        </div>
    );
}

export default function ChangePassword() {
    const navigate = useNavigate();
    const currentUser = useAuthStore((s) => s.user);

    const [form, setForm] = useState({ old_password: "", new_password: "", confirm: "" });
    const [show, setShow] = useState({ old: false, new: false, confirm: false });
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    function setField(field) {
        return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
    }

    function toggleShow(field) {
        setShow((s) => ({ ...s, [field]: !s[field] }));
    }

    function validate() {
        if (form.new_password.length < 6) return "New password must be at least 6 characters.";
        if (form.new_password !== form.confirm) return "Passwords do not match.";
        if (form.new_password === form.old_password) return "New password must differ from current password.";
        return null;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const err = validate();
        if (err) {
            setError(err);
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
            setTimeout(() => navigate(-1), 2000);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    if (success)
        return (
            <div className="max-w-md mx-auto mt-16 text-center space-y-4">
                <div
                    className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30
                    flex items-center justify-center mx-auto"
                >
                    <MdCheckCircle className="text-green-500 text-4xl" />
                </div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Password Changed!</h2>
                <p className="text-sm text-[var(--text-muted)]">Redirecting back...</p>
            </div>
        );

    return (
        <div className="max-w-md mx-auto space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-[var(--bg-surface-2)] text-[var(--text-muted)] transition-colors">
                    <MdArrowBack className="text-lg" />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-[var(--text-primary)]">Change Password</h1>
                    <p className="text-sm text-[var(--text-muted)]">
                        {currentUser?.full_name} · {currentUser?.email}
                    </p>
                </div>
            </div>

            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-color)] shadow-sm p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div
                            className="px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200
                            dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400"
                        >
                            {error}
                        </div>
                    )}

                    <PasswordInput
                        label="Current password"
                        field="old"
                        value={form.old_password}
                        onChange={setField("old_password")}
                        show={show.old}
                        onToggleShow={() => toggleShow("old")}
                    />
                    <PasswordInput
                        label="New password (min. 6 characters)"
                        field="new"
                        value={form.new_password}
                        onChange={setField("new_password")}
                        show={show.new}
                        onToggleShow={() => toggleShow("new")}
                    />
                    <PasswordInput
                        label="Confirm new password"
                        field="confirm"
                        value={form.confirm}
                        onChange={setField("confirm")}
                        show={show.confirm}
                        onToggleShow={() => toggleShow("confirm")}
                    />

                    {/* Password strength hints */}
                    {form.new_password && (
                        <div className="space-y-1.5">
                            {[
                                { ok: form.new_password.length >= 6, label: "At least 6 characters" },
                                { ok: /[A-Z]/.test(form.new_password), label: "Contains uppercase letter" },
                                { ok: /[0-9]/.test(form.new_password), label: "Contains a number" },
                            ].map(({ ok, label }) => (
                                <div key={label} className="flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ok ? "bg-green-500" : "bg-gray-300"}`} />
                                    <span className={`text-xs ${ok ? "text-green-600" : "text-[var(--text-muted)]"}`}>{label}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
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
                            {loading ? "Changing..." : "Change password"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
