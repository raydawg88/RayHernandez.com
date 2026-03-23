import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "./useAppStore";
import { useAudioSettingsStore } from "./useAudioSettingsStore";
import { useDisplaySettingsStore } from "./useDisplaySettingsStore";
import { useFilesStore } from "./useFilesStore";
import { useTerminalStore } from "./useTerminalStore";

export function useAppStoreShallow<T>(
  selector: (state: ReturnType<typeof useAppStore.getState>) => T
): T {
  return useAppStore(useShallow(selector));
}

export function useAudioSettingsStoreShallow<T>(
  selector: (state: ReturnType<typeof useAudioSettingsStore.getState>) => T
): T {
  return useAudioSettingsStore(useShallow(selector));
}

export function useDisplaySettingsStoreShallow<T>(
  selector: (state: ReturnType<typeof useDisplaySettingsStore.getState>) => T
): T {
  return useDisplaySettingsStore(useShallow(selector));
}

export function useFilesStoreShallow<T>(
  selector: (state: ReturnType<typeof useFilesStore.getState>) => T
): T {
  return useFilesStore(useShallow(selector));
}

export function useTerminalStoreShallow<T>(
  selector: (state: ReturnType<typeof useTerminalStore.getState>) => T
): T {
  return useTerminalStore(useShallow(selector));
}
