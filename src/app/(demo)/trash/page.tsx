"use client";
import { SelectionHeaderBar } from "@/components/ui/selection-header-bar";

import { useEffect, useState } from "react";
import { get, set } from "idb-keyval";
import { logger } from "@/lib/logger";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import ErrorBoundary from "@/components/error-boundary";
import { MomentsProvider } from "@/context/moments-collection";
import MomentsGrid from "@/components/moments-grid";

type Moment = { id: string; src: string; name?: string };

export default function TrashPage() {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const load = async () => {
    try {
      const saved = (await get<any[]>("trash-moments")) || (await get<any[]>("trash-gifs")) || [];
      if (Array.isArray(saved)) setMoments(saved.map((s: any) => ({ id: s.id || s, src: s.src || s, name: s.name })));
      else setMoments([]);
    } catch (e) {
      logger.error("Failed to load trash", e);
      setMoments([]);
    }
  };

  const anySelected = Object.keys(selected).some((k) => selected[k]);

  const toggleSelect = (id: string) => {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  };

  const clearSelection = () => setSelected({});

  const restoreSelected = async () => {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (ids.length === 0) return;
    try {
      const trash = (await get<any[]>("trash-moments")) || (await get<any[]>("trash-gifs")) || [];
      const toRestore = trash.filter((t: any) => ids.includes(t.id || t));
      const remaining = trash.filter((t: any) => !ids.includes(t.id || t));
      // write remaining back to trash
      await set("trash-moments", remaining);
      // append to heap
      const heap = (await get<any[]>("heap-moments")) || (await get<any[]>("heap-gifs")) || [];
      const newHeap = [...heap, ...toRestore];
      await set("heap-moments", newHeap);
      // refresh
      clearSelection();
      await load();
      try {
        window.dispatchEvent(new Event("moments-updated"));
      } catch (e) { /* ignore */ }
    } catch (e) {
      logger.error("Failed to restore selected moments", e);
    }
  };

  const deleteSelectedPermanently = async () => {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} item(s) permanently? This cannot be undone.`)) return;
    try {
      const trash = (await get<any[]>("trash-moments")) || (await get<any[]>("trash-gifs")) || [];
      const remaining = trash.filter((t: any) => !ids.includes(t.id || t));
      await set("trash-moments", remaining);
      clearSelection();
      await load();
      try {
        window.dispatchEvent(new Event("moments-updated"));
      } catch (e) { /* ignore */ }
    } catch (e) {
      logger.error("Failed to delete selected moments", e);
    }
  };

  useEffect(() => {
    load();
    const h = () => load();
    try {
      window.addEventListener("moments-updated", h as EventListener);
    } catch (e) { /* ignore */ }
    return () => {
      try {
        window.removeEventListener("moments-updated", h as EventListener);
      } catch (e) { /* ignore */ }
    };
  }, []);

  return (
    <ContentLayout
      title="Trash"
      navLeft={
        <div className="w-full flex justify-end">
          <SelectionHeaderBar
            selectedIds={Object.keys(selected).filter((k) => selected[k])}
            moments={moments}
            onSelectAll={() => {
              setSelected(Object.fromEntries(moments.map(m => [m.id, true])));
            }}
            onClearSelection={clearSelection}
            actions={
              anySelected ? (
                <>
                  <button
                    onClick={restoreSelected}
                    className="btn inline-flex items-center px-3 py-1 rounded bg-primary text-primary-foreground"
                  >
                    Restore ({Object.keys(selected).filter((k) => selected[k]).length})
                  </button>
                  <button
                    onClick={deleteSelectedPermanently}
                    className="btn inline-flex items-center px-3 py-1 rounded bg-destructive text-destructive-foreground"
                  >
                    Delete permanently
                  </button>
                  <button
                    onClick={clearSelection}
                    className="inline-flex items-center px-3 py-1 rounded border"
                  >
                    Clear
                  </button>
                </>
              ) : null
            }
          />
        </div>
      }
    >
      <ErrorBoundary>
        <div className="overflow-auto" style={{ height: 'calc(100vh - var(--app-header-height, 56px))' }}>
          <div className="py-4">
            {moments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No items in Trash.</div>
            ) : (
              <MomentsProvider collection={moments}>
                <MomentsGrid
                  moments={moments}
                  selectedIds={Object.keys(selected).filter((k) => selected[k])}
                  toggleSelect={toggleSelect}
                />
              </MomentsProvider>
            )}
          </div>
        </div>
      </ErrorBoundary>
    </ContentLayout>
  );
}
