"use client";

import { Circle, Check, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useMomentsContext } from "@/context/moments-collection";

type Moment = {
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
  item: Moment;
  anySelected: boolean;
  toggleSelect: (id: string) => void;
  fullHeight?: boolean;
  onOpen?: (item: Moment) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const momentsCtx = useMomentsContext();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow || "";
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      try {
        document.body.style.overflow = prevOverflow;
      } catch (err) {}
    };
  }, [open]);

  // close overlay when route changes to avoid leaving a full-screen overlay active
  useEffect(() => {
    if (!open) return;
    setOpen(false);
  }, [pathname]);

  const handleContainerClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    // prevent parent handlers (file upload) from triggering
    e.stopPropagation();
    e.preventDefault();
    if (anySelected) {
      toggleSelect(item.id);
      return;
    }
    // prefer collection context if present
    if (momentsCtx && momentsCtx.open) {
      momentsCtx.open(item.id);
      return;
    }
    // if an onOpen handler is provided, call it
    if (onOpen) {
      onOpen(item);
      return;
    }
    // otherwise open internal overlay
    setOpen(true);
    return;
  };

  return (
    <div
      onClick={handleContainerClick}
      className={`relative group bg-zinc-100 dark:bg-zinc-800 rounded overflow-hidden shadow-sm transform transition-transform duration-150 ease-out hover:-translate-y-1 hover:-translate-x-1 active:translate-y-1 active:translate-x-1 mc-shadow-hover mc-shadow-active cursor-pointer ${
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
        aria-label="Select moment"
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
        alt={item.name || "moment"}
        className={`w-full ${fullHeight ? "h-full" : "h-full"} object-cover opacity-0 transition-opacity duration-500`}
        onLoad={(e) => {
          const img = e.currentTarget as HTMLImageElement;
          img.style.opacity = "1";
        }}
      />
      {open && (
        <div
          className="fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center"
          onClick={(e) => {
            // Do not close on backdrop click — only close via the X button.
            e.stopPropagation();
            e.preventDefault();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setOpen(false);
            }}
            className="absolute left-4 top-4 inline-flex items-center justify-center w-10 h-10 rounded-full bg-transparent hover:bg-white/5 text-white z-10"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
          <div className="max-w-6xl w-full h-full flex items-center justify-center">
            <div className="w-full h-full flex items-center justify-center relative">
              <div className="max-h-full max-w-full flex items-center justify-center">
                <div className="flex items-center justify-center w-full">
                  <img
                    src={item.src}
                    alt={item.name || "Moment preview"}
                    className="h-screen max-w-full object-contain rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
