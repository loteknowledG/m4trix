import { create } from "zustand";

type SelectionState = {
  selections: Record<string, string[]>;
  toggle: (scope: string, id: string) => void;
  set: (scope: string, ids: string[]) => void;
  clear: (scope?: string) => void;
  getCount: (scope: string) => number;
  getSelected: (scope: string) => string[];
};

export const useSelection = create<SelectionState>((set, get) => ({
  selections: {},
  toggle: (scope: string, id: string) =>
    set((s) => {
      const cur = new Set(s.selections[scope] || []);
      if (cur.has(id)) cur.delete(id);
      else cur.add(id);
      return { selections: { ...s.selections, [scope]: Array.from(cur) } };
    }),
  set: (scope: string, ids: string[]) => set((s) => ({ selections: { ...s.selections, [scope]: ids } })),
  clear: (scope?: string) =>
    set((s) => {
      if (!scope) return { selections: {} };
      const next = { ...s.selections };
      delete next[scope];
      return { selections: next };
    }),
  getCount: (scope: string) => {
    const cur = get().selections[scope] || [];
    return cur.length;
  },
  getSelected: (scope: string) => {
    return get().selections[scope] || [];
  },
}));

export default useSelection;
