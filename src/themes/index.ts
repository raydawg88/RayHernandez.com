import { system7 } from "./system7";
import { OsTheme, OsThemeId, ThemeMetadata } from "./types";

export const themes: Partial<Record<OsThemeId, OsTheme>> & { system7: OsTheme } = {
  system7,
};

export function getTheme(id: OsThemeId): OsTheme {
  return themes[id] ?? themes.system7;
}

export function getThemeMetadata(id: OsThemeId): ThemeMetadata {
  return getTheme(id).metadata;
}

export function isWindowsTheme(id: OsThemeId): boolean {
  return getTheme(id).metadata.isWindows;
}

export function isMacTheme(id: OsThemeId): boolean {
  return getTheme(id).metadata.isMac;
}

export type { OsTheme, OsThemeId, ThemeMetadata } from "./types";
