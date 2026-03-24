import { type AppId } from "./appRegistryData";
import type {
  BaseApp,
  ControlPanelsInitialData,
} from "@/apps/base/types";
import { createLazyComponent } from "./lazyAppComponent";

export type { AppId };

export interface WindowSize {
  width: number;
  height: number;
}

export interface WindowConstraints {
  minSize?: WindowSize;
  maxSize?: WindowSize;
  defaultSize: WindowSize;
  mobileDefaultSize?: WindowSize;
  /** If true, mobile height will be set to window.innerWidth (square) */
  mobileSquare?: boolean;
}

// Default window constraints for any app not specified
const defaultWindowConstraints: WindowConstraints = {
  defaultSize: { width: 730, height: 475 },
  minSize: { width: 300, height: 200 },
};

// ============================================================================
// LAZY-LOADED APP COMPONENTS
// ============================================================================

// Critical apps (load immediately for perceived performance)
import { FinderAppComponent } from "@/apps/finder/components/FinderAppComponent";

// Lazy-loaded apps
const LazyTextEditApp = createLazyComponent<unknown>(
  () => import("@/apps/textedit/components/TextEditAppComponent").then(m => ({ default: m.TextEditAppComponent })),
  "textedit"
);

const LazyControlPanelsApp = createLazyComponent<ControlPanelsInitialData>(
  () => import("@/apps/control-panels/components/ControlPanelsAppComponent").then(m => ({ default: m.ControlPanelsAppComponent })),
  "control-panels"
);

const LazyTerminalApp = createLazyComponent<unknown>(
  () => import("@/apps/terminal/components/TerminalAppComponent").then(m => ({ default: m.TerminalAppComponent })),
  "terminal"
);

// ============================================================================
// APP METADATA
// ============================================================================

import { appMetadata as finderMetadata, helpItems as finderHelpItems } from "@/apps/finder/metadata";
import { appMetadata as texteditMetadata, helpItems as texteditHelpItems } from "@/apps/textedit/metadata";
import { appMetadata as terminalMetadata, helpItems as terminalHelpItems } from "@/apps/terminal";
import { appMetadata as controlPanelsMetadata, helpItems as controlPanelsHelpItems } from "@/apps/control-panels";

// ============================================================================
// APP REGISTRY
// ============================================================================

export const appRegistry = {
  ["finder"]: {
    id: "finder",
    name: "Finder",
    icon: { type: "image", src: "/icons/mac.png" },
    description: "Browse and manage files",
    component: FinderAppComponent,
    helpItems: finderHelpItems,
    metadata: finderMetadata,
    windowConfig: {
      defaultSize: { width: 800, height: 600 },
      minSize: { width: 300, height: 200 },
    } as WindowConstraints,
  },
  ["textedit"]: {
    id: "textedit",
    name: "TextEdit",
    icon: { type: "image", src: texteditMetadata.icon },
    description: "A simple rich text editor",
    component: LazyTextEditApp,
    helpItems: texteditHelpItems,
    metadata: texteditMetadata,
    windowConfig: {
      defaultSize: { width: 860, height: 700 },
      minSize: { width: 430, height: 200 },
    } as WindowConstraints,
  },
  ["terminal"]: {
    id: "terminal",
    name: "Terminal",
    icon: { type: "image", src: terminalMetadata!.icon },
    description: "Command line interface",
    component: LazyTerminalApp,
    helpItems: terminalHelpItems,
    metadata: terminalMetadata,
    windowConfig: {
      defaultSize: { width: 900, height: 600 },
      minSize: { width: 400, height: 300 },
    } as WindowConstraints,
  },
  ["control-panels"]: {
    id: "control-panels",
    name: "Control Panels",
    icon: { type: "image", src: controlPanelsMetadata.icon },
    description: "System settings",
    component: LazyControlPanelsApp,
    helpItems: controlPanelsHelpItems,
    metadata: controlPanelsMetadata,
    windowConfig: {
      defaultSize: { width: 365, height: 415 },
      minSize: { width: 320, height: 415 },
      maxSize: { width: 365, height: 600 },
    } as WindowConstraints,
  } as BaseApp<ControlPanelsInitialData> & { windowConfig: WindowConstraints },
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Typed as Record<string, any> for safe lookup by dynamic AppId
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry: Record<string, any> = appRegistry;
export { registry as appRegistryLookup };

export const getAppIconPath = (appId: AppId): string => {
  const app = registry[appId];
  if (!app) return "/icons/mac.png";
  if (typeof app.icon === "string") {
    return app.icon;
  }
  return app.icon.src;
};

export const getNonFinderApps = (isAdmin: boolean = false): Array<{
  name: string;
  icon: string;
  id: AppId;
}> => {
  return Object.entries(appRegistry)
    .filter(([id, app]) => {
      if (id === "finder") return false;
      if ((app as { adminOnly?: boolean }).adminOnly && !isAdmin) return false;
      return true;
    })
    .map(([id, app]) => ({
      name: app.name,
      icon: getAppIconPath(id as AppId),
      id: id as AppId,
    }));
};

export const getAppMetadata = (appId: AppId) => {
  return registry[appId]?.metadata;
};

export const getAppComponent = (appId: AppId) => {
  return registry[appId]?.component;
};

export const getWindowConfig = (appId: AppId): WindowConstraints => {
  return registry[appId]?.windowConfig || defaultWindowConstraints;
};

export const getMobileWindowSize = (appId: AppId): WindowSize => {
  const config = getWindowConfig(appId);
  if (config.mobileDefaultSize) {
    return config.mobileDefaultSize;
  }
  if (config.mobileSquare) {
    return {
      width: window.innerWidth,
      height: window.innerWidth,
    };
  }
  return {
    width: window.innerWidth,
    height: config.defaultSize.height,
  };
};
