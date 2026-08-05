"use client";

import { useState, useEffect } from "react";
import JustifiedMasonry from "@/components/ui/justified-masonry";
import MomentCard from "@/components/moment-card";

type Moment = {
  id: string;
  src: string;
  name?: string;
  selected?: boolean;
};

interface MomentsGridProps {
  moments: Moment[];
  selectedIds?: string[];
  onDragStart?: (e: React.DragEvent, idx: number) => void;
  onDragEnd?: (idx: number) => void;
  onDragOver?: (e: React.DragEvent, idx: number) => void;
  onDrop?: (e: React.DragEvent, idx: number) => void;
  onExternalDrop?: (e: React.DragEvent, insertAtIdx?: number) => void;
  toggleSelect: (id: string) => void;
  dragIndexRef?: React.RefObject<number | null>;
  dragOverIndex?: number | null;
  onOpen?: (item: Moment) => void;
}

export default function MomentsGrid({
  moments,
  selectedIds = [],
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onExternalDrop,
  toggleSelect,
  dragOverIndex,
  onOpen,
}: MomentsGridProps) {
  const [isDraggingExternal, setIsDraggingExternal] = useState(false);

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types.includes("Files")) {
        setIsDraggingExternal(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) {
        setIsDraggingExternal(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingExternal(false);
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    document.addEventListener("dragenter", handleDragEnter);
    document.addEventListener("dragleave", handleDragLeave);
    document.addEventListener("drop", handleDrop);
    document.addEventListener("dragover", handleDragOver);

    return () => {
      document.removeEventListener("dragenter", handleDragEnter);
      document.removeEventListener("dragleave", handleDragLeave);
      document.removeEventListener("drop", handleDrop);
      document.removeEventListener("dragover", handleDragOver);
    };
  }, []);

  const handleItemDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingExternal(false);

    const hasFiles = Boolean(e.dataTransfer.files && e.dataTransfer.files.length > 0);
    if (hasFiles && onExternalDrop) {
      onExternalDrop(e, idx);
      return;
    }
    if (onDrop) {
      onDrop(e, idx);
    }
  };

  const handleGridDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingExternal(false);
    if (!onExternalDrop) return;

    const target = e.target as HTMLElement;
    const itemEl = target.closest("[data-moment-idx]");
    if (itemEl) {
      const idx = parseInt(itemEl.getAttribute("data-moment-idx") || "0", 10);
      if (!Number.isNaN(idx)) {
        onExternalDrop(e, idx);
        return;
      }
    }
    onExternalDrop(e, undefined);
  };

  const handleItemDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      try {
        e.dataTransfer.dropEffect = "copy";
      } catch {
        /* ignore */
      }
    }
    onDragOver?.(e, idx);
  };

  const handleGridDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) {
      try {
        e.dataTransfer.dropEffect = "copy";
      } catch {
        /* ignore */
      }
    }
  };

  if (!moments || moments.length === 0) {
    if (!onExternalDrop) return null;
    return (
      <div
        className="flex min-h-[160px] w-full items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 text-sm text-muted-foreground"
        onDragOver={handleGridDragOver}
        onDrop={handleGridDrop}
      >
        Drop moments here
      </div>
    );
  }

  return (
    <>
      {isDraggingExternal && (
        <div className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center bg-cyan-950/70">
          <div className="rounded-xl bg-cyan-500 px-8 py-6 text-2xl font-bold text-white shadow-2xl ring-4 ring-cyan-400">
            Drop anywhere to add moment
          </div>
        </div>
      )}
      <div
        className="relative w-full min-h-[120px]"
        onDragOver={handleGridDragOver}
        onDrop={handleGridDrop}
      >
        <JustifiedMasonry
          items={moments}
          targetRowHeight={220}
          itemSpacing={16}
          rowSpacing={16}
          renderItem={(item, style) => {
            const idx = moments.findIndex((m: Moment) => m.id === item.id);
            return (
              <div
                key={item.id}
                style={style}
                draggable
                data-moment-idx={idx}
                onDragStart={onDragStart ? (e) => onDragStart(e, idx) : undefined}
                onDragEnd={onDragEnd ? () => onDragEnd(idx) : undefined}
                onDragOver={onDragOver || onExternalDrop ? (e) => handleItemDragOver(e, idx) : undefined}
                onDrop={onDrop || onExternalDrop ? (e) => handleItemDrop(e, idx) : undefined}
                className={
                  "relative h-full rounded [&_img]:pointer-events-none [&_video]:pointer-events-none" +
                  (dragOverIndex === idx ? " ring-2 ring-primary/50" : "")
                }
              >
                <MomentCard
                  item={{ ...item, selected: selectedIds.includes(item.id as string) }}
                  anySelected={selectedIds.length > 0}
                  toggleSelect={toggleSelect}
                  onOpen={onOpen}
                  fullHeight
                />
              </div>
            );
          }}
        />
      </div>
    </>
  );
}
