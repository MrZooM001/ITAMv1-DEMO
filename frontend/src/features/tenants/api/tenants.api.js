import { api } from "../../../api/fetch.instance";

// ── Tenant CRUD ────────────────────────────────────────────

/** POST /tenants/ — create a new tenant. Platform super-admin only. */
export const createTenant = (data) =>
  api("/tenants/", { method: "POST", body: JSON.stringify(data) });

/** GET /tenants/ — list all tenants (paginated). */
export const getTenants = (params = {}) => {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.page_size != null) q.set("page_size", String(params.page_size));
  if (params.is_active != null) q.set("is_active", String(params.is_active));
  return api(`/tenants/?${q}`);
};

/** GET /tenants/:id — get a single tenant. */
export const getTenant = (tenantId) => api(`/tenants/${tenantId}`);

/** PUT /tenants/:id — update tenant name or active status. */
export const updateTenant = (tenantId, data) =>
  api(`/tenants/${tenantId}`, { method: "PUT", body: JSON.stringify(data) });

/** DELETE /tenants/:id — hard-delete (blocked if platform tenant or has active users). */
export const deleteTenant = (tenantId) =>
  api(`/tenants/${tenantId}`, { method: "DELETE" });

// ── Tenant user provisioning ───────────────────────────────
// All endpoints sit under /{tenant_id}/users and are callable
// by the platform super-admin WITHOUT switching into that tenant.

/** GET /tenants/:id/users — list users belonging to a tenant. */
export const getTenantUsers = (tenantId, params = {}) => {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.page_size != null) q.set("page_size", String(params.page_size));
  if (params.search != null) q.set("search", params.search);
  if (params.is_active != null) q.set("is_active", String(params.is_active));
  return api(`/tenants/${tenantId}/users?${q}`);
};

/**
 * POST /tenants/:id/users — provision a new user inside a tenant.
 * Matches backend's UserCreate schema — role IS supported here (unlike update).
 * @param {{ full_name: string, email: string, password: string, role?: string }} data
 */
export const createTenantUser = (tenantId, data) =>
  api(`/tenants/${tenantId}/users`, { method: "POST", body: JSON.stringify(data) });

/**
 * PUT /tenants/:id/users/:userId — update a tenant user's name or email.
 * Matches backend's UserUpdate schema — full_name and email ONLY.
 * For activating/deactivating a user, use updateTenantUserStatus below
 * (separate route/schema, not this one).
 * @param {{ full_name?: string, email?: string }} data
 */
export const updateTenantUser = (tenantId, userId, data) =>
  api(`/tenants/${tenantId}/users/${userId}`, { method: "PUT", body: JSON.stringify(data) });

/**
 * PUT /tenants/:id/users/:userId/status — activate or deactivate a tenant user.
 * Dedicated route backed by UserStatusUpdate ({ is_active: bool }) and the
 * existing user_service.update_user_status(), guarded by require_platform_super_admin.
 * Mirrors the tenant-internal PUT /users/{id}/status route — returns the
 * full updated UserResponse, not 204.
 * @param {boolean} isActive
 * @returns {Promise<object>} updated user
 */
export const updateTenantUserStatus = (tenantId, userId, isActive) =>
  api(`/tenants/${tenantId}/users/${userId}/status`, {
    method: "PUT",
    body: JSON.stringify({ is_active: isActive }),
  });

/**
 * PUT /tenants/:id/users/:userId/change-password — reset a user's password.
 * Returns 204 No Content on success (handled by api() helper).
 * @param {{ new_password: string }} data
 */
export const resetTenantUserPassword = (tenantId, userId, data) =>
  api(`/tenants/${tenantId}/users/${userId}/change-password`, {
    method: "PUT",
    body: JSON.stringify(data),
  });