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

  const handleExternalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingExternal(false);
    if (!onExternalDrop) return;
    e.stopPropagation();

    const target = e.target as HTMLElement;
    const itemEl = target.closest("[data-moment-idx]");
    if (itemEl) {
      const idx = parseInt(itemEl.getAttribute("data-moment-idx") || "0", 10);
      if (!isNaN(idx)) {
        onExternalDrop(e, idx);
        return;
      }
    }
    onExternalDrop(e, undefined);
  };

  if (!moments || moments.length === 0) return null;

  return (
    <>
      {isDraggingExternal && (
        <div
          className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center bg-cyan-950/70"
          onDrop={handleExternalDrop}
        >
          <div className="rounded-xl bg-cyan-500 px-8 py-6 text-2xl font-bold text-white shadow-2xl ring-4 ring-cyan-400">
            Drop anywhere to add moment
          </div>
        </div>
      )}
      <div className="relative w-full">
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
                onDragOver={
                  onDragOver
                    ? (e) => {
                        e.stopPropagation();
                        onDragOver(e, idx);
                      }
                    : undefined
                }
                onDrop={
                  onDrop
                    ? (e) => {
                        e.stopPropagation();
                        onDrop(e, idx);
                      }
                    : undefined
                }
                className={
                  "relative rounded" + (dragOverIndex === idx ? " ring-2 ring-primary/50" : "")
                }
              >
                <MomentCard
                  item={{ ...item, selected: selectedIds.includes(item.id as string) }}
                  anySelected={selectedIds.length > 0}
                  toggleSelect={toggleSelect}
                  onOpen={onOpen}
                />
              </div>
            );
          }}
        />
      </div>
    </>
  );
}
