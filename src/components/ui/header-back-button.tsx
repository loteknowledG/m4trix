'use client';

import Link from 'next/link';
import { ChevronLeft } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type HeaderBackButtonProps = {
  label: string;
  className?: string;
} & (
  | { href: string; onClick?: undefined }
  | { href?: undefined; onClick: () => void }
);

export function HeaderBackButton({ label, className, href, onClick }: HeaderBackButtonProps) {
  const classes = cn('m4-pushable-icon', className);

  if (href) {
    return (
      <Button asChild variant="raised" size="icon" className={classes}>
        <Link href={href} aria-label={label}>
          <ChevronLeft className="h-4 w-4" />
        </Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="raised"
      size="icon"
      className={classes}
      aria-label={label}
      onClick={onClick}
    >
      <ChevronLeft className="h-4 w-4" />
    </Button>
  );
}
