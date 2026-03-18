'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type GameCardProps = {
  id: string;
  title: string;
  subtitle?: string;
  previewSrc?: string;
  selected?: boolean;
  onClick?: (id: string) => void;
  onSelect?: (id: string) => void;
  selectable?: boolean;
  className?: string;
  /** When true, the card will expand to fill its container height */
  fullHeight?: boolean;
};

export function GameCard({
  id,
  title,
  subtitle,
  previewSrc,
  selected = false,
  onClick,
  onSelect,
  selectable = false,
  className,
  fullHeight = false,
}: GameCardProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectable && onSelect) {
      onSelect(id);
      return;
    }
    onClick?.(id);
  };

  const cardHeightClass = fullHeight ? 'h-full' : '';
  const previewHeightClass = fullHeight ? 'h-full' : 'h-56';

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'relative group w-full overflow-hidden rounded-lg border bg-zinc-900/30 shadow-sm transition-all hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary',
        selected ? 'ring-2 ring-primary/70' : 'ring-1 ring-white/10',
        cardHeightClass,
        className
      )}
    >
      <div className={cn('relative w-full bg-black/30', previewHeightClass)}>
        {previewSrc ? (
          <img
            src={previewSrc}
            alt={title}
            className={cn('w-full object-cover', fullHeight ? 'h-full' : 'h-full')}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-white/70">
            No preview
          </div>
        )}
        {selectable && (
          <div className="absolute top-3 left-3 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white">
            {selected ? 'Selected' : 'Select'}
          </div>
        )}
      </div>
      <div className="p-3 text-left">
        <div className="text-sm font-semibold text-white line-clamp-1">{title}</div>
        {subtitle ? (
          <div className="mt-1 text-xs text-white/70 line-clamp-2">{subtitle}</div>
        ) : null}
      </div>
    </button>
  );
}
