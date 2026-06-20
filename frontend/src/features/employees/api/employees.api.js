import { api, getAll } from "../../../api/fetch.instance";

export const getEmployees = (params = {}) => {
  const p = {};
  if (params.department_id) p.department_id = params.department_id;
  if (params.search) p.search = params.search;
  if (params.is_active !== undefined) p.is_active = params.is_active;
  return getAll("/employees/", p);
};
export const getEmployee = (id) => api(`/employees/${id}`);
export const createEmployee = (data) => api("/employees/", { method: "POST", body: JSON.stringify(data) });
export const updateEmployee = (id, data) => api(`/employees/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteEmployee = (id) => api(`/employees/${id}`, { method: "DELETE" });