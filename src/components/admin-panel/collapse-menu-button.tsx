"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Dot, LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CountingNumber } from "@/components/ui/counting-number";
import { Badge } from "@/components/ui/badge";
import CountBadge from "@/components/ui/count-badge";
import { DropdownMenuArrow } from "@radix-ui/react-dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "next/navigation";

type Submenu = {
  href: string;
  label: string;
  active?: boolean;
  count?: number;
};

interface CollapseMenuButtonProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  submenus: Submenu[];
  isOpen: boolean | undefined;
  href?: string;
  disableToggle?: boolean;
  topCount?: number;
}

export function CollapseMenuButton({
  icon: Icon,
  label,
  active,
  submenus,
  isOpen,
  href,
  disableToggle
  , topCount
}: CollapseMenuButtonProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isStories = label === "Stories";
  const isSubmenuActive = submenus.some((submenu) =>
    submenu.active === undefined ? submenu.href === pathname : submenu.active
  );
  const [isCollapsed, setIsCollapsed] = useState<boolean>(isSubmenuActive);
  return isOpen ? (
    <Collapsible
      open={isCollapsed}
      onOpenChange={setIsCollapsed}
      className="w-full"
    >
      <CollapsibleTrigger
        className="[&[data-state=open]>div>div>svg]:rotate-180 mb-1"
        asChild
      >
        <Button
          variant={active ? "secondary" : "ghost"}
          className="relative z-30 w-full justify-start h-10 shadow-sm transition-transform transform hover:-translate-y-1 hover:-translate-x-1 active:translate-y-1 active:translate-x-1 mc-shadow-hover mc-shadow-active"
          asChild={!!href}
        >
          {href ? (
            <Link
              href={href}
              className="w-full"
              onClick={(e) => {
                // ensure navigation even if Collapsible/Trigger intercepts the click
                e.preventDefault();
                if (!disableToggle) setIsCollapsed((v) => !v);
                router.push(href || "");
              }}
            >
              <div className="w-full items-center flex justify-between">
                <div className="flex items-center">
                  <span className="mr-4">
                    <Icon size={18} />
                  </span>
                  <p
                    className={cn(
                      "max-w-[150px] truncate",
                      isOpen ? "translate-x-0 opacity-100" : "-translate-x-96 opacity-0"
                    )}
                  >
                    {label}
                  </p>
                </div>
                {!disableToggle && (
                  <div
                    className={cn(
                      "whitespace-nowrap",
                      isOpen ? "translate-x-0 opacity-100" : "-translate-x-96 opacity-0"
                    )}
                  >
                    <ChevronDown size={18} className="transition-transform duration-200" />
                  </div>
                )}
                {/* Top-level count badge (e.g., stories total) */}
                {typeof topCount === "number" && (
                  <div className={cn(isOpen ? "ml-2" : "ml-2 hidden")}>
                    <CountBadge value={topCount} />
                  </div>
                )}
              </div>
            </Link>
          ) : (
            <div className="w-full items-center flex justify-between">
              <div className="flex items-center">
                <span className="mr-4">
                  <Icon size={18} />
                </span>
                <p
                  className={cn(
                    "max-w-[150px] truncate",
                    isOpen ? "translate-x-0 opacity-100" : "-translate-x-96 opacity-0"
                  )}
                >
                  {label}
                </p>
              </div>
              {!disableToggle && (
                <div
                  className={cn(
                    "whitespace-nowrap",
                    isOpen ? "translate-x-0 opacity-100" : "-translate-x-96 opacity-0"
                  )}
                >
                  <ChevronDown size={18} className="transition-transform duration-200" />
                </div>
              )}
              {typeof topCount === "number" && (
                <div className={cn(isOpen ? "ml-2" : "ml-2 hidden")}>
                  <CountBadge value={topCount} />
                </div>
              )}
            </div>
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="relative z-20 overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        {submenus.map(({ href, label, active, count }, index) => (
          <Button
            key={index}
            variant={
              (active === undefined && pathname === href) || active
                ? "secondary"
                : "ghost"
            }
            className="relative z-30 w-full justify-start h-10 mb-1 shadow-sm transition-transform transform hover:-translate-y-1 hover:-translate-x-1 active:translate-y-1 active:translate-x-1 mc-shadow-hover mc-shadow-active"
            asChild
          >
            <Link
              href={href}
              onClick={(e) => {
                // ensure navigation even if parent components intercept click
                e.preventDefault();
                router.push(href || "");
              }}
            >
              <span className="mr-4 ml-2">
                <Dot size={18} />
              </span>
              <p
                className={cn(
                  "max-w-[170px] truncate",
                  isOpen ? "translate-x-0 opacity-100" : "-translate-x-96 opacity-0"
                )}
              >
                {label}
              </p>
              {typeof count === "number" && (
                <span className={cn(isOpen ? "ml-2" : "ml-2 hidden")}>
                  <CountBadge value={count} />
                </span>
              )}
            </Link>
          </Button>
        ))}
      </CollapsibleContent>
    </Collapsible>
  ) : (
    <DropdownMenu>
      <TooltipProvider disableHoverableContent>
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant={active ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start h-10 mb-1 shadow-sm transition-transform transform hover:-translate-y-1 hover:-translate-x-1 active:translate-y-1 active:translate-x-1 mc-shadow-hover mc-shadow-active",
                  // when sidebar is collapsed and this is Stories, give stronger lift
                  isStories && isOpen === false ? "hover:-translate-y-2 shadow-2xl" : "",
                  active ? "bg-secondary/95 ring-1 ring-primary/60" : ""
                )}
                onClick={(e) => {
                  if (href) {
                    e.preventDefault();
                    router.push(href);
                  }
                }}
              >
                <div className="w-full items-center flex justify-between relative">
                  <div className="flex items-center">
                    <span className={cn(isOpen === false ? "" : "mr-4")}>
                      <Icon size={18} />
                    </span>
                    <p
                      className={cn(
                        "max-w-[200px] truncate",
                        isOpen === false ? "opacity-0" : "opacity-100"
                      )}
                    >
                      {label}
                    </p>
                  </div>
                    {typeof topCount === "number" && isOpen === false && (
                      <div className="absolute left-10 top-1/2 -translate-y-1/2">
                        <CountBadge value={topCount} />
                      </div>
                    )}
                </div>
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" align="start" alignOffset={2}>
            {label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent
        side="right"
        sideOffset={25}
        align="start"
        className={cn(
          // when this is the Stories menu and sidebar is collapsed, present as a lifted card
          isStories && isOpen === false
            ? "rounded-lg bg-popover/95 p-2 shadow-2xl transform transition-all duration-200 -translate-y-2 -translate-x-1"
            : ""
        )}
      >
        {href ? (
          <DropdownMenuItem asChild>
            <Link
              href={href}
              className={cn(
                "cursor-pointer w-full block",
                active ? "bg-secondary text-secondary-foreground" : ""
              )}
            >
              <div className="flex items-center justify-between w-full px-3 py-1">
                <p className="max-w-[150px] truncate">{label}</p>
                {typeof topCount === "number" && (
                  <div className="ml-2">
                    <CountBadge value={topCount} />
                  </div>
                )}
              </div>
            </Link>
          </DropdownMenuItem>
        ) : (
          <div className="flex items-center justify-between w-full">
            <DropdownMenuLabel className="max-w-[190px] truncate">{label}</DropdownMenuLabel>
            {typeof topCount === "number" && (
              <div className="ml-2">
                <CountBadge value={topCount} />
              </div>
            )}
          </div>
        )}
        <DropdownMenuSeparator />
        {submenus.map(({ href, label, active, count }, index) => (
          <DropdownMenuItem key={index} asChild>
            <Link
              href={href}
              className={cn(
                "cursor-pointer block w-full px-2 py-1 transition-transform transform hover:-translate-y-1 hover:-translate-x-1 mc-shadow-hover",
                ((active === undefined && pathname === href) || active) ? "bg-secondary" : ""
              )}
            >
              <div className="flex items-center justify-between w-full">
                <p className="max-w-[150px] truncate">{label}</p>
                {typeof count === "number" && (
                  <CountBadge value={count} />
                )}
              </div>
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuArrow className="fill-border" />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
