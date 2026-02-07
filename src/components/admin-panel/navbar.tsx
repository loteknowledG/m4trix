"use client";

import useSelection from "@/hooks/use-selection";
import { SheetMenu } from "@/components/admin-panel/sheet-menu";
import { usePathname } from "next/navigation";
import { LayoutGrid, Trash2, SquarePen, X, RotateCcw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRef, useEffect } from "react";

interface NavbarProps {
  title: string;
  leftSlot?: React.ReactNode;
  navRight?: React.ReactNode;
}

export function Navbar({ title, leftSlot, navRight }: NavbarProps) {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement | null>(null);
  const isStoryDetail = !!pathname && pathname.startsWith("/stories/");
  const isStories = !!title && title.toLowerCase() === "stories";
  const isTags = !!title && title.toLowerCase() === "tags";
  const isTrash = !!title && title.toLowerCase() === "trash";

  // derive scope for selection store when on a story detail
  let scope = "";
  if (isStoryDetail && pathname) {
    const parts = pathname.split("/");
    const id = parts.length > 2 ? parts[2] : "";
    scope = id ? `story:${id}` : "";
  }

  const selectedCount = useSelection((s) => (scope ? (s.selections[scope]?.length || 0) : 0));
  const clearSelection = useSelection((s) => s.clear);

  const displayTitle = isStoryDetail ? "" : isStories ? "" : isTags ? "" : isTrash ? "" : title;

  const onAction = (action: string) => {
    try {
      window.dispatchEvent(new CustomEvent("story-action", { detail: { action } }));
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    const setVar = () => {
      const h = headerRef.current?.offsetHeight ?? 56;
      try {
        document.documentElement.style.setProperty("--app-header-height", `${h}px`);
      } catch (e) { /* ignore */ }
    };
    setVar();
    window.addEventListener("resize", setVar);
    return () => window.removeEventListener("resize", setVar);
  }, []);

  return (
    <header ref={headerRef} className="sticky top-0 z-10 w-full bg-background/95 shadow backdrop-blur supports-[backdrop-filter]:bg-background/60 dark:shadow-secondary">
      <div className="mx-4 sm:mx-8 flex h-14 items-center">
        <div className="flex items-center space-x-4 lg:space-x-0 flex-1">
          <SheetMenu />
          {leftSlot ? (
            leftSlot
          ) : (
            isStoryDetail && selectedCount > 0 ? (
              <button
                onClick={() => { try { clearSelection(scope); } catch (e) { /* ignore */ } }}
                className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
                aria-label="Clear selection"
              >
                <X size={16} />
              </button>
            ) : null
          )}
          <div className="ml-8 truncate">
            {!leftSlot && selectedCount ? (
              <h2 className="text-sm font-medium lowercase truncate">{selectedCount} selected</h2>
            ) : (
              <h2 className={isStories || isStoryDetail || isTags || isTrash ? "text-sm font-medium lowercase truncate" : "text-lg font-medium truncate"}>
                {displayTitle}
              </h2>
            )}
          </div>
        </div>
        <div className="flex flex-1 items-center justify-end">
          {isStoryDetail && selectedCount > 0 ? (
            <TooltipProvider>
              <div className="flex items-center gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onAction("move-to-heap")}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    >
                      <LayoutGrid size={18} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={10}>
                    <p>Move to Heap</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onAction("move-to-chapter")}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    >
                      <SquarePen size={18} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={10}>
                    <p>Move to Chapter</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onAction("move-to-trash")}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={10}>
                    <p>Move to Trash</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          ) : (
            navRight
          )}
        </div>
      </div>
    </header>
  );
}
