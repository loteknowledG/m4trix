import { ChevronLeft } from "@/components/icons";

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
        className="m4-sidebar-toggle rounded-md"
        variant="outline"
        size="icon"
        aria-label={isOpen === false ? "Expand sidebar" : "Collapse sidebar"}
        title={isOpen === false ? "Expand sidebar" : "Collapse sidebar"}
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
