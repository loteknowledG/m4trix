"use client";

import Link from "next/link";
import { Ellipsis } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { getMenuList } from "@/lib/menu-list";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CollapseMenuButton } from "@/components/admin-panel/collapse-menu-button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider
} from "@/components/ui/tooltip";
import { get } from "idb-keyval";
// removed unused imports
import CountBadge from "@/components/ui/count-badge";

interface MenuProps {
  isOpen: boolean | undefined;
}

export function Menu({ isOpen }: MenuProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [storiesList, setStoriesList] = useState<
    { id: string; title?: string; count?: number }[]
  >([]);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [heapCount, setHeapCount] = useState<number>(0);
  const [trashCount, setTrashCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const saved = (await get<{ id: string; title?: string; count?: number }[]>("stories")) || [];
        if (mounted) setStoriesList(saved);
        // determine active story id: prefer dynamic route id in pathname, then query param, otherwise stored 'stories-active'
        const param = pathname?.startsWith("/stories/")
          ? pathname.split("/")[2]
          : searchParams?.get("story");
        if (param) {
          if (mounted) setActiveStoryId(param);
        } else {
          try {
            const storedActive = await get<string>("stories-active");
            if (mounted) setActiveStoryId(storedActive || null);
          } catch (e) {
            if (mounted) setActiveStoryId(null);
          }
        }
      } catch (err) {
        logger.error("Failed to load stories for menu", err);
      }
    };
    load();

    // also load heap count
    const loadHeap = async () => {
      try {
        const items = (await get<any[]>("heap-moments")) || (await get<any[]>("heap-gifs")) || [];
        if (mounted) setHeapCount(items.length || 0);
      } catch (e) {
        if (mounted) setHeapCount(0);
      }
    };
    const loadTrash = async () => {
      try {
        const items = (await get<any[]>("trash-moments")) || (await get<any[]>("trash-gifs")) || [];
        if (mounted) setTrashCount(items.length || 0);
      } catch (e) {
        if (mounted) setTrashCount(0);
      }
    };
    loadHeap();
    loadTrash();

    const handler = () => {
      load();
      loadHeap();
      loadTrash();
    };
    window.addEventListener("stories-updated", handler);
    window.addEventListener("moments-updated", handler);
    // backward compat
    window.addEventListener("heap-updated", handler);
    return () => {
      mounted = false;
      window.removeEventListener("stories-updated", handler);
      window.removeEventListener("moments-updated", handler);
      // backward compat
      window.removeEventListener("heap-updated", handler);
    };
  }, [pathname, searchParams]);

  useEffect(() => {
    // update activeStoryId when pathname or query param changes
    if (pathname?.startsWith("/stories/")) {
      const id = pathname.split("/")[2];
      setActiveStoryId(id || null);
    } else {
      const param = searchParams?.get("story");
      if (param) setActiveStoryId(param);
    }
  }, [pathname, searchParams]);

  const menuList = getMenuList(pathname);

  return (
    <ScrollArea className="[&>div>div[style]]:!block">
      <nav className="mt-8 h-full w-full">
        <ul className="flex flex-col min-h-[calc(100vh-48px-36px-16px-32px)] lg:min-h-[calc(100vh-32px-40px-32px)] items-start space-y-1 px-2">
          {menuList.map(({ groupLabel, menus }, index) => (
            <li className={cn("w-full", groupLabel ? "pt-5" : "")} key={index}>
              {(isOpen && groupLabel) || isOpen === undefined ? (
                <p className="text-sm font-medium text-muted-foreground px-4 pb-2 max-w-[248px] truncate">
                  {groupLabel}
                </p>
              ) : !isOpen && isOpen !== undefined && groupLabel ? (
                <TooltipProvider>
                  <Tooltip delayDuration={100}>
                    <TooltipTrigger className="w-full">
                      <div className="w-full flex justify-center items-center">
                        <Ellipsis className="h-5 w-5" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{groupLabel}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <p className="pb-2"></p>
              )}
              {menus.map(
                ({ href, label, icon: Icon, active, submenus }, index) =>
                  !submenus || submenus.length === 0 ? (
                    <TooltipProvider disableHoverableContent key={index}>
                      <Tooltip delayDuration={100}>
                        <TooltipTrigger asChild>
                          <Button
                            variant={
                              (active === undefined &&
                                pathname.startsWith(href)) ||
                                active
                                ? "secondary"
                                : "ghost"
                            }
                            className={cn(
                              "relative z-40 pointer-events-auto w-full justify-start h-10 mb-1 shadow-sm transition-transform transform hover:-translate-y-1 hover:-translate-x-1 active:translate-y-1 active:translate-x-1 mc-shadow-hover mc-shadow-active",
                              // when sidebar is collapsed and this top-level menu is active, apply stronger lift and visible outline
                              isOpen === false && ((active === undefined && pathname.startsWith(href)) || active)
                                ? "hover:-translate-y-2 shadow-2xl bg-secondary/95 ring-1 ring-primary/60"
                                : ""
                            )}
                            asChild
                          >
                            <Link href={href}>
                              <span className={cn(isOpen === false ? "" : "mr-4")}>
                                <Icon size={18} />
                              </span>
                              <p
                                className={cn(
                                  "max-w-[200px] truncate",
                                  isOpen === false
                                    ? "-translate-x-96 opacity-0"
                                    : "translate-x-0 opacity-100"
                                )}
                              >
                                {label}
                              </p>
                              {label === "Heap" && (
                                <span className={cn(isOpen === false ? "hidden" : "ml-2")}>
                                  <CountBadge value={heapCount} className="text-sm text-muted-foreground" />
                                </span>
                              )}
                              {label === "Trash" && (
                                <span className={cn(isOpen === false ? "hidden" : "ml-2")}>
                                  <CountBadge value={trashCount} className="text-sm text-muted-foreground" />
                                </span>
                              )}
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        {isOpen === false && (
                          <TooltipContent side="right">
                            {label}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <div className="w-full" key={index}>
                      {/* If this menu is the Stories group, replace its submenus with the stored stories */}
                      <CollapseMenuButton
                        href={href}
                        icon={Icon}
                        label={label}
                        active={
                          // When collapsed, do NOT show Stories active if a specific story is selected
                          // (either via dynamic route /stories/:id or query param). When expanded,
                          // keep exact-match behavior for top-level.
                          label === "Stories"
                            ? isOpen === false
                              ? pathname === href && !activeStoryId
                              : pathname === href
                            : active === undefined
                              ? pathname.startsWith(href)
                              : active
                        }
                        submenus={
                          label === "Stories" && storiesList.length > 0
                            ? storiesList.map((s) => ({
                              href: `/stories/${s.id}`,
                              label: s.title && s.title.trim() ? s.title : "Untitled",
                              // only mark a story submenu active when the current route/query indicates a story is open
                              active:
                                (pathname?.startsWith("/stories/") || !!searchParams?.get("story"))
                                  ? s.id === activeStoryId
                                  : false,
                              count: s.count ?? 0
                            }))
                            : submenus
                        }
                        isOpen={isOpen}
                        disableToggle={label === "Stories" && storiesList.length === 0}
                        topCount={label === "Stories" ? storiesList.length : undefined}
                      />
                    </div>
                  )
              )}
            </li>
          ))}
          {/* Sign out removed */}
        </ul>
      </nav>
    </ScrollArea>
  );
}
