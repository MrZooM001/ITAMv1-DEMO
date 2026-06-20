//
// Tenant registration page — publicly accessible only from the default
// tenant context. Collects organization name + slug + super-admin
// credentials, calls POST /auth/login (default tenant) then POST /tenants/.

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MdComputer, MdBusiness, MdEmail, MdLock, MdVisibility, MdVisibilityOff, MdCheckCircle, MdArrowBack } from "react-icons/md";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const DEFAULT_TENANT_SLUG = import.meta.env.VITE_DEFAULT_TENANT_SLUG ?? "default";

// Slug validation: lowercase letters, digits, hyphens; no leading/trailing hyphens
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

export default function Register() {
    const navigate = useNavigate();

    const [step, setStep] = useState("form"); // "form" | "success"
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showPass, setShowPass] = useState(false);

    // Super-admin credentials (must be a valid super-admin on the default tenant)
    const [adminCreds, setAdminCreds] = useState({ email: "", password: "" });

    // New tenant details
    const [tenant, setTenant] = useState({ name: "", slug: "" });
    const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

    const [createdTenant, setCreatedTenant] = useState(null);

    function handleNameChange(e) {
        const name = e.target.value;
        setTenant((prev) => ({
            ...prev,
            name,
            slug: slugManuallyEdited ? prev.slug : slugify(name),
        }));
    }

    function handleSlugChange(e) {
        setSlugManuallyEdited(true);
        setTenant((prev) => ({ ...prev, slug: slugify(e.target.value) }));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError(null);

        // Client-side validation
        if (!SLUG_REGEX.test(tenant.slug)) {
            setError("Slug must be lowercase letters, digits, and hyphens only.");
            return;
        }

        setLoading(true);
        try {
            // Step 1 — authenticate as super-admin on the default tenant
            const loginRes = await fetch(`${BASE_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: adminCreds.email,
                    password: adminCreds.password,
                    tenant_slug: DEFAULT_TENANT_SLUG,
                }),
            });

            if (!loginRes.ok) {
                const d = await loginRes.json().catch(() => ({}));
                throw new Error(d.detail ?? "Invalid super-admin credentials.");
            }

            const { access_token } = await loginRes.json();

            // Step 2 — create the new tenant
            const createRes = await fetch(`${BASE_URL}/tenants/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${access_token}`,
                },
                body: JSON.stringify({ name: tenant.name, slug: tenant.slug }),
            });

            if (!createRes.ok) {
                const d = await createRes.json().catch(() => ({}));
                // Handle pydantic validation errors array
                if (Array.isArray(d.detail)) {
                    const msgs = d.detail
                        .map((e) => {
                            const field = e.loc?.filter((l) => l !== "body").join(".") ?? "";
                            return field ? `${field}: ${e.msg}` : e.msg;
                        })
                        .join(" | ");
                    throw new Error(msgs);
                }
                throw new Error(typeof d.detail === "string" ? d.detail : "Failed to create tenant.");
            }

            const newTenant = await createRes.json();
            setCreatedTenant(newTenant);
            setStep("success");
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-[var(--bg-base)] flex">
            {/* ── Left decorative panel ─────────────────────── */}
            <div className="hidden lg:flex lg:w-1/2 bg-blue-600 flex-col items-center justify-center p-12 relative overflow-hidden">
                <div className="absolute -top-20 -left-20 w-96 h-96 bg-blue-500 rounded-full opacity-50" />
                <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-700 rounded-full opacity-40" />
                <div className="relative z-10 text-center">
                    <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <MdComputer className="text-white text-4xl" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-3">IT Assets</h1>
                    <p className="text-blue-100 text-lg">Management System</p>
                    <p className="text-blue-200 text-sm mt-4 max-w-xs mx-auto leading-relaxed">Set up a dedicated workspace for your organization in minutes.</p>
                </div>
            </div>

            {/* ── Right panel ───────────────────────────────── */}
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

                    {step === "form" ? (
                        <>
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)]
                  hover:text-[var(--text-primary)] transition-colors mb-6"
                            >
                                <MdArrowBack className="text-base" />
                                Back to sign in
                            </Link>

                            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Register your organization</h2>
                            <p className="text-[var(--text-muted)] text-sm mb-8">Super-admin authorization required to create a new tenant.</p>

                            {error && (
                                <div
                                    className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/30
                  border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400"
                                >
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-5">
                                {/* ─ Tenant details section ─ */}
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-3">Organization details</p>

                                    <div className="space-y-4">
                                        {/* Name */}
                                        <div>
                                            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Organization name</label>
                                            <div className="relative">
                                                <MdBusiness className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-lg" />
                                                <input
                                                    type="text"
                                                    required
                                                    minLength={2}
                                                    maxLength={200}
                                                    value={tenant.name}
                                                    onChange={handleNameChange}
                                                    placeholder="Acme Corporation"
                                                    className="input-field pl-10"
                                                />
                                            </div>
                                        </div>

                                        {/* Slug */}
                                        <div>
                                            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                                                Slug&nbsp;
                                                <span className="font-normal text-[var(--text-muted)]">(unique identifier)</span>
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                minLength={2}
                                                maxLength={100}
                                                value={tenant.slug}
                                                onChange={handleSlugChange}
                                                placeholder="acme-corp"
                                                className="input-field font-mono"
                                            />
                                            <p className="text-xs text-[var(--text-muted)] mt-1">Lowercase letters, digits, and hyphens only. Cannot be changed later.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* ─ Super-admin credentials section ─ */}
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-3">Super-admin credentials</p>

                                    <div className="space-y-4">
                                        {/* Email */}
                                        <div>
                                            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Email</label>
                                            <div className="relative">
                                                <MdEmail className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-lg" />
                                                <input
                                                    type="email"
                                                    required
                                                    value={adminCreds.email}
                                                    onChange={(e) => setAdminCreds({ ...adminCreds, email: e.target.value })}
                                                    placeholder="superadmin@default.com"
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
                                                    value={adminCreds.password}
                                                    onChange={(e) => setAdminCreds({ ...adminCreds, password: e.target.value })}
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
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                    text-white font-medium rounded-lg text-sm transition-colors"
                                >
                                    {loading ? "Creating organization…" : "Create organization"}
                                </button>
                            </form>
                        </>
                    ) : (
                        /* ── Success state ─────────────────────────── */
                        <div className="text-center">
                            <div
                                className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full
                flex items-center justify-center mx-auto mb-5"
                            >
                                <MdCheckCircle className="text-green-600 dark:text-green-400 text-4xl" />
                            </div>
                            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Organization created!</h2>
                            <p className="text-[var(--text-muted)] text-sm mb-6">
                                <strong className="text-[var(--text-primary)]">{createdTenant?.name}</strong> is ready. Share the slug below with the tenant admin so they can sign
                                in.
                            </p>

                            <div
                                className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg
                px-4 py-3 mb-6 text-left"
                            >
                                <p className="text-xs text-[var(--text-muted)] mb-1">Organization slug</p>
                                <p className="font-mono text-[var(--text-primary)] font-semibold">{createdTenant?.slug}</p>
                            </div>

                            <button
                                onClick={() => navigate("/login")}
                                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700
                  text-white font-medium rounded-lg text-sm transition-colors"
                            >
                                Back to sign in
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
