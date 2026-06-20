import { api, getAll } from "../../../api/fetch.instance";

// ── Devices ────────────────────────────────────────────────
export const getDevices = (params = {}) => {
  const p = {};
  if (params.status) p.status = params.status;
  if (params.department_id) p.department_id = params.department_id;
  return getAll("/devices/", p);
};

export const getDevice = (id) => api(`/devices/${id}`);
export const createDevice = (data) => api("/devices/", { method: "POST", body: JSON.stringify(data) });
export const updateDevice = (id, data) => api(`/devices/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const updateDeviceStatus = (id, stat) => api(`/devices/${id}/status`, { method: "PUT", body: JSON.stringify({ status: stat }) });
export const assignEmployee = (id, employee_id) => api(`/devices/${id}/assign-employee`, { method: "PUT", body: JSON.stringify({ employee_id }) });
export const assignDepartment = (id, department_id) => api(`/devices/${id}/assign-department`, { method: "PUT", body: JSON.stringify({ department_id }) });
export const deleteDevice = (id) => api(`/devices/${id}`, { method: "DELETE" });
export const getDeviceTickets = (id) => api(`/devices/${id}/tickets`);
export const getExpiringWarranty = (days = 30) => api(`/devices/expiring-warranty?days=${days}`);

// ── Device Types & Models ──────────────────────────────────
export const getDeviceTypes = () => api("/devices/types");
export const getDeviceModels = () => api("/devices/models");
export const createDeviceType = (data) => api("/devices/types", { method: "POST", body: JSON.stringify(data) });
export const updateDeviceType = (id, data) => api(`/devices/types/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteDeviceType = (id) => api(`/devices/types/${id}`, { method: "DELETE" });
export const createDeviceModel = (data) => api("/devices/models", { method: "POST", body: JSON.stringify(data) });
export const updateDeviceModel = (id, data) => api(`/devices/models/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteDeviceModel = (id) => api(`/devices/models/${id}`, { method: "DELETE" });

// ── Device Type Fields ─────────────────────────────────────
export const getTypeFields = (typeId) => api(`/devices/types/${typeId}/fields`);
export const createTypeField = (typeId, data) => api(`/devices/types/${typeId}/fields`, { method: "POST", body: JSON.stringify(data) });
export const updateTypeField = (typeId, fid, data) => api(`/devices/types/${typeId}/fields/${fid}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteTypeField = (typeId, fid) => api(`/devices/types/${typeId}/fields/${fid}`, { method: "DELETE" });

// ── Hardware ───────────────────────────────────────────────
export const getDeviceHardware = (id) => api(`/devices/${id}/hardware`);
export const updateDeviceHardware = (id, data) => api(`/devices/${id}/hardware`, { method: "PUT", body: JSON.stringify(data) });
export const importSpeccyXml = (id, file) => {
  const fd = new FormData();
  fd.append("file", file);
  return api(`/devices/${id}/hardware`, { method: "POST", body: fd });
};

// ── Software on device ─────────────────────────────────────
export const getDeviceSoftware = (id) => api(`/devices/${id}/software`);

// ── Bulk hardware ──────────────────────────────────────────
export const getDeviceHardwareBulk = (ids = []) =>
  Promise.allSettled(ids.map((id) => getDeviceHardware(id))).then((results) =>
    results.reduce((acc, r, i) => {
      if (r.status === "fulfilled" && r.value) acc[ids[i]] = r.value;
      return acc;
    }, {})
  );