
import { SheetMenu } from "@/components/admin-panel/sheet-menu";

interface NavbarProps {
  title: string;
  leftSlot?: React.ReactNode;
  navRight?: React.ReactNode;
}

export function Navbar({ title, leftSlot, navRight }: NavbarProps) {
  return (
    <header className="sticky top-0 z-10 w-full bg-background/95 shadow backdrop-blur supports-[backdrop-filter]:bg-background/60 dark:shadow-secondary">
      <div className="mx-4 sm:mx-8 flex h-14 items-center">
        <div className="flex items-center space-x-4 lg:space-x-0 flex-1">
          <SheetMenu />
          {leftSlot}
        </div>
        <div className="flex flex-1 items-center justify-end">
          {navRight}
        </div>
      </div>
    </header>
  );
}
