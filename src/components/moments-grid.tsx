"use client";

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
  if (!moments || moments.length === 0) return null;

  const handleExternalDrop = (e: React.DragEvent) => {
    if (!onExternalDrop) return;
    e.preventDefault();
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

  return (
    <div className="relative w-full" onDrop={handleExternalDrop} onDragOver={(e) => e.preventDefault()}>
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
  );
}
