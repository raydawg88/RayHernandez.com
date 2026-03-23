import { appIds, appNames, type AppId } from "@/config/appRegistryData";
import type { AppLaunchRequest } from "@/utils/appEventBus";

export interface RouteToastDescriptor {
  type: "translation" | "text";
  message: string;
}

type UrlCleanupTiming = "immediate" | "after-dispatch" | "never";

export type RouteAction =
  | {
      kind: "launch";
      request: AppLaunchRequest;
      delayMs: number;
      toast?: RouteToastDescriptor;
      urlCleanupTiming: UrlCleanupTiming;
    }
  | {
      kind: "cleanup";
      urlCleanupTiming: Exclude<UrlCleanupTiming, "never">;
    };

const KNOWN_APP_IDS = new Set<string>(appIds);

function createLaunchAction(
  request: AppLaunchRequest,
  options: {
    delayMs: number;
    toast?: RouteToastDescriptor;
    urlCleanupTiming: UrlCleanupTiming;
  },
): RouteAction {
  return {
    kind: "launch",
    request,
    delayMs: options.delayMs,
    toast: options.toast,
    urlCleanupTiming: options.urlCleanupTiming,
  };
}

export function resolveInitialRoute(pathname: string): RouteAction | null {
  if (!pathname || pathname === "/") {
    return null;
  }

  // Direct app path: /terminal, /finder, etc.
  const directAppPathMatch = pathname.match(/^\/([^/]+)$/);
  if (directAppPathMatch) {
    const potentialAppId = directAppPathMatch[1];
    if (KNOWN_APP_IDS.has(potentialAppId)) {
      const appId = potentialAppId as AppId;
      const appName = appNames[appId] || appId;

      return createLaunchAction(
        { appId },
        {
          delayMs: 100,
          toast: {
            type: "text",
            message: `Launching ${appName}...`,
          },
          urlCleanupTiming: "after-dispatch",
        },
      );
    }
  }

  return {
    kind: "cleanup",
    urlCleanupTiming: "immediate",
  };
}
