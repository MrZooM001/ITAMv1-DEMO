import { create } from "zustand";
import { persist } from "zustand/middleware";
import { queryClient } from "../api/queryClient";

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,

      // The backend deliberately never tells the client whether it belongs
      // to the platform tenant (no tenant_slug, no is_platform_admin on
      // UserResponse — by design, see app/schemas/user.py). So the frontend
      // discovers this empirically: it tries a platform-only endpoint once
      // after login and remembers whether that succeeded. null = not yet
      // checked, true/false = checked.
      isPlatformAdmin: null,

      setAuth: (user, token, refreshToken) =>
        set({ user, token, refreshToken }),

      setIsPlatformAdmin: (value) => set({ isPlatformAdmin: value }),

      logout: () => {
        queryClient.clear();
        set({ user: null, token: null, refreshToken: null, isPlatformAdmin: null });
      }
    }),
    { name: "auth-storage" }
  )
);