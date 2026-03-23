export interface AppProps<TInitialData = unknown> {
  isWindowOpen: boolean;
  onClose: () => void;
  isForeground?: boolean;
  className?: string;
  skipInitialSound?: boolean;
  initialData?: TInitialData;
  helpItems?: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
  instanceId: string;
  title?: string;
  onNavigateNext?: () => void;
  onNavigatePrevious?: () => void;
  menuBar?: React.ReactNode;
}

export interface BaseApp<TInitialData = unknown> {
  id: string;
  name: string;
  icon: string | { type: "image"; src: string };
  description: string;
  component: React.ComponentType<AppProps<TInitialData>>;
  windowConstraints?: {
    minWidth?: number | string;
    minHeight?: number | string;
    maxWidth?: number | string;
    maxHeight?: number | string;
  };
  helpItems?: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
  metadata?: {
    name: string;
    version: string;
    creator: {
      name: string;
      url: string;
    };
    github: string;
    icon: string;
  };
}

export interface AppState<TInitialData = unknown> {
  isOpen: boolean;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  isForeground?: boolean;
  initialData?: TInitialData;
}

// App-specific initial data types
export interface ControlPanelsInitialData {
  defaultTab?: string;
}

export interface FinderInitialData {
  path?: string;
}

export interface TerminalInitialData {
  prefillCommand?: string;
}

// Union type for all possible app configurations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyApp = BaseApp<any>;

// Type for the initialData that could be any of the specific types
export type AnyInitialData =
  | ControlPanelsInitialData
  | FinderInitialData
  | TerminalInitialData
  | unknown;
