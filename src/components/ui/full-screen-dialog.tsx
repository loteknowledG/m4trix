import type { ReactNode } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type FullscreenDialogProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  trigger?: ReactNode;
  /** Prevent closing via overlay click or Escape key. */
  preventClose?: boolean;
  /** Additional class name to apply to the dialog content container. */
  contentClassName?: string;
  children?: ReactNode;
};

export function FullscreenDialog({
  open,
  defaultOpen,
  onOpenChange,
  title = 'Fullscreen Title',
  description = 'This dialog spans the entire viewport.',
  trigger = <Button>Open Fullscreen Dialog</Button>,
  preventClose = false,
  contentClassName,
  children,
}: FullscreenDialogProps) {
  return (
    <Dialog open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}

      <DialogContent
        className={`fixed left-0 top-0 translate-x-0 translate-y-0 h-screen w-screen max-w-none rounded-none p-0 ${
          contentClassName ?? ''
        }`}
        onInteractOutside={preventClose ? e => e.preventDefault() : undefined}
        onEscapeKeyDown={preventClose ? e => e.preventDefault() : undefined}
      >
        {title || description ? (
          <DialogHeader>
            {title ? <DialogTitle>{title}</DialogTitle> : null}
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
        ) : (
          // Ensure dialog remains accessible even when title/description are intentionally omitted
          <DialogTitle className="sr-only">Dialog</DialogTitle>
        )}

        {children}
      </DialogContent>
    </Dialog>
  );
}
export default FullscreenDialog;
