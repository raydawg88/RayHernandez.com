import { useMemo, useEffect, useRef } from "react";
import { useDisplaySettingsStore, INDEXEDDB_PREFIX } from "@/stores/useDisplaySettingsStore";

// All tile patterns available in /wallpapers/tiles/
const TILE_PATTERNS = [
  "azul_dark.png", "azul_extra_light.png", "azul_light.png",
  "bondi_dark.png", "bondi_extra_dark.png", "bondi_light.png",
  "bondi_medium.png", "bondi.png", "bossanova_bondi.png",
  "bossanova_poppy_2.png", "bossanova_poppy.png",
  "bubbles_bondi.png", "bubbles_poppy.png",
  "candy_bar_azul.png", "candy_bar_pistachio.png", "candy_bar_sunny.png", "candy_bar.png",
  "default.png",
  "diagonals_bondi_dark.png", "diagonals_bondi.png", "diagonals_poppy.png",
  "flat_peanuts_poppy.png", "flat_peanuts.png",
  "french_blue_dark.png", "french_blue_light.png",
  "peanuts_azul.png", "peanuts_pistachio.png",
  "pistachio_dark.png", "pistachio_light.png", "pistachio_medium.png",
  "poppy_dark.png", "poppy_light.png", "poppy_medium.png", "poppy.png",
  "rio_azul.png", "rio_pistachio.png",
  "ripple_azul.png", "ripple_bondi.png", "ripple_poppy.png",
  "sunny_dark.png", "sunny_light.png", "sunny.png",
  "waves_azul.png", "waves_bondi.png", "waves_sunny.png",
];

// Pick one random pattern per page load (module-level so it stays stable across re-renders)
const randomTile = `/wallpapers/tiles/${TILE_PATTERNS[Math.floor(Math.random() * TILE_PATTERNS.length)]}`;

/**
 * Hook exposing wallpaper state & helpers.
 * Under the hood, all state is managed by the global `useDisplaySettingsStore`.
 */
export function useWallpaper() {
  // State selectors from display settings store
  const currentWallpaper = useDisplaySettingsStore((s) => s.currentWallpaper);
  const wallpaperSource = useDisplaySettingsStore((s) => s.wallpaperSource);

  // Actions
  const setWallpaper = useDisplaySettingsStore((s) => s.setWallpaper);
  const loadCustomWallpapers = useDisplaySettingsStore((s) => s.loadCustomWallpapers);
  const getWallpaperData = useDisplaySettingsStore((s) => s.getWallpaperData);

  // If no wallpaper is explicitly set, use the random tile for this session
  const effectiveSource = currentWallpaper === "" ? randomTile : wallpaperSource;

  // Derived helper – detects whether the active wallpaper is a video
  const isVideoWallpaper = useMemo(() => {
    const path = effectiveSource;
    return (
      path.endsWith(".mp4") ||
      path.includes("video/") ||
      (path.startsWith("https://") && /\.(mp4|webm|ogg)(\?|$)/.test(path))
    );
  }, [effectiveSource]);

  // Ensure wallpaperSource is correctly resolved on first mount for custom wallpapers.
  // We attempt a single refresh per session if the persisted `wallpaperSource` might be stale
  // (e.g. an old `blob:` URL that no longer exists after a full page reload).
  const hasAttemptedRefresh = useRef(false);

  useEffect(() => {
    if (hasAttemptedRefresh.current) return;

    const isCustom = currentWallpaper.startsWith(INDEXEDDB_PREFIX);
    const sourceLooksStale =
      wallpaperSource === currentWallpaper || // Not resolved yet
      wallpaperSource.startsWith("blob:"); // Could be an invalid Object URL after reload

    if (isCustom && sourceLooksStale) {
      hasAttemptedRefresh.current = true; // Avoid infinite loops
      void setWallpaper(currentWallpaper);
    }
  }, [currentWallpaper, wallpaperSource, setWallpaper]);

  return {
    currentWallpaper,
    wallpaperSource: effectiveSource,
    setWallpaper,
    isVideoWallpaper,
    loadCustomWallpapers,
    getWallpaperData,
    INDEXEDDB_PREFIX,
  } as const;
}
