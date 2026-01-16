"use client";

import { Circle, Check, CheckCircle } from "lucide-react";
import { MouseEvent } from "react";
import { useRouter } from "next/navigation";

type GifItem = {
  id: string;
  src: string;
  name?: string;
  selected?: boolean;
};

export default function MomentCard({
  item,
  anySelected,
  toggleSelect,
  fullHeight = false,
  onOpen,
}: {
  item: GifItem;
  anySelected: boolean;
  toggleSelect: (id: string) => void;
  fullHeight?: boolean;
  onOpen?: (item: GifItem) => void;
}) {
  const router = useRouter();
  const handleContainerClick = (e: MouseEvent) => {
    // prevent parent handlers (file upload) from triggering
    e.stopPropagation();
    e.preventDefault();
    if (anySelected) {
      toggleSelect(item.id);
      return;
    }
    // if an onOpen handler is provided, call it to open a modal overlay
    if (onOpen) {
      onOpen(item);
      return;
    }
    // otherwise navigate to the moment route
    router.push(`/moment/${item.id}`);
  };

  return (
    <div
      onClick={handleContainerClick}
      className={`relative group bg-zinc-100 dark:bg-zinc-800 rounded overflow-hidden shadow-sm ${
        item.selected ? "ring-2 ring-primary/60" : ""
      } ${fullHeight ? "h-full" : "h-40"}`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          toggleSelect(item.id);
        }}
        className={`absolute z-0 top-1 left-1 rounded-full w-7 h-7 flex items-center justify-center ${
          item.selected || anySelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        } transition-opacity pointer-events-auto`}
        aria-label="Select gif"
      >
        {!item.selected && (
          <div className="relative w-7 h-7 flex items-center justify-center">
            <Circle size={18} className="text-white/70" />
            <Check size={14} className="absolute opacity-0 hover:opacity-100 transition-opacity text-white" />
          </div>
        )}
        {item.selected && (
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground">
            <CheckCircle size={14} />
          </span>
        )}
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.src}
        alt={item.name || "gif"}
        className={`w-full ${fullHeight ? "h-full" : "h-full"} object-cover opacity-0 transition-opacity duration-500`}
        onLoad={(e) => {
          const img = e.currentTarget as HTMLImageElement;
          img.style.opacity = "1";
        }}
      />
    </div>
  );
}
