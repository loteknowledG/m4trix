"use client";

import React, { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useMomentsContext } from "@/context/moments-collection";
import { X, ArrowLeft, ArrowRight } from "lucide-react";

export default function CollectionOverlay() {
  const ctx = useMomentsContext();
  const collection = ctx?.collection ?? [];
  const currentId = ctx?.currentId ?? null;
  const close = ctx?.close ?? (() => {});
  const next = ctx?.next ?? (() => {});
  const prev = ctx?.prev ?? (() => {});
  const isOpen = ctx?.isOpen ?? false;

  useEffect(() => {
    if (!ctx || !isOpen) return;
    const prevOverflow = document.body.style.overflow || "";
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      try {
        document.body.style.overflow = prevOverflow;
      } catch (e) {}
    };
  }, [ctx, isOpen, close, next, prev]);

  // close overlay when the route changes to avoid leaving a full-screen
  // overlay active after navigation (e.g., sidebar link clicks)
  const pathname = usePathname();
  useEffect(() => {
    if (!ctx || !isOpen) return;
    // close immediately on any pathname change
    close();
  }, [pathname]);
  if (!ctx || !isOpen || !currentId) return null;
  const item = collection.find((m: any) => m.id === currentId);
  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-[1200] bg-black/90 flex items-center justify-center"
      onClick={(e) => {
        // Do not close the overlay when the backdrop is clicked — only
        // the close button should dismiss it. Prevent clicks from
        // reaching underlying elements.
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
          close();
        }}
        className="absolute left-4 top-4 inline-flex items-center justify-center w-10 h-10 rounded-full bg-transparent hover:bg-white/5 text-white z-10"
        aria-label="Close"
      >
        <X size={18} />
      </button>

      <div className="max-w-6xl w-full h-full flex items-center justify-center">
        <div className="w-full h-full flex items-center justify-center relative">
          {collection.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  prev();
                }}
                aria-label="Previous"
                className="absolute left-4 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white z-20"
              >
                <ArrowLeft size={20} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  next();
                }}
                aria-label="Next"
                className="absolute right-4 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white z-20"
              >
                <ArrowRight size={20} />
              </button>
            </>
          )}

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
  );
}
