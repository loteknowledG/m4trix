"use client";
import { SelectionHeaderBar } from "@/components/ui/selection-header-bar";

import { useEffect, useState } from "react";
import { get, set } from "idb-keyval";
import { logger } from "@/lib/logger";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import ErrorBoundary from "@/components/error-boundary";
import { MomentsProvider } from "@/context/moments-collection";
import MomentsGrid from "@/components/moments-grid";
import { Trash2, RotateCcw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
      await set("trash-moments", remaining);
      const heap = (await get<any[]>("heap-moments")) || (await get<any[]>("heap-gifs")) || [];
      const newHeap = [...heap, ...toRestore];
      await set("heap-moments", newHeap);
      clearSelection();
      await load();
      try {
        window.dispatchEvent(new Event("moments-updated"));
      } catch (e) { }
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
      } catch (e) { }
    } catch (e) {
      logger.error("Failed to delete selected moments", e);
    }
  };

  useEffect(() => {
    load();
    const h = () => load();
    try {
      window.addEventListener("moments-updated", h as EventListener);
    } catch (e) { }
    return () => {
      try {
        window.removeEventListener("moments-updated", h as EventListener);
      } catch (e) { }
    };
  }, []);

  return (
    <ContentLayout
      title="Trash"
      navLeft={
        anySelected ? (
          <SelectionHeaderBar
            selectedIds={Object.keys(selected).filter((k) => selected[k])}
            moments={moments}
            onSelectAll={() => {
              setSelected(Object.fromEntries(moments.map(m => [m.id, true])));
            }}
            onClearSelection={clearSelection}
          />
        ) : null
      }
      navRight={
        anySelected ? (
          <TooltipProvider>
            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={restoreSelected}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                  >
                    <RotateCcw size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={10}>
                  <p>Restore to Heap</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={deleteSelectedPermanently}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={10}>
                  <p>Delete permanently</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        ) : null
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
