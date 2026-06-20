import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/users.api";

export const userKeys = {
  all: ["users"],
  lists: () => [...userKeys.all, "list"],
  detail: (id) => [...userKeys.all, "detail", id],
};

// FIX: getUsers() already calls getAll() which returns a flat array.
// Removed the extra res.items unwrap that returned undefined.
export const useUsers = () =>
  useQuery({
    queryKey: userKeys.lists(),
    queryFn: api.getUsers,
  });

export const useUser = (id) =>
  useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => api.getUser(id),
    enabled: !!id,
  });

export const useUserStats = (id) =>
  useQuery({
    queryKey: [...userKeys.detail(id), "stats"],
    queryFn: () => api.getUserStats(id),
    enabled: !!id,
  });

export const useCreateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.lists() }),
  });
};

export const useUpdateUser = (id) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.updateUser(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.lists() }),
  });
};

export const useUpdateUserRole = (id) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.updateUserRole(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.lists() }),
  });
};

export const useUpdateUserStatus = (id) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.updateUserStatus(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.lists() }),
  });
};

export const useDeleteUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.lists() }),
  });
};
