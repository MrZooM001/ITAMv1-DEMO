import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/auth.store";
import { queryClient } from "../../api/queryClient";
import { MdComputer, MdEmail, MdLock, MdVisibility, MdVisibilityOff } from "react-icons/md";
import logo from "../../assets/itam-logo.png";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const setAuth = useAuthStore((s) => s.setAuth);
    const setIsPlatformAdmin = useAuthStore((s) => s.setIsPlatformAdmin);
    const from = location.state?.from?.pathname ?? "/dashboard";

    // v5 backend: LoginRequest is email + password only — no tenant_slug.
    // Email is unique platform-wide, so the backend alone resolves the tenant.
    const [form, setForm] = useState({ email: "", password: "" });
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${BASE_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.detail ?? "Invalid credentials");
            }
            const data = await res.json();
            const meRes = await fetch(`${BASE_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${data.access_token}` },
            });
            const user = await meRes.json();

            queryClient.clear();
            setAuth(user, data.access_token, data.refresh_token);

            // The backend deliberately never exposes a "you are the platform
            // tenant" flag (see app/schemas/user.py — tenant_name only, by
            // design). So we discover it empirically: probe a cheap
            // platform-only endpoint and remember whether it succeeded. A 403
            // here just means "not a platform admin" — it's expected, not an
            // error, so we don't surface it to the user.
            try {
                const probeRes = await fetch(`${BASE_URL}/tenants/?page_size=1`, {
                    headers: { Authorization: `Bearer ${data.access_token}` },
                });
                setIsPlatformAdmin(probeRes.ok);
            } catch {
                setIsPlatformAdmin(false);
            }

            navigate(from, { replace: true });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-[var(--bg-base)] flex">
            {/* Left decorative panel */}
            <div className="hidden lg:flex lg:w-1/2 bg-blue-600 flex-col items-center justify-center p-12 relative overflow-hidden">
                <div className="absolute -top-20 -left-20 w-96 h-96 bg-blue-500 rounded-full opacity-50" />
                <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-700 rounded-full opacity-40" />
                <div className="relative z-10 text-center">
                    <div className="w-32 h-32 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 p-6">
                        <img src={logo} alt="logo" className="scale-125 select-none" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-3">IT Assets</h1>
                    <p className="text-blue-100 text-lg">Management System</p>
                    <p className="text-blue-200 text-sm mt-4 max-w-xs mx-auto leading-relaxed">
                        Manage your organization's devices, tickets, inventory, and more — all in one place.
                    </p>
                </div>
            </div>

            {/* Right login form */}
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-sm">
                    {/* Mobile logo */}
                    <div className="flex items-center gap-3 mb-8 lg:hidden">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                            <MdComputer className="text-white text-xl" />
                        </div>
                        <div>
                            <p className="font-bold text-[var(--text-primary)]">IT Assets</p>
                            <p className="text-xs text-[var(--text-muted)]">Management System</p>
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Welcome back</h2>
                    <p className="text-[var(--text-muted)] text-sm mb-8">Sign in to your account</p>

                    {error && (
                        <div
                            className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/30
              border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400"
                        >
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Email</label>
                            <div className="relative">
                                <MdEmail className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-lg" />
                                <input
                                    type="email"
                                    required
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    placeholder="you@company.com"
                                    className="input-field pl-10"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Password</label>
                            <div className="relative">
                                <MdLock className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-lg" />
                                <input
                                    type={showPass ? "text" : "password"}
                                    required
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    placeholder="••••••••"
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

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                text-white font-medium rounded-lg text-sm transition-colors mt-2"
                        >
                            {loading ? "Signing in..." : "Sign in"}
                        </button>
                    </form>

                    {/* Demo credentials helper — public demo only */}
                    <div className="mt-6 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
                        <p className="font-medium text-[var(--text-primary)] mb-2">🚀 Try the live demo</p>
                        <p className="text-[var(--text-muted)] text-xs mb-2">
                            Email: <span className="font-mono">admin@demo.com</span> &nbsp;·&nbsp; Password: <span className="font-mono">Demo@1234</span>
                        </p>
                        <button
                            type="button"
                            onClick={() => setForm({ email: "admin@demo.com", password: "Demo@1234" })}
                            className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium"
                        >
                            Fill demo credentials
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
