import { api } from "../../../api/fetch.instance";

// ── Network interfaces ─────────────────────────────────────

/** GET /network/interfaces — list available network adapters with their suggested subnet. */
export const getInterfaces = () => api("/network/interfaces");

// ── Scans ──────────────────────────────────────────────────

/**
 * POST /network/scan — trigger a new ARP scan in the background.
 * @param {{ subnet: string, preferred_iface?: string }} data
 */
export const triggerScan = (data) =>
  api("/network/scan", { method: "POST", body: JSON.stringify(data) });

/**
 * GET /network/scans — list all past scans (paginated).
 * @param {{ page?: number, page_size?: number }} params
 */
export const getScans = (params = {}) => {
  const q = new URLSearchParams();
  if (params.page      != null) q.set("page",      String(params.page));
  if (params.page_size != null) q.set("page_size", String(params.page_size));
  return api(`/network/scans?${q}`);
};

/** GET /network/scans/:id — get a single scan with its discovered hosts. */
export const getScan = (scanId) => api(`/network/scans/${scanId}`);

/**
 * POST /network/scans/:id/import — import selected hosts from a scan as devices.
 * @param {string} scanId
 * @param {{ host_ids: string[] }} data
 */
export const importHosts = (scanId, data) =>
  api(`/network/scans/${scanId}/import`, { method: "POST", body: JSON.stringify(data) });
