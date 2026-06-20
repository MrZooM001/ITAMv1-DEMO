import { useState, useEffect, useCallback } from "react";
import {
  MdRouter,
  MdSearch,
  MdRefresh,
  MdPlayArrow,
  MdCheckCircle,
  MdError,
  MdHourglassEmpty,
  MdDownload,
  MdClose,
  MdLan,
} from "react-icons/md";
import {
  getInterfaces,
  triggerScan,
  getScans,
  getScan,
  importHosts,
} from "../../features/network/api/network.api";

// ── Helpers ────────────────────────────────────────────────

const STATUS_META = {
  pending:    { label: "Pending",    color: "text-yellow-600 dark:text-yellow-400", icon: MdHourglassEmpty, bg: "bg-yellow-100 dark:bg-yellow-900/30" },
  running:    { label: "Running",    color: "text-blue-600 dark:text-blue-400",     icon: MdRefresh,        bg: "bg-blue-100 dark:bg-blue-900/30" },
  completed:  { label: "Completed",  color: "text-green-600 dark:text-green-400",   icon: MdCheckCircle,    bg: "bg-green-100 dark:bg-green-900/30" },
  failed:     { label: "Failed",     color: "text-red-600 dark:text-red-400",       icon: MdError,          bg: "bg-red-100 dark:bg-red-900/30" },
};

function ScanStatusBadge({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
      <Icon className={`text-sm ${status === "running" ? "animate-spin" : ""}`} />
      {meta.label}
    </span>
  );
}

// ── New scan modal ─────────────────────────────────────────

function NewScanModal({ onClose, onTriggered }) {
  const [interfaces, setInterfaces] = useState([]);
  const [loadingIfaces, setLoadingIfaces] = useState(true);
  const [subnet, setSubnet]         = useState("");
  const [preferredIface, setPreferredIface] = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);

  useEffect(() => {
    getInterfaces()
      .then((data) => {
        setInterfaces(data ?? []);
        // Pre-fill subnet from first interface if available
        if (data?.[0]?.suggested_subnet) setSubnet(data[0].suggested_subnet);
        if (data?.[0]?.name) setPreferredIface(data[0].name);
      })
      .catch(() => setInterfaces([]))
      .finally(() => setLoadingIfaces(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = { subnet };
      if (preferredIface) payload.preferred_iface = preferredIface;
      await triggerScan(payload);
      onTriggered();
    } catch (err) {
      setError(err.message ?? "Failed to start scan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <MdRouter className="text-blue-600 dark:text-blue-400 text-lg" />
            </div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">New network scan</h2>
          </div>
          <button onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <MdClose className="text-xl" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800
              rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Interface picker */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              Network adapter
            </label>
            {loadingIfaces ? (
              <div className="h-10 bg-[var(--bg-surface-2)] rounded-lg animate-pulse" />
            ) : interfaces.length > 0 ? (
              <select value={preferredIface}
                onChange={(e) => {
                  setPreferredIface(e.target.value);
                  const iface = interfaces.find((i) => i.name === e.target.value);
                  if (iface?.suggested_subnet) setSubnet(iface.suggested_subnet);
                }}
                className="input-field">
                {interfaces.map((iface) => (
                  <option key={iface.name} value={iface.name}>
                    {iface.name}{iface.type ? ` — ${iface.type}` : ""}{iface.ip ? ` (${iface.ip})` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">
                Could not detect adapters — enter subnet manually.
              </p>
            )}
          </div>

          {/* Subnet */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              Subnet
            </label>
            <input type="text" required value={subnet}
              onChange={(e) => setSubnet(e.target.value)}
              placeholder="192.168.1.0/24"
              className="input-field font-mono"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">
              CIDR notation, e.g. <span className="font-mono">192.168.1.0/24</span>
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
              {loading ? "Starting…" : "Start scan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Import hosts modal ─────────────────────────────────────

function ImportModal({ scan, onClose, onImported }) {
  const [hosts, setHosts]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(new Set());
  const [importing, setImporting]   = useState(false);
  const [error, setError]           = useState(null);

  useEffect(() => {
    getScan(scan.id)
      .then((data) => {
        const h = data.hosts ?? [];
        setHosts(h);
        setSelected(new Set(h.map((host) => host.id)));
      })
      .catch((err) => setError(err.message ?? "Failed to load hosts."))
      .finally(() => setLoading(false));
  }, [scan.id]);

  function toggleHost(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === hosts.length ? new Set() : new Set(hosts.map((h) => h.id))
    );
  }

  async function handleImport() {
    if (selected.size === 0) return;
    setError(null);
    setImporting(true);
    try {
      await importHosts(scan.id, { host_ids: [...selected] });
      onImported();
    } catch (err) {
      setError(err.message ?? "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] shrink-0">
          <div>
            <h2 className="font-semibold text-[var(--text-primary)]">Import discovered hosts</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Subnet: <span className="font-mono">{scan.subnet}</span> — {hosts.length} hosts found
            </p>
          </div>
          <button onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <MdClose className="text-xl" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <p className="text-center py-12 text-red-500 text-sm">{error}</p>
          ) : hosts.length === 0 ? (
            <p className="text-center py-12 text-[var(--text-muted)] text-sm">No hosts discovered.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--bg-surface-2)] border-b border-[var(--border-color)]">
                <tr>
                  <th className="px-5 py-3 w-10">
                    <input type="checkbox"
                      checked={selected.size === hosts.length && hosts.length > 0}
                      onChange={toggleAll}
                      className="rounded" />
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">IP Address</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">MAC Address</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Hostname</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Vendor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {hosts.map((host) => (
                  <tr key={host.id}
                    onClick={() => toggleHost(host.id)}
                    className={`cursor-pointer transition-colors ${
                      selected.has(host.id)
                        ? "bg-blue-50 dark:bg-blue-900/10"
                        : "hover:bg-[var(--bg-surface-2)]"
                    }`}>
                    <td className="px-5 py-3">
                      <input type="checkbox" readOnly checked={selected.has(host.id)} className="rounded" />
                    </td>
                    <td className="px-3 py-3 font-mono text-[var(--text-primary)]">{host.ip}</td>
                    <td className="px-3 py-3 font-mono text-[var(--text-muted)] text-xs">{host.mac ?? "—"}</td>
                    <td className="px-3 py-3 text-[var(--text-secondary)]">{host.hostname ?? "—"}</td>
                    <td className="px-3 py-3 text-[var(--text-muted)]">{host.vendor ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {!loading && hosts.length > 0 && (
          <div className="px-6 py-4 border-t border-[var(--border-color)] flex items-center justify-between shrink-0">
            {error && <p className="text-xs text-red-500">{error}</p>}
            <p className="text-sm text-[var(--text-muted)]">{selected.size} of {hosts.length} selected</p>
            <div className="flex gap-3">
              <button onClick={onClose}
                className="px-4 py-2 border border-[var(--border-color)] text-[var(--text-secondary)]
                  hover:bg-[var(--bg-surface-2)] rounded-lg text-sm font-medium transition-colors">
                Cancel
              </button>
              <button onClick={handleImport} disabled={importing || selected.size === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                  text-white rounded-lg text-sm font-medium transition-colors">
                {importing ? "Importing…" : `Import ${selected.size} host${selected.size !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────

const POLL_INTERVAL_MS = 5000; // re-fetch scans every 5 s while any is running/pending

export default function NetworkDiscovery() {
  const [scans, setScans]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [showNewScan, setShowNewScan] = useState(false);
  const [importTarget, setImportTarget] = useState(null); // scan object

  const load = useCallback(async () => {
    try {
      const data = await getScans({ page_size: 30 });
      setScans(data.items ?? data);
    } catch (err) {
      setError(err.message ?? "Failed to load scans.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while any scan is active
  useEffect(() => {
    const hasActive = scans.some((s) => s.status === "pending" || s.status === "running");
    if (!hasActive) return;
    const timer = setTimeout(load, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [scans, load]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Network Discovery</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            ARP-sweep your network and import discovered hosts as devices.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load}
            className="p-2 rounded-lg border border-[var(--border-color)] text-[var(--text-muted)]
              hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] transition-colors">
            <MdRefresh className={`text-lg ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowNewScan(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700
              text-white text-sm font-medium rounded-lg transition-colors shrink-0">
            <MdPlayArrow className="text-lg" />
            New scan
          </button>
        </div>
      </div>

      {/* Scans list */}
      {loading && scans.length === 0 ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-20 text-red-500 text-sm">{error}</div>
      ) : scans.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <MdLan className="text-5xl text-[var(--text-muted)] opacity-30" />
          <p className="text-[var(--text-muted)] text-sm">No scans yet. Run your first scan.</p>
          <button onClick={() => setShowNewScan(true)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors">
            Start a scan
          </button>
        </div>
      ) : (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-surface-2)]">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Subnet</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Adapter</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Started</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Hosts found</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {scans.map((scan) => (
                <tr key={scan.id} className="hover:bg-[var(--bg-surface-2)] transition-colors">
                  <td className="px-4 py-3 font-mono text-[var(--text-primary)]">{scan.subnet}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{scan.preferred_iface ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {new Date(scan.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {scan.status === "completed" ? (scan.host_count ?? "—") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ScanStatusBadge status={scan.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {scan.status === "completed" && (
                      <button
                        onClick={() => setImportTarget(scan)}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1
                          rounded-md text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                        <MdDownload className="text-sm" />
                        Import
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNewScan && (
        <NewScanModal
          onClose={() => setShowNewScan(false)}
          onTriggered={() => { setShowNewScan(false); load(); }}
        />
      )}

      {importTarget && (
        <ImportModal
          scan={importTarget}
          onClose={() => setImportTarget(null)}
          onImported={() => { setImportTarget(null); load(); }}
        />
      )}
    </div>
  );
}
