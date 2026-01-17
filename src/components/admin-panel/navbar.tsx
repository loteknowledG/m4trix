"use client";

import { SheetMenu } from "@/components/admin-panel/sheet-menu";
import { usePathname } from "next/navigation";

interface NavbarProps {
  title: string;
  leftSlot?: React.ReactNode;
  navRight?: React.ReactNode;
}

export function Navbar({ title, leftSlot, navRight }: NavbarProps) {
  const pathname = usePathname();
  const isStoryDetail = !!pathname && pathname.startsWith("/stories/");
  const isStories = !!title && title.toLowerCase() === "stories";

  const displayTitle = isStoryDetail ? "story" : isStories ? "stories" : title;

  return (
    <header className="sticky top-0 z-10 w-full bg-background/95 shadow backdrop-blur supports-[backdrop-filter]:bg-background/60 dark:shadow-secondary">
      <div className="mx-4 sm:mx-8 flex h-14 items-center">
        <div className="flex items-center space-x-4 lg:space-x-0 flex-1">
          <SheetMenu />
          {leftSlot}
          <div className="ml-4 truncate">
            <h2 className={isStories || isStoryDetail ? "text-sm font-medium lowercase truncate" : "text-lg font-medium truncate"}>
              {displayTitle}
            </h2>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-end">
          {navRight}
        </div>
      </div>
    </header>
  );
}
