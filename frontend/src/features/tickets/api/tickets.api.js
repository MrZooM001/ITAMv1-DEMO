import { api, getAll } from "../../../api/fetch.instance";

export const getTickets = (params = {}) => {
  const p = {};
  if (params.status) p.status = params.status;
  if (params.priority) p.priority = params.priority;
  if (params.device_id) p.device_id = params.device_id;
  return getAll("/tickets/", p);
};
export const getTicket = (id) => api(`/tickets/${id}`);
export const createTicket = (data) => api("/tickets/", { method: "POST", body: JSON.stringify(data) });
export const updateTicket = (id, data) => api(`/tickets/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const updateStatus = (id, data) => api(`/tickets/${id}/status`, { method: "PUT", body: JSON.stringify(data) });
export const addUpdate = (id, data) => api(`/tickets/${id}/updates`, { method: "POST", body: JSON.stringify(data) });
export const assignTicket = (id, data) => api(`/tickets/${id}/assign`, { method: "PUT", body: JSON.stringify(data) });
export const getSparePartUsage = (id) => api(`/tickets/${id}/spare-parts`);
export const addSparePartUsage = (id, data) => api(`/tickets/${id}/spare-parts`, { method: "POST", body: JSON.stringify(data) });
export const deleteSparePartUsage = (id, uid) => api(`/tickets/${id}/spare-parts/${uid}`, { method: "DELETE" });