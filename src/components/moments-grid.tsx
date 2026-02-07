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
  toggleSelect: (id: string) => void;
  dragIndexRef?: React.RefObject<number | null>;
  dragOverIndex?: number | null;
}

export default function MomentsGrid({
  moments,
  selectedIds = [],
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  toggleSelect,
  dragIndexRef,
  dragOverIndex,
}: MomentsGridProps) {
  if (!moments || moments.length === 0) return null;
  return (
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
            onDragStart={onDragStart ? (e) => onDragStart(e, idx) : undefined}
            onDragEnd={onDragEnd ? () => onDragEnd(idx) : undefined}
            onDragOver={onDragOver ? (e) => onDragOver(e, idx) : undefined}
            onDrop={onDrop ? (e) => onDrop(e, idx) : undefined}
            className={
              "relative rounded" + (dragOverIndex === idx ? " ring-2 ring-primary/50" : "")
            }
          >
            <MomentCard
              item={{ ...item, selected: selectedIds.includes(item.id as string) }}
              anySelected={selectedIds.length > 0}
              toggleSelect={toggleSelect}
            />
          </div>
        );
      }}
    />
  );
}
