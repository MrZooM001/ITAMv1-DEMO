import { useAuthStore } from "../store/auth.store";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// ── Core fetch wrapper ─────────────────────────────────────
export async function api(endpoint, options = {}) {
  const token = useAuthStore.getState().token;
  const isFormData = options.body instanceof FormData;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...(!isFormData && { "Content-Type": "application/json" }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    useAuthStore.getState().logout();
    window.location.href = "/login";
    return;
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (Array.isArray(data.detail)) {
      const messages = data.detail
        .map((e) => {
          const field = e.loc?.filter((l) => l !== "body").join(".") ?? "";
          return field ? `${field}: ${e.msg}` : e.msg;
        })
        .join(" | ");
      throw new Error(messages);
    }
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : data.message ?? "Something went wrong"
    );
  }

  if (res.status === 204) return null;
  return res.json();
}

// ── Fetch all items by paginating through all pages ───────
// Backend enforces 1 ≤ page_size ≤ 100. We fetch page by page
// until all records are collected.
export async function getAll(endpoint, params = {}) {
  const PAGE_SIZE = 100;
  let page = 1;
  let allItems = [];

  while (true) {
    const q = new URLSearchParams(params);
    q.set("page", String(page));
    q.set("page_size", String(PAGE_SIZE));
    const res = await api(`${endpoint}?${q}`);

    // Handle flat array response (non-paginated endpoints)
    if (Array.isArray(res)) {
      allItems = allItems.concat(res);
      break;
    }

    const items = res?.items ?? [];
    allItems = allItems.concat(items);

    // Stop when we've collected everything
    const total = res?.total ?? null;
    if (total !== null) {
      if (allItems.length >= total) break;
    } else {
      // No total field — stop when a page returns fewer than page_size
      if (items.length < PAGE_SIZE) break;
    }

    page += 1;
  }

  return allItems;
}