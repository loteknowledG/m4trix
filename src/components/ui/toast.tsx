"use client";
import React, { createContext, useCallback, useContext, useState } from "react";

type Toast = { id: string; title: string; ts: number };

const ToastContext = createContext<{
  show: (title: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const recentRef = React.useRef<Record<string, number>>({});

  const show = useCallback((title: string) => {
    const now = Date.now();
    const last = recentRef.current[title];
    if (last && now - last < 1000) return;
    recentRef.current[title] = now;
    const id = `${now}-${Math.random()}`;
    const item: Toast = { id, title, ts: now };
    setToasts((s) => [...s, item]);
    window.setTimeout(() => {
      setToasts((s) => s.filter((t) => t.id !== id));
    }, 3000);
    // clear recent marker after 1s so same title can reappear later
    window.setTimeout(() => {
      if (recentRef.current[title] === now) delete recentRef.current[title];
    }, 1000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div aria-live="polite" className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="rounded-md bg-zinc-900 text-white px-4 py-2 shadow-md text-sm"
          >
            {t.title}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
