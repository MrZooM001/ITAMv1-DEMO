import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdAdd,
  MdSearch,
  MdDomain,
  MdCheckCircle,
  MdCancel,
  MdClose,
  MdBusiness,
  MdRefresh,
} from "react-icons/md";
import {
  getTenants,
  createTenant,
  updateTenant,
} from "../../features/tenants/api/tenants.api";

const PAGE_SIZE = 15;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ── Helpers ────────────────────────────────────────────────

function slugify(v) {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function StatusBadge({ isActive }) {
  return isActive ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
      <MdCheckCircle className="text-sm" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
      <MdCancel className="text-sm" /> Inactive
    </span>
  );
}

// ── Register modal ─────────────────────────────────────────

function RegisterModal({ onClose, onCreated }) {
  const [form, setForm]           = useState({ name: "", slug: "" });
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  function handleNameChange(e) {
    const name = e.target.value;
    setForm((f) => ({ name, slug: slugTouched ? f.slug : slugify(name) }));
  }

  function handleSlugChange(e) {
    setSlugTouched(true);
    setForm((f) => ({ ...f, slug: slugify(e.target.value) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!SLUG_REGEX.test(form.slug)) {
      setError("Slug must contain only lowercase letters, digits, and hyphens.");
      return;
    }
    setLoading(true);
    try {
      const tenant = await createTenant(form);
      onCreated(tenant);
    } catch (err) {
      setError(err.message ?? "Failed to create tenant.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <MdDomain className="text-blue-600 dark:text-blue-400 text-lg" />
            </div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Register new tenant</h2>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <MdClose className="text-xl" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              Organization name
            </label>
            <div className="relative">
              <MdBusiness className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-lg" />
              <input
                type="text" required minLength={2} maxLength={200}
                value={form.name} onChange={handleNameChange}
                placeholder="Acme Corporation"
                className="input-field pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              Slug{" "}
              <span className="font-normal text-[var(--text-muted)]">— cannot be changed later</span>
            </label>
            <input
              type="text" required minLength={2} maxLength={100}
              value={form.slug} onChange={handleSlugChange}
              placeholder="acme-corp"
              className="input-field font-mono"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Lowercase letters, digits, and hyphens only.
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-[var(--border-color)] text-[var(--text-secondary)]
                hover:bg-[var(--bg-surface-2)] rounded-lg text-sm font-medium transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                text-white rounded-lg text-sm font-medium transition-colors">
              {loading ? "Creating…" : "Create tenant"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────

export default function TenantList() {
  const navigate = useNavigate();

  const [tenants, setTenants]         = useState([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState("");
  const [filterActive, setFilterActive] = useState("all"); // "all" | "active" | "inactive"
  const [loading, setLoading]         = useState(true);
  const [togglingId, setTogglingId]   = useState(null);
  const [error, setError]             = useState(null);
  const [showModal, setShowModal]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const isActive =
        filterActive === "active" ? true : filterActive === "inactive" ? false : undefined;
      const data = await getTenants({ page, page_size: PAGE_SIZE, is_active: isActive });
      setTenants(data.items ?? data);
      setTotal(data.total ?? (data.items ?? data).length);
    } catch (err) {
      setError(err.message ?? "Failed to load tenants.");
    } finally {
      setLoading(false);
    }
  }, [page, filterActive]);

  useEffect(() => { load(); }, [load]);

  // Client-side search on the loaded page
  const filtered = tenants.filter(
    (t) =>
      search === "" ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase())
  );

  async function handleToggleActive(e, tenant) {
    e.stopPropagation();
    setTogglingId(tenant.id);
    try {
      await updateTenant(tenant.id, { is_active: !tenant.is_active });
      await load();
    } catch {
      // TODO: surface toast
    } finally {
      setTogglingId(null);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Tenants</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Manage client organizations and their access.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load}
            className="p-2 rounded-lg border border-[var(--border-color)] text-[var(--text-muted)]
              hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] transition-colors">
            <MdRefresh className={`text-lg ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700
              text-white text-sm font-medium rounded-lg transition-colors shrink-0">
            <MdAdd className="text-lg" />
            Register tenant
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-lg" />
          <input
            type="text" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or slug…"
            className="input-field pl-10 text-sm"
          />
        </div>
        <div className="flex gap-1 bg-[var(--bg-surface-2)] rounded-lg p-1">
          {[["all", "All"], ["active", "Active"], ["inactive", "Inactive"]].map(([val, label]) => (
            <button key={val}
              onClick={() => { setFilterActive(val); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filterActive === val
                  ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading && tenants.length === 0 ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-20 text-red-500 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <MdDomain className="text-5xl text-[var(--text-muted)] opacity-30" />
          <p className="text-[var(--text-muted)] text-sm">
            {search ? "No tenants match your search." : "No tenants yet."}
          </p>
          {!search && (
            <button onClick={() => setShowModal(true)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors">
              Register the first one
            </button>
          )}
        </div>
      ) : (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-surface-2)]">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Organization</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Slug</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Registered</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {filtered.map((tenant) => (
                <tr key={tenant.id}
                  onClick={() => navigate(`/tenants/${tenant.id}`)}
                  className="hover:bg-[var(--bg-surface-2)] cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30
                        flex items-center justify-center shrink-0">
                        <MdDomain className="text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="font-medium text-[var(--text-primary)]">{tenant.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{tenant.slug}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {new Date(tenant.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge isActive={tenant.is_active} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      disabled={togglingId === tenant.id}
                      onClick={(e) => handleToggleActive(e, tenant)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors
                        disabled:opacity-40 disabled:cursor-not-allowed ${
                        tenant.is_active
                          ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          : "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                      }`}>
                      {togglingId === tenant.id
                        ? "…"
                        : tenant.is_active
                        ? "Deactivate"
                        : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-color)]">
              <p className="text-xs text-[var(--text-muted)]">
                {total} tenant{total !== 1 ? "s" : ""} total
              </p>
              <div className="flex gap-1">
                <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 text-xs rounded-md border border-[var(--border-color)]
                    disabled:opacity-40 hover:bg-[var(--bg-surface-2)] transition-colors">
                  Previous
                </button>
                <span className="px-3 py-1.5 text-xs text-[var(--text-muted)]">
                  {page} / {totalPages}
                </span>
                <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 text-xs rounded-md border border-[var(--border-color)]
                    disabled:opacity-40 hover:bg-[var(--bg-surface-2)] transition-colors">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <RegisterModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}
