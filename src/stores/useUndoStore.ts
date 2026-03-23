import { create } from "zustand";

export interface UndoAction {
  type: "trash";
  path: string;
}

interface UndoState {
  stack: UndoAction[];
  push: (action: UndoAction) => void;
  pop: () => UndoAction | undefined;
}

export const useUndoStore = create<UndoState>((set, get) => ({
  stack: [],
  push: (action) => set((state) => ({ stack: [...state.stack, action] })),
  pop: () => {
    const { stack } = get();
    if (stack.length === 0) return undefined;
    const action = stack[stack.length - 1];
    set({ stack: stack.slice(0, -1) });
    return action;
  },
}));
