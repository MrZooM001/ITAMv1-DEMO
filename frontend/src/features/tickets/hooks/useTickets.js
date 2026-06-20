import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/tickets.api";

export const ticketKeys = {
  all: ["tickets"],
  lists: () => [...ticketKeys.all, "list"],
  list: (f) => [...ticketKeys.lists(), f],
  detail: (id) => [...ticketKeys.all, "detail", id],
};

export const useTickets = (filters = {}) =>
  useQuery({ queryKey: ticketKeys.list(filters), queryFn: () => api.getTickets(filters) });

export const useTicket = (id) =>
  useQuery({ queryKey: ticketKeys.detail(id), queryFn: () => api.getTicket(id), enabled: !!id });

export const useCreateTicket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createTicket,
    onSuccess: () => qc.invalidateQueries({ queryKey: ticketKeys.lists() }),
  });
};

export const useUpdateTicket = (id) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.updateTicket(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ticketKeys.detail(id) });
      qc.invalidateQueries({ queryKey: ticketKeys.lists() });
    },
  });
};

export const useUpdateTicketStatus = (id) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.updateStatus(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ticketKeys.detail(id) }),
  });
};

export const useAddTicketUpdate = (id) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.addUpdate(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ticketKeys.detail(id) }),
  });
};

export const useAssignTicket = (id) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.assignTicket(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ticketKeys.detail(id) }),
  });
};

export const useAddSparePartUsage = (id) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.addSparePartUsage(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ticketKeys.detail(id) }),
  });
};