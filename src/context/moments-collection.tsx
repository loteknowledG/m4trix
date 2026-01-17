"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type Moment = { id: string; src: string; name?: string };

type MomentsCtx = {
  collection: Moment[];
  open: (id: string) => void;
  close: () => void;
  isOpen: boolean;
  currentId: string | null;
  next: () => void;
  prev: () => void;
};

const MomentsContext = createContext<MomentsCtx | null>(null);

export function MomentsProvider({ children, collection }: { children: React.ReactNode; collection: Moment[] }) {
  const [currentId, setCurrentId] = useState<string | null>(null);

  const open = useCallback((id: string) => setCurrentId(id), []);
  const close = useCallback(() => setCurrentId(null), []);

  const next = useCallback(() => {
    setCurrentId((cid) => {
      if (!cid) return null;
      const idx = collection.findIndex((m) => m.id === cid);
      if (idx === -1) return null;
      const nextIdx = idx < collection.length - 1 ? idx + 1 : 0;
      return collection[nextIdx]?.id ?? null;
    });
  }, [collection]);

  const prev = useCallback(() => {
    setCurrentId((cid) => {
      if (!cid) return null;
      const idx = collection.findIndex((m) => m.id === cid);
      if (idx === -1) return null;
      const prevIdx = idx > 0 ? idx - 1 : (collection.length ? collection.length - 1 : 0);
      return collection[prevIdx]?.id ?? null;
    });
  }, [collection]);

  const value = useMemo(
    () => ({ collection, open, close, isOpen: !!currentId, currentId, next, prev }),
    [collection, currentId, open, close, next, prev]
  );

  return <MomentsContext.Provider value={value}>{children}</MomentsContext.Provider>;
}

export function useMomentsContext(): MomentsCtx | null {
  return useContext(MomentsContext);
}
