'use client';

import { Circle, Check, CheckCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { normalizeMomentSrc } from '@/lib/moments';
import { ShineBorder } from '@/components/ui/shine-border';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { usePathname } from 'next/navigation';
import { useMomentsContext } from '@/context/moments-collection';

type Moment = {
  id: string;
  src: string;
  name?: string;
  selected?: boolean;
};

export default function MomentCard({
  item,
  anySelected,
  toggleSelect,
  fullHeight = false,
  onOpen,
}: {
  item: Moment;
  anySelected: boolean;
  toggleSelect: (id: string) => void;
  fullHeight?: boolean;
  onOpen?: (item: Moment) => void;
}) {
  const pathname = usePathname();
  const momentsCtx = useMomentsContext();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      try {
        document.body.style.overflow = prevOverflow;
      } catch (err) {
        /* ignore */
      }
    };
  }, [open]);

  // close overlay when route changes to avoid leaving a full-screen overlay active
  useEffect(() => {
    if (!open) return;
    setOpen(false);
  }, [open, pathname]);

  const handleContainerClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    // prevent parent handlers (file upload) from triggering
    e.stopPropagation();
    e.preventDefault();
    if (anySelected) {
      toggleSelect(item.id);
      return;
    }
    // prefer collection context if present
    if (momentsCtx && momentsCtx.open) {
      momentsCtx.open(item.id);
      return;
    }
    // if an onOpen handler is provided, call it
    if (onOpen) {
      onOpen(item);
      return;
    }
    // otherwise open internal overlay
    setOpen(true);
    return;
  };

  return (
    <div
      onClick={handleContainerClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleContainerClick(e as unknown as React.MouseEvent<HTMLDivElement>);
        }
      }}
      className={[
        'pushable-moment relative group rounded-md overflow-hidden border-none bg-transparent cursor-pointer',
        item.selected ? 'ring-2 ring-primary/60' : '',
        fullHeight ? 'h-full' : '',
      ].join(' ')}
      tabIndex={0}
      // 3D movement handlers + hover preview
      onMouseEnter={e => {
        const card = e.currentTarget;
        card.querySelector('.front-moment')?.setAttribute('data-state', 'hover');
        card.querySelector('.shadow')?.setAttribute('data-state', 'hover');
        if (hoverTimerRef.current) {
          clearTimeout(hoverTimerRef.current);
        }
        hoverTimerRef.current = setTimeout(() => setHovered(true), 120);
      }}
      onMouseLeave={e => {
        const card = e.currentTarget;
        card.querySelector('.front-moment')?.setAttribute('data-state', 'base');
        card.querySelector('.shadow')?.setAttribute('data-state', 'base');
        if (hoverTimerRef.current) {
          clearTimeout(hoverTimerRef.current);
          hoverTimerRef.current = null;
        }
        setHovered(false);
      }}
      onMouseDown={e => {
        const card = e.currentTarget;
        card.querySelector('.front-moment')?.setAttribute('data-state', 'active');
        card.querySelector('.shadow')?.setAttribute('data-state', 'active');
      }}
      onMouseUp={e => {
        const card = e.currentTarget;
        card.querySelector('.front-moment')?.setAttribute('data-state', 'hover');
        card.querySelector('.shadow')?.setAttribute('data-state', 'hover');
      }}
    >
      <span
        className={`shadow absolute inset-0 rounded-md bg-black/30 will-change-transform pointer-events-none filter blur-2xl transition-all duration-220 ease-[cubic-bezier(0.24,0.8,0.32,1)] ${
          hovered ? 'translate-y-[10px] opacity-[0.45]' : 'translate-y-[2px] opacity-[0.28]'
        }`}
        aria-hidden="true"
      />
      <span
        className="edge absolute inset-0 rounded-md pointer-events-none bg-[linear-gradient(to_left,_hsl(240deg_4%_16%)_0%,_hsl(240deg_4%_32%)_8%,_hsl(240deg_4%_32%)_92%,_hsl(240deg_4%_16%)_100%)]"
        aria-hidden="true"
      />
      <span
        className={`front-moment relative block rounded-2xl w-full h-full min-h-[120px] bg-zinc-100 dark:bg-zinc-800 will-change-transform select-none overflow-hidden transition-all duration-220 ease-[cubic-bezier(0.24,0.8,0.32,1)] ${
          hovered
            ? ' -translate-y-[12px] scale-[1.02] shadow-[0_20px_40px_rgba(0,0,0,0.38)] border border-white/30'
            : '-translate-y-[4px] scale-100 shadow-[0_7px_18px_rgba(0,0,0,0.2)] border border-white/10'
        }`}
      >
        <button
          onClick={e => {
            e.stopPropagation();
            e.preventDefault();
            toggleSelect(item.id);
          }}
          className={`absolute z-30 top-1 left-1 rounded-full w-7 h-7 flex items-center justify-center ${
            hovered ? 'opacity-100' : 'opacity-0'
          } transition-opacity pointer-events-auto`}
          aria-label="Select moment"
          aria-pressed={item.selected}
        >
          {!item.selected && (
            <div className="relative w-7 h-7 flex items-center justify-center">
              <Circle size={18} className="text-white/70" />
              <Check
                size={14}
                className="absolute opacity-0 hover:opacity-100 transition-opacity text-white"
              />
            </div>
          )}
          {item.selected && (
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground">
              <CheckCircle size={14} />
            </span>
          )}
        </button>
        <img
          src={normalizeMomentSrc(item.src)}
          alt={item.name || 'moment'}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover block"
        />
        {hovered && !open && (
          <div className="absolute inset-0 z-20 pointer-events-none">
            <div className="absolute inset-0 rounded-2xl border-2 border-white/30" />
            <div className="absolute inset-0 rounded-2xl bg-black/10 backdrop-blur-sm" />
            <div
              className="absolute inset-0 rounded-2xl overflow-hidden"
              style={{ pointerEvents: 'none' }}
            >
              <img
                src={normalizeMomentSrc(item.src)}
                alt={item.name || 'Moment preview'}
                className="h-full w-full object-cover opacity-90"
              />
            </div>
          </div>
        )}
      </span>
      {open && (
        <div
          className="fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center"
          onClick={e => {
            // Do not close on backdrop click — only close via the X button.
            e.stopPropagation();
            e.preventDefault();
          }}
          onMouseDown={e => {
            e.stopPropagation();
          }}
        >
          <button
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
              setOpen(false);
            }}
            className="absolute left-4 top-4 inline-flex items-center justify-center w-10 h-10 rounded-full bg-transparent hover:bg-white/5 text-white z-10"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="feather feather-x"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div className="max-w-6xl w-full h-full flex items-center justify-center">
            <div className="w-full h-full flex items-center justify-center relative">
              <div className="max-h-full max-w-full flex items-center justify-center">
                <div className="flex items-center justify-center w-full">
                  {}
                  <img
                    src={normalizeMomentSrc(item.src)}
                    alt={item.name || 'Moment preview'}
                    className="h-screen max-w-full object-contain rounded"
                    onClick={e => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
