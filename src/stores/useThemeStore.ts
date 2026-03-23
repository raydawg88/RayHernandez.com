import { create } from "zustand";
import { OsThemeId } from "@/themes/types";

interface ThemeState {
  current: OsThemeId;
  setTheme: (theme: OsThemeId) => void;
  hydrate: () => void;
}

const THEME_KEY = "rayos:theme";

const createThemeStore = () => create<ThemeState>((set) => ({
  current: "system7",
  setTheme: (theme) => {
    set({ current: theme });
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.osTheme = theme;
  },
  hydrate: () => {
    const saved = localStorage.getItem(THEME_KEY) as OsThemeId | null;
    const theme = saved || "system7";
    set({ current: theme });
    document.documentElement.dataset.osTheme = theme;
  },
}));

// Preserve store across Vite HMR
let useThemeStore = createThemeStore();
if (import.meta.hot) {
  const data = import.meta.hot.data as { useThemeStore?: typeof useThemeStore };
  if (data.useThemeStore) {
    useThemeStore = data.useThemeStore;
  } else {
    data.useThemeStore = useThemeStore;
  }
}
export { useThemeStore };
