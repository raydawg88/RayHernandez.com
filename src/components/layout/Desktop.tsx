import { AnyApp } from "@/apps/base/types";
import { AppId } from "@/config/appRegistry";
import { useState, useRef, useCallback, useMemo } from "react";
import { getAppIconPath } from "@/config/appRegistry";
import { useWallpaper } from "@/hooks/useWallpaper";
import { RightClickMenu, MenuItem } from "@/components/ui/right-click-menu";
import { SortType } from "@/apps/finder/components/FinderMenuBar";
import { useLongPress } from "@/hooks/useLongPress";
import { useThemeStore } from "@/stores/useThemeStore";
import { useFilesStore, FileSystemItem } from "@/stores/useFilesStore";
import { useShallow } from "zustand/react/shallow";
import { useLaunchApp } from "@/hooks/useLaunchApp";
import type { LaunchOriginRect } from "@/stores/useAppStore";
import { dbOperations } from "@/apps/finder/hooks/useFileSystem";
import { STORES } from "@/utils/indexedDB";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { useTranslation } from "react-i18next";
import { getTranslatedAppName } from "@/utils/i18n";
import { useEventListener } from "@/hooks/useEventListener";
import { DesktopIconLayer } from "@/components/layout/DesktopIconLayer";
import { useUndoStore } from "@/stores/useUndoStore";

interface DesktopStyles {
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundRepeat?: string;
  backgroundPosition?: string;
  transition?: string;
}

interface DesktopProps {
  apps: AnyApp[];
  toggleApp: (appId: AppId, initialData?: unknown, launchOrigin?: LaunchOriginRect) => void;
  onClick?: () => void;
  desktopStyles?: DesktopStyles;
}

// RayOS desktop icon order (by display name)
const DEFAULT_SHORTCUT_ORDER_NAMES: string[] = [
  "About Ray",
  "Projects",
  "AI Lab",
  "Stories",
  "Resume",
  "Terminal",
  "Settings",
];

export function Desktop({
  apps,
  toggleApp,
  onClick,
  desktopStyles,
}: DesktopProps) {
  const { t } = useTranslation();
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [selectedShortcutPath, setSelectedShortcutPath] = useState<string | null>(null);
  const { wallpaperSource, isVideoWallpaper } = useWallpaper();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [sortType, setSortType] = useState<SortType>("name");
  const [contextMenuPos, setContextMenuPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [contextMenuAppId, setContextMenuAppId] = useState<string | null>(null);
  const [contextMenuShortcutPath, setContextMenuShortcutPath] = useState<string | null>(null);
  const [isEmptyTrashDialogOpen, setIsEmptyTrashDialogOpen] = useState(false);

  // Get current theme for layout adjustments
  const currentTheme = useThemeStore((state) => state.current);
  const isXpTheme = currentTheme === "xp" || currentTheme === "win98";
  
  // Check if running in Tauri
  const isTauriApp = typeof window !== "undefined" && "__TAURI__" in window;

  // File system and launch app hooks
  const launchApp = useLaunchApp();
  
  // Targeted file store subscriptions - only re-render when desktop/trash items change
  const desktopAndTrashItems = useFilesStore(
    useShallow((state) => {
      const result: FileSystemItem[] = [];
      for (const [path, item] of Object.entries(state.items)) {
        if (path.startsWith("/Desktop/") || path === "/Trash") {
          result.push(item);
        }
      }
      return result;
    })
  );
  const getItem = useFilesStore((state) => state.getItem);
  const getItemsInPath = useFilesStore((state) => state.getItemsInPath);
  const updateItemMetadata = useFilesStore((state) => state.updateItemMetadata);
  const createAlias = useFilesStore((state) => state.createAlias);
  const removeItem = useFilesStore((state) => state.removeItem);
  const emptyTrash = useFilesStore((state) => state.emptyTrash);
  const getTrashItems = useFilesStore((state) => state.getTrashItems);
  const trashItem = desktopAndTrashItems.find(item => item.path === "/Trash");
  const trashIcon = trashItem?.icon || "/icons/trash-empty.png";

  // Get desktop shortcuts - derived from targeted store subscription
  const desktopShortcuts = useMemo(
    () =>
      desktopAndTrashItems
        .filter(
          (item) =>
            item.status === "active" &&
            item.path.startsWith("/Desktop/") &&
            !item.isDirectory &&
            (!item.hiddenOnThemes ||
              !item.hiddenOnThemes.includes(currentTheme))
        )
        .sort((a, b) => {
          const aIndex = DEFAULT_SHORTCUT_ORDER_NAMES.indexOf(a.name);
          const bIndex = DEFAULT_SHORTCUT_ORDER_NAMES.indexOf(b.name);
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          return a.name.localeCompare(b.name);
        }),
    [desktopAndTrashItems, currentTheme]
  );

  // Get display name for desktop shortcuts (with translation)
  const getDisplayName = (shortcut: FileSystemItem): string => {
    // For app aliases, use translated app name
    if (shortcut.aliasType === "app" && shortcut.aliasTarget) {
      return getTranslatedAppName(shortcut.aliasTarget as AppId);
    }
    // For file aliases, remove file extension
    return shortcut.name.replace(/\.[^/.]+$/, "");
  };

  // Resolve and open alias target
  const handleAliasOpen = async (shortcut: FileSystemItem, launchOrigin?: LaunchOriginRect) => {
    if (!shortcut.aliasTarget || !shortcut.aliasType) return;

    // Show classic Mac OS watch cursor, then open after delay
    document.body.classList.add("os-busy");

    if (shortcut.aliasType === "app") {
      // Launch app directly (with delay for watch cursor)
      const appId = shortcut.aliasTarget as AppId;
      setTimeout(() => {
        document.body.classList.remove("os-busy");
        toggleApp(appId, undefined, launchOrigin);
      }, 600);
    } else {
      // Open file/applet - need to resolve the original file
      // (launchApp already handles the watch cursor delay)
      document.body.classList.remove("os-busy");
      const targetPath = shortcut.aliasTarget;
      const targetFile = getItem(targetPath);

      if (!targetFile) {
        console.warn(`[Desktop] Target file not found: ${targetPath}`);
        return;
      }

      // Use useFileSystem hook logic to open the file
      // We need to fetch content and launch appropriate app
      try {
        let contentToUse: string | Blob | undefined = undefined;
        let contentAsString: string | undefined = undefined;

        if (
          targetFile.path.startsWith("/Documents/") ||
          targetFile.path.startsWith("/Images/") ||
          targetFile.path.startsWith("/Applets/")
        ) {
          if (targetFile.uuid) {
            const storeName = targetFile.path.startsWith("/Documents/")
              ? STORES.DOCUMENTS
              : targetFile.path.startsWith("/Images/")
              ? STORES.IMAGES
              : STORES.APPLETS;
            
            const contentData = await dbOperations.get<{ name: string; content: string | Blob }>(
              storeName,
              targetFile.uuid
            );
            
            if (contentData) {
              contentToUse = contentData.content;
              if (contentToUse instanceof Blob) {
                if (targetFile.path.startsWith("/Documents/") || targetFile.path.startsWith("/Applets/")) {
                  contentAsString = await contentToUse.text();
                }
              } else if (typeof contentToUse === "string") {
                contentAsString = contentToUse;
              }
            }
          }
        }

        // Launch appropriate app based on file type
        if (targetFile.isDirectory) {
          // Open directories in Finder
          localStorage.setItem("rayos:app:finder:initial-path", targetFile.path);
          launchApp("finder", { initialPath: targetFile.path, launchOrigin });
        } else if (targetFile.path.startsWith("/Applications/") && targetFile.appId) {
          launchApp(targetFile.appId as AppId, { launchOrigin });
        } else if (targetFile.path.startsWith("/Documents/")) {
          launchApp("textedit", {
            initialData: { path: targetFile.path, content: contentAsString ?? "" },
            launchOrigin,
          });
        } else if (targetFile.path.startsWith("/Images/")) {
          launchApp("paint", {
            initialData: { path: targetFile.path, content: contentToUse },
            launchOrigin,
          });
        } else if (
          targetFile.path.startsWith("/Applets/") &&
          (targetFile.path.endsWith(".app") || targetFile.path.endsWith(".html"))
        ) {
          launchApp("applet-viewer", {
            initialData: {
              path: targetFile.path,
              content: contentAsString ?? "",
            },
            launchOrigin,
          });
        }
      } catch (err) {
        console.error(`[Desktop] Error opening alias target:`, err);
      }
    }
  };

  // Handle drag and drop from Finder
  const handleDragOver = (e: React.DragEvent) => {
    // Only accept drops from Finder (application/json data)
    if (e.dataTransfer.types.includes("application/json")) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const jsonData = e.dataTransfer.getData("application/json");
      if (!jsonData) return;

      const { path, name, appId } = JSON.parse(jsonData);

      // If this drag originated from an existing desktop shortcut, do not
      // create another alias. This prevents duplicate icons when dragging
      // items around on the desktop itself.
      if (path && path.startsWith("/Desktop/")) {
        return;
      }
      
      // Check if an alias already exists for this target
      const desktopItems = getItemsInPath("/Desktop");
      let aliasExists = false;
      
      // Check if this is an app or a file/applet
      if (appId || (path && path.startsWith("/Applications/"))) {
        // It's an application - use appId from drag data or get from file system
        const finalAppId = appId || getItem(path)?.appId;
        if (finalAppId) {
          // Check if alias already exists for this app
          const existingShortcut = desktopItems.find(
            (item) =>
              item.aliasType === "app" &&
              item.aliasTarget === finalAppId &&
              item.status === "active"
          );
          aliasExists = !!existingShortcut;

          if (aliasExists && existingShortcut) {
            // If this was a theme-conditional default, "fix" it by clearing
            // hidden themes so it shows regardless of theme.
            if (
              existingShortcut.hiddenOnThemes &&
              existingShortcut.hiddenOnThemes.length > 0
            ) {
              updateItemMetadata(existingShortcut.path, {
                hiddenOnThemes: [],
              });
            }
          } else {
            createAlias(path || "", name, "app", finalAppId);
          }
        }
      } else if (path) {
        // It's a file or applet
        const sourceItem = getItem(path);
        if (sourceItem) {
          // Check if alias already exists for this file
          aliasExists = desktopItems.some(
            (item) =>
              item.aliasType === "file" &&
              item.aliasTarget === path &&
              item.status === "active"
          );
          
          if (!aliasExists) {
            createAlias(path, name, "file");
          }
        }
      }
    } catch (err) {
      console.error("[Desktop] Error handling drop:", err);
    }
  };

  // ------------------ Mobile long-press support ------------------
  // Show the desktop context menu after the user holds for 500 ms.
  const longPressHandlers = useLongPress((e) => {
    // Check if the target is within an icon - if so, don't show desktop context menu
    const target = e.target as HTMLElement;
    const iconContainer = target.closest("[data-desktop-icon]");
    if (iconContainer) {
      return; // Let the icon handle its own context menu
    }

    const touch = e.touches[0];
    setContextMenuPos({ x: touch.clientX, y: touch.clientY });
    setContextMenuAppId(null);
  });

  const resumeVideoPlayback = useCallback(async () => {
    if (!isVideoWallpaper || !videoRef.current) return;

    const video = videoRef.current;
    if (!video) return;

    try {
      // If video has ended, reset it to the beginning
      if (video.ended) {
        video.currentTime = 0;
      }

      // Only attempt to play if the video is ready
      if (video.readyState >= 3) {
        // HAVE_FUTURE_DATA or better
        await video.play();
      } else {
        // If video isn't ready, wait for it to be ready
        const handleCanPlay = () => {
          video.play().catch((err) => {
            console.warn("Could not resume video playback:", err);
          });
          video.removeEventListener("canplay", handleCanPlay);
        };
        video.addEventListener("canplay", handleCanPlay);
      }
    } catch (err) {
      console.warn("Could not resume video playback:", err);
    }
  }, [isVideoWallpaper]);

  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === "visible") {
      resumeVideoPlayback();
    }
  }, [resumeVideoPlayback]);

  const handleFocus = useCallback(() => {
    resumeVideoPlayback();
  }, [resumeVideoPlayback]);

  const handleCanPlayThrough = useCallback(() => {
    if (!isVideoWallpaper || !videoRef.current) return;

    const video = videoRef.current;
    if (video.paused) {
      video.play().catch((err) => {
        console.warn("Could not start video playback:", err);
      });
    }
  }, [isVideoWallpaper]);

  // Add visibility change and focus handlers to resume video playback
  useEventListener("visibilitychange", handleVisibilityChange, isVideoWallpaper ? document : null);
  useEventListener("focus", handleFocus, isVideoWallpaper ? window : null);

  // Add video ready state handling
  useEventListener(
    "canplaythrough",
    handleCanPlayThrough,
    isVideoWallpaper ? videoRef : null
  );

  const getWallpaperStyles = (path: string): DesktopStyles => {
    if (!path || isVideoWallpaper) return {};

    const isTiled = path.includes("/wallpapers/tiles/");
    return {
      backgroundImage: `url(${path})`,
      backgroundSize: isTiled ? "64px 64px" : "cover",
      backgroundRepeat: isTiled ? "repeat" : "no-repeat",
      backgroundPosition: "center",
      transition: "background-image 0.3s ease-in-out",
    };
  };

  const finalStyles = {
    ...getWallpaperStyles(wallpaperSource),
    ...desktopStyles,
  };

  const handleIconClick = (
    appId: string,
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    event.stopPropagation();
    setSelectedAppId(appId);
  };

  const handleFinderOpen = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    localStorage.setItem("rayos:app:finder:initial-path", "/");
    const finderApp = apps.find((app) => app.id === "finder");
    if (finderApp) {
      const rect = e.currentTarget.getBoundingClientRect();
      const launchOrigin: LaunchOriginRect = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      };
      toggleApp(finderApp.id as AppId, undefined, launchOrigin);
    }
    setSelectedAppId(null);
  };

  const handleIconContextMenu = (appId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setContextMenuAppId(appId);
    setContextMenuShortcutPath(null);
    setSelectedAppId(appId);
  };

  const handleShortcutContextMenu = (shortcutPath: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setContextMenuShortcutPath(shortcutPath);
    setContextMenuAppId(null);
    setSelectedShortcutPath(shortcutPath);
  };

  const undoPush = useUndoStore((state) => state.push);

  const handleShortcutDelete = () => {
    if (!contextMenuShortcutPath) return;
    const shortcut = getItem(contextMenuShortcutPath);
    if (shortcut) {
      console.log("[Desktop] Pushing undo action for path:", contextMenuShortcutPath);
      undoPush({ type: "trash", path: contextMenuShortcutPath });
      removeItem(contextMenuShortcutPath);
    }
    setContextMenuPos(null);
    setContextMenuShortcutPath(null);
  };

  const handleOpenApp = (appId: string) => {
    if (appId === "macintosh-hd") {
      localStorage.setItem("rayos:app:finder:initial-path", "/");
      const finderApp = apps.find((app) => app.id === "finder");
      if (finderApp) {
        toggleApp(finderApp.id as AppId);
      }
    } else {
      toggleApp(appId as AppId);
    }
    setSelectedAppId(null);
    setContextMenuPos(null);
  };

  const handleEmptyTrash = () => {
    setIsEmptyTrashDialogOpen(true);
  };

  const confirmEmptyTrash = async () => {
    // 1. Permanently delete metadata from FileStore and get UUIDs of files whose content needs deletion
    const contentUUIDsToDelete = emptyTrash();

    // 2. Clear corresponding content from TRASH IndexedDB store
    try {
      // Delete content based on UUIDs collected from emptyTrash()
      for (const uuid of contentUUIDsToDelete) {
        await dbOperations.delete(STORES.TRASH, uuid);
      }
      console.log("[Desktop] Cleared trash content from IndexedDB.");
    } catch (err) {
      console.error("Error clearing trash content from IndexedDB:", err);
    }
    
    setIsEmptyTrashDialogOpen(false);
  };

  // Compute sorted apps based on selected sort type
  const sortedApps = [...apps]
    .filter(
      (app) =>
        app.id !== "finder" &&
        app.id !== "control-panels" &&
        app.id !== "applet-viewer"
    )
    .sort((a, b) => {
      switch (sortType) {
        case "name":
          return a.name.localeCompare(b.name);
        case "kind":
          return a.id.localeCompare(b.id);
        default:
          return 0;
      }
    });

  // macOS X: Only show iPod and Applet Store icons by default (with Macintosh HD shown above)
  const displayedApps =
    currentTheme === "macosx"
      ? sortedApps.filter(
          (app) => app.id === "ipod" || app.id === "applet-viewer"
        )
      : sortedApps;

  // Create default shortcuts based on theme
  // Note: Logic moved to useFilesStore.ts (ensureDefaultDesktopShortcuts)
  // to handle initialization race conditions.


  const handleCleanUp = () => {
    // Clear all saved desktop icon positions
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("rayos:desktop-pos:")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    // Clear desktopX/desktopY on all desktop shortcuts
    for (const shortcut of desktopShortcuts) {
      updateItemMetadata(shortcut.path, { desktopX: undefined, desktopY: undefined });
    }
  };

  const getContextMenuItems = (): MenuItem[] => {
    if (contextMenuShortcutPath) {
      // Shortcut-specific context menu
      return [
        {
          type: "item",
          label: t("apps.finder.contextMenu.open"),
          onSelect: () => {
            const shortcut = getItem(contextMenuShortcutPath);
            if (shortcut) {
              handleAliasOpen(shortcut);
            }
            setContextMenuPos(null);
            setContextMenuShortcutPath(null);
          },
        },
        { type: "separator" },
        {
          type: "item",
          label: t("apps.finder.contextMenu.moveToTrash"),
          onSelect: handleShortcutDelete,
        },
      ];
    } else if (contextMenuAppId) {
      // Icon-specific context menu
      if (contextMenuAppId === "trash") {
        return [
          {
            type: "item",
            label: t("apps.finder.contextMenu.open"),
            onSelect: () => {
              localStorage.setItem("rayos:app:finder:initial-path", "/Trash");
              const finderApp = apps.find((app) => app.id === "finder");
              if (finderApp) {
                toggleApp(finderApp.id as AppId);
              }
              setContextMenuPos(null);
              setContextMenuAppId(null);
            },
          },
        ];
      }
      return [
        {
          type: "item",
          label: t("apps.finder.contextMenu.open"),
          onSelect: () => handleOpenApp(contextMenuAppId),
        },
      ];
    } else {
      // Blank desktop context menu
      const trashItems = getTrashItems();
      const isTrashEmpty = trashItems.length === 0;
      
      return [
        {
          type: "submenu",
          label: t("apps.finder.contextMenu.sortBy"),
          items: [
            {
              type: "radioGroup",
              value: sortType,
              onChange: (val) => setSortType(val as SortType),
              items: [
                { label: t("apps.finder.contextMenu.name"), value: "name" },
                { label: t("apps.finder.contextMenu.kind"), value: "kind" },
              ],
            },
          ],
        },
        {
          type: "item",
          label: "Clean Up",
          onSelect: handleCleanUp,
        },
        { type: "separator" },
        {
          type: "item",
          label: t("apps.finder.contextMenu.emptyTrash"),
          onSelect: handleEmptyTrash,
          disabled: isTrashEmpty,
        },
        { type: "separator" },
        {
          type: "item",
          label: t("common.desktop.setWallpaper"),
          onSelect: () => toggleApp("control-panels"),
        },
      ];
    }
  };

  // Resolve icon for shortcut
  const getShortcutIcon = (shortcut: FileSystemItem): string => {
    // For app aliases, always resolve from app registry (ignore stored icon)
    if (shortcut.aliasType === "app" && shortcut.aliasTarget) {
      const appId = shortcut.aliasTarget as AppId;
      try {
        const iconPath = getAppIconPath(appId);
        if (iconPath) {
          return iconPath;
        }
        console.warn(`[Desktop] getAppIconPath returned empty for app ${appId}`);
      } catch (err) {
        console.warn(`[Desktop] Failed to resolve icon for app ${appId}:`, err);
      }
      return "/icons/default/application.png";
    }
    
    // For file aliases, use stored icon or resolve from target
    if (shortcut.icon && shortcut.icon.trim() !== "") {
      return shortcut.icon;
    }
    
    if (shortcut.aliasType === "file" && shortcut.aliasTarget) {
      const targetFile = getItem(shortcut.aliasTarget);
      return targetFile?.icon || "/icons/default/file.png";
    }
    
    return "/icons/default/file.png";
  };

  return (
    <div
      className="absolute inset-0 min-h-screen h-full z-[-1] desktop-background"
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenuPos({ x: e.clientX, y: e.clientY });
        setContextMenuAppId(null);
        setContextMenuShortcutPath(null);
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={finalStyles}
      {...longPressHandlers}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover z-[-10]"
        src={wallpaperSource}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        data-webkit-playsinline="true"
        style={{
          display: isVideoWallpaper ? "block" : "none",
        }}
      />
      {/* Invisible draggable area for Tauri window on Windows themes */}
      {isTauriApp && isXpTheme && (
        <div
          className="fixed top-0 left-0 right-0 z-[100]"
          style={{
            height: 32,
            cursor: "default",
          }}
          onMouseDown={async (e) => {
            if (e.buttons !== 1) return;
            try {
              const { getCurrentWindow } = await import("@tauri-apps/api/window");
              if (e.detail === 2) {
                await getCurrentWindow().toggleMaximize();
              } else {
                await getCurrentWindow().startDragging();
              }
            } catch {
              // Ignore errors - Tauri window APIs may not be available in browser
            }
          }}
        />
      )}
      <DesktopIconLayer
        isXpTheme={isXpTheme}
        isTauriApp={isTauriApp}
        currentTheme={currentTheme}
        desktopShortcuts={desktopShortcuts}
        displayedApps={displayedApps}
        trashIcon={trashIcon}
        selectedAppId={selectedAppId}
        selectedShortcutPath={selectedShortcutPath}
        setSelectedAppId={setSelectedAppId}
        setSelectedShortcutPath={setSelectedShortcutPath}
        handleFinderOpen={handleFinderOpen}
        handleIconContextMenu={handleIconContextMenu}
        handleShortcutContextMenu={handleShortcutContextMenu}
        handleAliasOpen={handleAliasOpen}
        handleIconClick={handleIconClick}
        toggleApp={toggleApp}
        getDisplayName={getDisplayName}
        getShortcutIcon={getShortcutIcon}
        apps={apps}
        t={t}
        setContextMenuPos={setContextMenuPos}
        setContextMenuAppId={setContextMenuAppId}
        setContextMenuShortcutPath={setContextMenuShortcutPath}
        updateItemMetadata={updateItemMetadata}
      />
      <RightClickMenu
        position={contextMenuPos}
        onClose={() => {
          setContextMenuPos(null);
          setContextMenuAppId(null);
          setContextMenuShortcutPath(null);
        }}
        items={getContextMenuItems()}
      />
      <ConfirmDialog
        isOpen={isEmptyTrashDialogOpen}
        onOpenChange={setIsEmptyTrashDialogOpen}
        onConfirm={confirmEmptyTrash}
        title={t("apps.finder.dialogs.emptyTrash.title")}
        description={t("apps.finder.dialogs.emptyTrash.description")}
      />
    </div>
  );
}
