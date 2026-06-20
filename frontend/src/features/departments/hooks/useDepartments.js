import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/departments.api";

export const deptKeys = {
  all: ["departments"],
  lists: () => [...deptKeys.all, "list"],
  detail: (id) => [...deptKeys.all, "detail", id],
};

export const fetchDepartments = () => api.getDepartments();

export const useDepartments = () =>
  useQuery({ queryKey: deptKeys.lists(), queryFn: api.getDepartments });

export const useDepartment = (id) =>
  useQuery({ queryKey: deptKeys.detail(id), queryFn: () => api.getDepartment(id), enabled: !!id });

export const useCreateDepartment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createDepartment,
    onSuccess: () => qc.invalidateQueries({ queryKey: deptKeys.lists() }),
  });
};

export const useUpdateDepartment = (id) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.updateDepartment(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: deptKeys.lists() });
      qc.invalidateQueries({ queryKey: deptKeys.detail(id) });
    },
  });
};

export const useDeleteDepartment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteDepartment,
    onSuccess: () => qc.invalidateQueries({ queryKey: deptKeys.lists() }),
  });
};
