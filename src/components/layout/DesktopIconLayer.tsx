import { useState, useRef, useCallback, useEffect } from "react";
import { FileIcon } from "@/apps/finder/components/FileIcon";
import { FileSystemItem } from "@/stores/useFilesStore";
import { AnyApp } from "@/apps/base/types";
import { AppId } from "@/config/appRegistry";
import { getAppIconPath } from "@/config/appRegistry";
import type { LaunchOriginRect } from "@/stores/useAppStore";
import type { TFunction } from "i18next";

// Grid layout constants
const ICON_W = 96;
const ICON_H = 100;
const GRID_PAD = 16;
const MENUBAR_H = 38;
const DRAG_THRESHOLD = 5;

// ---------- Types ----------

interface IconItem {
  id: string;
  type: "hd" | "trash" | "shortcut" | "app";
  label: string;
  icon: string;
  shortcut?: FileSystemItem;
  app?: AnyApp;
}

interface DragState {
  iconId: string;
  startPointerX: number;
  startPointerY: number;
  offsetX: number;
  offsetY: number;
  currentX: number;
  currentY: number;
  isDragging: boolean;
}

export interface DesktopIconLayerProps {
  isXpTheme: boolean;
  isTauriApp: boolean;
  currentTheme: string;
  desktopShortcuts: FileSystemItem[];
  displayedApps: AnyApp[];
  trashIcon: string;
  selectedAppId: string | null;
  selectedShortcutPath: string | null;
  setSelectedAppId: (id: string | null) => void;
  setSelectedShortcutPath: (path: string | null) => void;
  handleFinderOpen: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleIconContextMenu: (appId: string, e: React.MouseEvent) => void;
  handleShortcutContextMenu: (path: string, e: React.MouseEvent) => void;
  handleAliasOpen: (shortcut: FileSystemItem, launchOrigin?: LaunchOriginRect) => void;
  handleIconClick: (appId: string, e: React.MouseEvent<HTMLDivElement>) => void;
  toggleApp: (appId: AppId, initialData?: unknown, launchOrigin?: LaunchOriginRect) => void;
  getDisplayName: (shortcut: FileSystemItem) => string;
  getShortcutIcon: (shortcut: FileSystemItem) => string;
  apps: AnyApp[];
  t: TFunction;
  setContextMenuPos: (pos: { x: number; y: number } | null) => void;
  setContextMenuAppId: (id: string | null) => void;
  setContextMenuShortcutPath: (path: string | null) => void;
  updateItemMetadata: (path: string, metadata: Record<string, unknown>) => void;
}

// ---------- Position helpers ----------

function getSavedPos(item: IconItem): { x: number; y: number } | null {
  if (item.type === "hd" || item.type === "trash") {
    const raw = localStorage.getItem(`rayos:desktop-pos:${item.id}`);
    if (raw) {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return null;
  }
  if (item.type === "app") {
    const raw = localStorage.getItem(`rayos:desktop-pos:app:${item.id}`);
    if (raw) {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return null;
  }
  if (item.type === "shortcut" && item.shortcut) {
    const { desktopX, desktopY } = item.shortcut;
    if (desktopX !== undefined && desktopY !== undefined) {
      return { x: desktopX, y: desktopY };
    }
  }
  return null;
}

function savePos(item: IconItem, x: number, y: number, updateItemMetadata: DesktopIconLayerProps["updateItemMetadata"]) {
  if (item.type === "hd" || item.type === "trash") {
    localStorage.setItem(`rayos:desktop-pos:${item.id}`, JSON.stringify({ x, y }));
  } else if (item.type === "app") {
    localStorage.setItem(`rayos:desktop-pos:app:${item.id}`, JSON.stringify({ x, y }));
  } else if (item.type === "shortcut" && item.shortcut) {
    updateItemMetadata(item.shortcut.path, { desktopX: x, desktopY: y });
  }
}

function computeDefaultPositions(
  items: IconItem[],
  containerW: number,
  containerH: number
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  // Trash sits at bottom-right; non-trash icons fill columns from top-right,
  // wrapping leftward when a column is full.
  const trashY = containerH - GRID_PAD - ICON_H;
  const maxY = trashY - ICON_H; // leave room above trash
  let colX = containerW - GRID_PAD - ICON_W;
  let currentY = MENUBAR_H + GRID_PAD;

  for (const item of items) {
    if (item.type === "trash") {
      positions[item.id] = { x: containerW - GRID_PAD - ICON_W, y: trashY };
    } else {
      if (currentY > maxY) {
        // Wrap to next column to the left
        colX -= ICON_W;
        currentY = MENUBAR_H + GRID_PAD;
      }
      positions[item.id] = { x: colX, y: currentY };
      currentY += ICON_H;
    }
  }
  return positions;
}

// ---------- Component ----------

export function DesktopIconLayer(props: DesktopIconLayerProps) {
  const {
    currentTheme,
    desktopShortcuts,
    displayedApps,
    trashIcon,
    selectedAppId,
    selectedShortcutPath,
    setSelectedAppId,
    setSelectedShortcutPath,
    handleFinderOpen,
    handleIconContextMenu,
    handleShortcutContextMenu,
    handleAliasOpen,
    handleIconClick,
    toggleApp,
    getDisplayName,
    getShortcutIcon,
    apps,
    t,
    updateItemMetadata,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  // Force re-render after position changes so defaults recalculate
  const [posVersion, setPosVersion] = useState(0);

  // Build unified icon list
  const iconItems: IconItem[] = [];

  // 1. Macintosh HD
  iconItems.push({
    id: "macintosh-hd",
    type: "hd",
    label: t("common.desktop.macintoshHD", "Macintosh HD"),
    icon: "/icons/mac.png",
  });

  // 2. Desktop shortcuts
  for (const shortcut of desktopShortcuts) {
    iconItems.push({
      id: `shortcut:${shortcut.path}`,
      type: "shortcut",
      label: getDisplayName(shortcut),
      icon: getShortcutIcon(shortcut),
      shortcut,
    });
  }

  // 3. App icons (non-system7 themes only)
  if (currentTheme !== "system7") {
    for (const app of displayedApps) {
      iconItems.push({
        id: app.id,
        type: "app",
        label: app.name,
        icon: getAppIconPath(app.id as AppId),
        app,
      });
    }
  }

  // 4. Trash (always last)
  iconItems.push({
    id: "trash",
    type: "trash",
    label: t("common.desktop.trash", "Trash"),
    icon: trashIcon,
  });

  // Compute positions
  const containerW = containerRef.current?.clientWidth || window.innerWidth;
  const containerH = containerRef.current?.clientHeight || window.innerHeight;
  const defaults = computeDefaultPositions(iconItems, containerW, containerH);

  // Resolve position for each icon: saved > default
  const getPos = useCallback(
    (item: IconItem): { x: number; y: number } => {
      // Suppress lint: posVersion is used to trigger recalculation
      void posVersion;
      const saved = getSavedPos(item);
      if (saved) return saved;
      return defaults[item.id] || { x: 0, y: 0 };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [defaults, posVersion]
  );

  // ---------- Drag handlers ----------

  const handlePointerDown = useCallback(
    (item: IconItem, e: React.PointerEvent<HTMLDivElement>) => {
      // Only left mouse button
      if (e.button !== 0) return;
      e.stopPropagation();

      const pos = getPos(item);
      setDragState({
        iconId: item.id,
        startPointerX: e.clientX,
        startPointerY: e.clientY,
        offsetX: e.clientX - pos.x,
        offsetY: e.clientY - pos.y,
        currentX: pos.x,
        currentY: pos.y,
        isDragging: false,
      });
    },
    [getPos]
  );

  useEffect(() => {
    if (!dragState) return;

    const handleMove = (e: PointerEvent) => {
      setDragState((prev) => {
        if (!prev) return null;
        const dx = e.clientX - prev.startPointerX;
        const dy = e.clientY - prev.startPointerY;
        const isDragging =
          prev.isDragging || Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD;

        return {
          ...prev,
          currentX: e.clientX - prev.offsetX,
          currentY: e.clientY - prev.offsetY,
          isDragging,
        };
      });
    };

    const handleUp = () => {
      setDragState((prev) => {
        if (!prev || !prev.isDragging) {
          // Was a click, not a drag - clear state
          return null;
        }

        // Save exactly where dropped (no grid snap)
        const item = iconItems.find((i) => i.id === prev.iconId);
        if (item) {
          savePos(item, prev.currentX, prev.currentY, updateItemMetadata);
        }

        setPosVersion((v) => v + 1);
        return null;
      });
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
    return () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
    };
    // iconItems changes every render but we only need current drag's iconId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragState !== null, updateItemMetadata]);

  // ---------- Icon interaction handlers ----------

  const onIconClick = useCallback(
    (item: IconItem, e: React.MouseEvent<HTMLDivElement>) => {
      // If we just finished dragging, suppress click
      if (dragState?.isDragging) return;

      e.stopPropagation();
      if (item.type === "hd" || item.type === "trash") {
        handleIconClick(item.id, e);
      } else if (item.type === "shortcut" && item.shortcut) {
        setSelectedShortcutPath(item.shortcut.path);
        setSelectedAppId(null);
      } else if (item.type === "app") {
        handleIconClick(item.id, e);
      }
    },
    [dragState?.isDragging, handleIconClick, setSelectedShortcutPath, setSelectedAppId]
  );

  const onIconDoubleClick = useCallback(
    (item: IconItem, e: React.MouseEvent<HTMLDivElement>) => {
      if (dragState?.isDragging) return;

      if (item.type === "hd") {
        handleFinderOpen(e);
      } else if (item.type === "trash") {
        e.stopPropagation();
        localStorage.setItem("rayos:app:finder:initial-path", "/Trash");
        const finderApp = apps.find((app) => app.id === "finder");
        if (finderApp) {
          const rect = e.currentTarget.getBoundingClientRect();
          const launchOrigin: LaunchOriginRect = {
            x: rect.left, y: rect.top, width: rect.width, height: rect.height,
          };
          toggleApp(finderApp.id as AppId, undefined, launchOrigin);
        }
      } else if (item.type === "shortcut" && item.shortcut) {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const launchOrigin: LaunchOriginRect = {
          x: rect.left, y: rect.top, width: rect.width, height: rect.height,
        };
        handleAliasOpen(item.shortcut, launchOrigin);
        setSelectedShortcutPath(null);
      } else if (item.type === "app" && item.app) {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const launchOrigin: LaunchOriginRect = {
          x: rect.left, y: rect.top, width: rect.width, height: rect.height,
        };
        toggleApp(item.app.id as AppId, undefined, launchOrigin);
        setSelectedAppId(null);
      }
    },
    [dragState?.isDragging, handleFinderOpen, apps, toggleApp, handleAliasOpen, setSelectedShortcutPath, setSelectedAppId]
  );

  const onIconContextMenu = useCallback(
    (item: IconItem, e: React.MouseEvent) => {
      if (item.type === "hd" || item.type === "trash" || item.type === "app") {
        handleIconContextMenu(item.id, e);
      } else if (item.type === "shortcut" && item.shortcut) {
        handleShortcutContextMenu(item.shortcut.path, e);
      }
    },
    [handleIconContextMenu, handleShortcutContextMenu]
  );

  // ---------- Render ----------

  const isSelected = (item: IconItem): boolean => {
    if (item.type === "shortcut" && item.shortcut) {
      return selectedShortcutPath === item.shortcut.path;
    }
    return selectedAppId === item.id;
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    >
      {iconItems.map((item) => {
        const pos =
          dragState?.iconId === item.id
            ? { x: dragState.currentX, y: dragState.currentY }
            : getPos(item);

        return (
          <div
            key={item.id}
            className="absolute pointer-events-auto"
            style={{
              left: pos.x,
              top: pos.y,
              width: ICON_W,
              zIndex: dragState?.iconId === item.id ? 9999 : 1,
              cursor: dragState?.iconId === item.id && dragState.isDragging ? "grabbing" : "default",
            }}
            onPointerDown={(e) => handlePointerDown(item, e)}
          >
            <FileIcon
              name={item.label}
              isDirectory={item.type === "hd"}
              icon={item.icon}
              isSelected={isSelected(item)}
              context="desktop"
              size="large"
              onClick={(e) => onIconClick(item, e)}
              onDoubleClick={(e) => onIconDoubleClick(item, e)}
              onContextMenu={(e) => onIconContextMenu(item, e)}
            />
          </div>
        );
      })}
    </div>
  );
}
