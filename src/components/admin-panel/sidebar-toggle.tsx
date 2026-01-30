import { ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SidebarToggleProps {
  isOpen: boolean | undefined;
  setIsOpen?: () => void;
}

export function SidebarToggle({ isOpen, setIsOpen }: SidebarToggleProps) {
  // Calculate left offset so the toggle sits just outside the sidebar
  const left = isOpen === false ? `calc(90px - 16px)` : `calc(288px - 16px)`;

  return (
    <div
      className="invisible lg:visible fixed bottom-20 z-50"
      style={{ left }}
    >
      <Button
        onClick={() => setIsOpen?.()}
        className="rounded-md w-8 h-8 transform transition-transform duration-150 ease-out hover:-translate-y-1 hover:-translate-x-1 active:translate-y-1 active:translate-x-1 mc-shadow-hover mc-shadow-active"
        variant="outline"
        size="icon"
      >
        <ChevronLeft
          className={cn(
            "h-4 w-4 transition-transform ease-in-out duration-700",
            isOpen === false ? "rotate-180" : "rotate-0"
          )}
        />
      </Button>
    </div>
  );
}
