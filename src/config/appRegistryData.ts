/**
 * Lightweight app registry data - only IDs and names
 * This file can be imported without triggering heavy component loads
 * Used by stores that need basic app info during initialization
 */

export const appIds = [
  "finder",
  "textedit",
  "terminal",
  "control-panels",
] as const;

export type AppId = (typeof appIds)[number]
  // Legacy app IDs kept for type compatibility with dead code paths
  | "soundboard" | "internet-explorer" | "chats" | "paint"
  | "photo-booth" | "minesweeper" | "videos" | "ipod"
  | "karaoke" | "synth" | "pc" | "applet-viewer"
  | "admin" | "stickies" | "infinite-mac" | "winamp"
  | "calendar" | "dashboard";

/** Minimal app data for stores that don't need full registry */
export interface AppBasicInfo {
  id: AppId;
  name: string;
}

/** App ID to name mapping */
export const appNames: Partial<Record<AppId, string>> = {
  "finder": "Finder",
  "textedit": "TextEdit",
  "terminal": "Terminal",
  "control-panels": "Control Panels",
};

/** Get list of apps with basic info for stores */
export function getAppBasicInfoList(): AppBasicInfo[] {
  return appIds.map(id => ({ id, name: appNames[id] ?? id }));
}
