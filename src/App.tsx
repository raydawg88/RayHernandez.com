import { AppManager } from "./apps/base/AppManager";
import { appRegistry } from "./config/appRegistry";
import { useEffect, useState } from "react";
import { applyDisplayMode } from "./utils/displayMode";
import { Toaster } from "./components/ui/sonner";
import { useAppStoreShallow, useDisplaySettingsStoreShallow } from "@/stores/helpers";
import { BootScreen } from "./components/dialogs/BootScreen";
import { getNextBootMessage, clearNextBootMessage, isBootDebugMode } from "./utils/bootMessage";
import { AnyApp } from "./apps/base/types";
import { ScreenSaverOverlay } from "./components/screensavers/ScreenSaverOverlay";
import { DesktopErrorBoundary } from "@/components/errors/ErrorBoundaries";

// Convert registry to array
const apps: AnyApp[] = Object.values(appRegistry);

export function App() {
  const { isFirstBoot, setHasBooted } = useAppStoreShallow(
    (state) => ({
      isFirstBoot: state.isFirstBoot,
      setHasBooted: state.setHasBooted,
    })
  );
  const displayMode = useDisplaySettingsStoreShallow((state) => state.displayMode);

  const [bootScreenMessage, setBootScreenMessage] = useState<string | null>(
    null
  );
  const [showBootScreen, setShowBootScreen] = useState(false);
  const [bootDebugMode, setBootDebugMode] = useState(false);

  useEffect(() => {
    applyDisplayMode(displayMode);
  }, [displayMode]);

  useEffect(() => {
    const persistedMessage = getNextBootMessage();
    if (persistedMessage) {
      setBootScreenMessage(persistedMessage);
      setBootDebugMode(isBootDebugMode());
      setShowBootScreen(true);
    }

    if (isFirstBoot) {
      setHasBooted();
    }
  }, [isFirstBoot, setHasBooted]);

  if (showBootScreen) {
    return (
      <BootScreen
        isOpen={true}
        onOpenChange={() => {}}
        title={bootScreenMessage || "System Restoring..."}
        debugMode={bootDebugMode}
        onBootComplete={() => {
          clearNextBootMessage();
          setShowBootScreen(false);
        }}
      />
    );
  }

  return (
    <>
      <DesktopErrorBoundary>
        <AppManager apps={apps} />
      </DesktopErrorBoundary>
      <Toaster position="top-right" offset="42px" />
      <ScreenSaverOverlay />
    </>
  );
}
