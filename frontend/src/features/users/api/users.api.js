import { api, getAll } from "../../../api/fetch.instance";

export const getUsers = (params = {}) => {
  const p = {};
  if (params.search) p.search = params.search;
  if (params.is_active !== undefined) p.is_active = params.is_active;
  return getAll("/users/", p);
};
export const getUser = (id) => api(`/users/${id}`);
export const createUser = (data) => api("/users/", { method: "POST", body: JSON.stringify(data) });
export const updateUser = (id, data) => api(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const updateUserRole = (id, data) => api(`/users/${id}/role`, { method: "PUT", body: JSON.stringify(data) });
export const updateUserStatus = (id, data) => api(`/users/${id}/status`, { method: "PUT", body: JSON.stringify(data) });
export const deleteUser = (id) => api(`/users/${id}`, { method: "DELETE" });
export const getUserStats = (id) => api(`/users/${id}/stats`);
export const getUserActivity = (id) => api(`/users/${id}/activity`);