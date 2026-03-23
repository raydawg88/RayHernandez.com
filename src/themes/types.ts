// Only system7 is active, but other IDs kept for type compatibility
// with conditional rendering throughout the codebase
export type OsThemeId = "system7" | "macosx" | "xp" | "win98";

/**
 * Theme metadata for conditional rendering and layout decisions.
 */
export interface ThemeMetadata {
  isWindows: boolean;
  isMac: boolean;
  hasDock: boolean;
  hasTaskbar: boolean;
  hasMenuBar: boolean;
  titleBarControlsPosition: "left" | "right";
  menuBarHeight: number;
  taskbarHeight: number;
  baseDockHeight: number;
}

export interface OsTheme {
  id: OsThemeId;
  name: string;
  metadata: ThemeMetadata;
  fonts: {
    ui: string;
    mono?: string;
  };
  colors: {
    windowBg: string;
    menubarBg: string;
    menubarBorder: string;
    windowBorder: string;
    windowBorderInactive?: string;
    titleBar: {
      activeBg: string;
      inactiveBg: string;
      text: string;
      inactiveText: string;
      border?: string;
      borderInactive?: string;
      borderBottom?: string;
      pattern?: string;
    };
    button: {
      face: string;
      highlight: string;
      shadow: string;
      activeFace?: string;
    };
    trafficLights?: {
      close: string;
      closeHover?: string;
      minimize: string;
      minimizeHover?: string;
      maximize: string;
      maximizeHover?: string;
    };
    selection: {
      bg: string;
      text: string;
    };
    text: {
      primary: string;
      secondary: string;
      disabled: string;
    };
  };
  metrics: {
    borderWidth: string;
    radius: string;
    titleBarHeight: string;
    titleBarRadius?: string;
    windowShadow: string;
  };
  assets?: {
    closeButton?: string;
    maximizeButton?: string;
    minimizeButton?: string;
  };
  wallpaperDefaults?: {
    photo?: string;
    tile?: string;
  };
}
