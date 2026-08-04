import { ChevronLeft } from '@/components/icons';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SidebarToggleProps {
  isOpen: boolean | undefined;
  setIsOpen?: () => void;
}

export function SidebarToggle({ isOpen, setIsOpen }: SidebarToggleProps) {
  const left = isOpen === false ? 'calc(90px - 16px)' : 'calc(288px - 16px)';

  return (
    <div className="invisible fixed bottom-20 z-50 lg:visible" style={{ left }}>
      <Button
        type="button"
        onClick={() => setIsOpen?.()}
        variant="raised"
        size="icon"
        className="m4-pushable-icon-square !rounded-md"
        aria-label={isOpen === false ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <ChevronLeft
          className={cn(
            'h-4 w-4 transition-transform duration-700 ease-in-out',
            isOpen === false ? 'rotate-180' : 'rotate-0',
          )}
        />
      </Button>
    </div>
  );
}
