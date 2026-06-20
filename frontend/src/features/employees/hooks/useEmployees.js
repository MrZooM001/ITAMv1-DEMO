import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/employees.api";

export const empKeys = {
  all: ["employees"],
  lists: () => [...empKeys.all, "list"],
  list: (params) => [...empKeys.lists(), params],
  detail: (id) => [...empKeys.all, "detail", id],
};

export const fetchEmployees = (params = {}) => api.getEmployees(params);

// params: { department_id?, search?, is_active? }
export const useEmployees = (params = {}) =>
  useQuery({
    queryKey: empKeys.list(params),
    queryFn: () => api.getEmployees(params),
  });

export const useEmployee = (id) =>
  useQuery({
    queryKey: empKeys.detail(id),
    queryFn: () => api.getEmployee(id),
    enabled: !!id,
  });

export const useCreateEmployee = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createEmployee,
    onSuccess: () => qc.invalidateQueries({ queryKey: empKeys.lists() }),
  });
};

export const useUpdateEmployee = (id) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.updateEmployee(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: empKeys.lists() });
      qc.invalidateQueries({ queryKey: empKeys.detail(id) });
    },
  });
};

export const useDeleteEmployee = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteEmployee,
    onSuccess: () => qc.invalidateQueries({ queryKey: empKeys.lists() }),
  });
};