import { create } from "zustand";
import { persist } from "zustand/middleware";

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export const useUIStore = create(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      theme: "light",

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      toggleTheme: () => {
        const next = get().theme === "light" ? "dark" : "light";
        applyTheme(next);
        set({ theme: next });
      },

      initTheme: () => applyTheme(get().theme),
    }),
    { name: "ui-storage" }
  )
);