import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as devicesApi from "../api/devices.api";

export const deviceKeys = {
  all: ["devices"],
  lists: () => [...deviceKeys.all, "list"],
  list: (filters) => [...deviceKeys.lists(), filters],
  details: () => [...deviceKeys.all, "detail"],
  detail: (id) => [...deviceKeys.details(), id],
  hardware: (id) => [...deviceKeys.all, "hardware", id],
  software: (id) => [...deviceKeys.all, "software", id],
  tickets: (id) => [...deviceKeys.all, "tickets", id],
  types: () => [...deviceKeys.all, "types"],
  models: () => [...deviceKeys.all, "models"],
  expiring: () => [...deviceKeys.all, "expiring"],
};

export const fetchDevices = (filters = {}) => devicesApi.getDevices(filters);

export const useDevices = (filters = {}) =>
  useQuery({
    queryKey: deviceKeys.list(filters),
    queryFn: () => devicesApi.getDevices(filters),
  });

export const useDevice = (id) =>
  useQuery({
    queryKey: deviceKeys.detail(id),
    queryFn: () => devicesApi.getDevice(id),
    enabled: !!id,
  });

// Returns null instead of throwing on 404 (device has no hardware yet)
export const useDeviceHardware = (id) =>
  useQuery({
    queryKey: deviceKeys.hardware(id),
    queryFn: () => devicesApi.getDeviceHardware(id).catch((err) => {
      if (err.message?.includes("404") || err.message?.includes("No hardware")) return null;
      throw err;
    }),
    enabled: !!id,
  });

export const useDeviceSoftware = (id) =>
  useQuery({
    queryKey: deviceKeys.software(id),
    queryFn: () => devicesApi.getDeviceSoftware(id),
    enabled: !!id,
  });

export const useDeviceTickets = (id) =>
  useQuery({
    queryKey: deviceKeys.tickets(id),
    queryFn: () => devicesApi.getDeviceTickets(id),
    enabled: !!id,
  });

export const fetchDeviceTypes = () => devicesApi.getDeviceTypes();

export const useDeviceTypes = () =>
  useQuery({ queryKey: deviceKeys.types(), queryFn: devicesApi.getDeviceTypes });

export const useDeviceModels = () =>
  useQuery({ queryKey: deviceKeys.models(), queryFn: devicesApi.getDeviceModels });

export const useExpiringWarranty = (days = 30) =>
  useQuery({
    queryKey: deviceKeys.expiring(),
    queryFn: () => devicesApi.getExpiringWarranty(days),
  });

export const useCreateDevice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: devicesApi.createDevice,
    onSuccess: () => qc.invalidateQueries({ queryKey: deviceKeys.lists() }),
  });
};

export const useUpdateDevice = (id) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => devicesApi.updateDevice(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: deviceKeys.detail(id) });
      qc.invalidateQueries({ queryKey: deviceKeys.lists() });
    },
  });
};

export const useUpdateDeviceStatus = (id) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status) => devicesApi.updateDeviceStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: deviceKeys.detail(id) });
      qc.invalidateQueries({ queryKey: deviceKeys.lists() });
    },
  });
};

export const useAssignEmployee = (id) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (employee_id) => devicesApi.assignEmployee(id, employee_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: deviceKeys.detail(id) });
      qc.invalidateQueries({ queryKey: deviceKeys.lists() });
    },
  });
};

export const useAssignDepartment = (id) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (department_id) => devicesApi.assignDepartment(id, department_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: deviceKeys.detail(id) });
      qc.invalidateQueries({ queryKey: deviceKeys.lists() });
    },
  });
};

export const useDeleteDevice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: devicesApi.deleteDevice,
    onSuccess: () => qc.invalidateQueries({ queryKey: deviceKeys.lists() }),
  });
};

export const useImportSpeccy = (id) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file) => devicesApi.importSpeccyXml(id, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: deviceKeys.hardware(id) });
      qc.invalidateQueries({ queryKey: deviceKeys.lists() });
    },
  });
};

export const useUpdateHardware = (id) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => devicesApi.updateDeviceHardware(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: deviceKeys.hardware(id) }),
  });
};

// Delete type/model with real endpoints
export const useDeleteDeviceType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: devicesApi.deleteDeviceType,
    onSuccess: () => qc.invalidateQueries({ queryKey: deviceKeys.types() }),
  });
};

export const useUpdateDeviceType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => devicesApi.updateDeviceType(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: deviceKeys.types() }),
  });
};

export const useDeleteDeviceModel = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: devicesApi.deleteDeviceModel,
    onSuccess: () => qc.invalidateQueries({ queryKey: deviceKeys.models() }),
  });
};

export const useUpdateDeviceModel = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => devicesApi.updateDeviceModel(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: deviceKeys.models() }),
  });
};

// Bulk hardware for list page
export const useDevicesHardwareBulk = (deviceIds = []) =>
  useQuery({
    queryKey: [...deviceKeys.all, "hardware-bulk", deviceIds.join(",")],
    queryFn: () => devicesApi.getDeviceHardwareBulk(deviceIds),
    enabled: deviceIds.length > 0,
    staleTime: 1000 * 60 * 10,
  });