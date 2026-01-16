"use client";

import Link from "next/link";
import { Ellipsis, LogOut } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
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
import { CountingNumber } from "@/components/ui/counting-number";
import { Badge } from "@/components/ui/badge";

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
        console.error("Failed to load stories for menu", err);
      }
    };
    load();
      // also load heap count
      const loadHeap = async () => {
        try {
          const items = (await get<any[]>("heap-gifs")) || [];
          if (mounted) setHeapCount(items.length || 0);
        } catch (e) {
          if (mounted) setHeapCount(0);
        }
      };
      loadHeap();
    const handler = () => {
      load();
        loadHeap();
    };
    window.addEventListener("stories-updated", handler);
      window.addEventListener("heap-updated", handler);
    return () => {
      mounted = false;
      window.removeEventListener("stories-updated", handler);
        window.removeEventListener("heap-updated", handler);
    };
  }, []);

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
                    <div className="w-full" key={index}>
                      <TooltipProvider disableHoverableContent>
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
                              className="w-full justify-start h-10 mb-1"
                              asChild
                            >
                              <Link href={href}>
                                <span
                                  className={cn(isOpen === false ? "" : "mr-4")}
                                >
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
                                  <span className={cn(isOpen === false ? "hidden" : "ml-2") }>
                                    <Badge shape="circle" variant="black">
                                      <CountingNumber value={heapCount} className="text-sm text-muted-foreground" />
                                    </Badge>
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
                    </div>
                  ) : (
                    <div className="w-full" key={index}>
                      {/* If this menu is the Stories group, replace its submenus with the stored stories */}
                      <CollapseMenuButton
                        href={href}
                        icon={Icon}
                        label={label}
                        active={
                          // For the Stories top-level, only mark active on exact /stories path
                          label === "Stories"
                            ? pathname === href
                            : active === undefined
                            ? pathname.startsWith(href)
                            : active
                        }
                        submenus={
                          label === "Stories" && storiesList.length > 0
                            ? storiesList.map((s) => ({
                                href: `/stories/${s.id}`,
                                label: s.title && s.title.trim() ? s.title : "Untitled",
                                // don't mark story submenus active when top-level /stories is selected
                                active: pathname === "/stories" ? false : s.id === activeStoryId,
                                count: s.count ?? 0
                              }))
                            : submenus
                        }
                        isOpen={isOpen}
                        disableToggle={label === "Stories" && storiesList.length === 0}
                      />
                    </div>
                  )
              )}
            </li>
          ))}
          <li className="w-full grow flex items-end">
            <TooltipProvider disableHoverableContent>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => {}}
                    variant="outline"
                    className="w-full justify-center h-10 mt-5"
                  >
                    <span className={cn(isOpen === false ? "" : "mr-4")}>
                      <LogOut size={18} />
                    </span>
                    <p
                      className={cn(
                        "whitespace-nowrap",
                        isOpen === false ? "opacity-0 hidden" : "opacity-100"
                      )}
                    >
                      Sign out
                    </p>
                  </Button>
                </TooltipTrigger>
                {isOpen === false && (
                  <TooltipContent side="right">Sign out</TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </li>
        </ul>
      </nav>
    </ScrollArea>
  );
}
