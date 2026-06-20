import { api, getAll } from "../../../api/fetch.instance";

export const getDepartments = (params = {}) => getAll("/departments/", params);

export const getDepartment = (id) => api(`/departments/${id}`);

export const createDepartment = (data) => api("/departments/", { method: "POST", body: JSON.stringify(data) });
export const updateDepartment = (id, data) => api(`/departments/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteDepartment = (id) => api(`/departments/${id}`, { method: "DELETE" });