'use client';

import useSelection from '@/hooks/use-selection';
import { SheetMenu } from '@/components/admin-panel/sheet-menu';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutGrid, Trash2, SquarePen, X, RotateCcw } from 'lucide-react';
import { GrUserAdd } from 'react-icons/gr';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Marquee } from '@/components/ui/marquee';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { toast } from 'sonner';
import { useRef, useEffect, type ReactNode } from 'react';

interface NavbarProps {
  title: ReactNode;
  titleMarquee?: boolean;
  leftSlot?: React.ReactNode;
  navRight?: React.ReactNode;
}

export function Navbar({ title, titleMarquee, leftSlot, navRight }: NavbarProps) {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement | null>(null);
  const titleString = typeof title === 'string' ? title : '';
  const isStoryDetail = !!pathname && pathname.startsWith('/stories/');
  const isStories = !!titleString && titleString.toLowerCase() === 'stories';
  const isTags = !!titleString && titleString.toLowerCase() === 'tags';
  const isTrash = !!titleString && titleString.toLowerCase() === 'trash';

  // derive scope for selection store when on a story detail
  let scope = '';
  if (isStoryDetail && pathname) {
    const parts = pathname.split('/');
    const id = parts.length > 2 ? parts[2] : '';
    scope = id ? `story:${id}` : '';
  }

  const selectedCount = useSelection(s => (scope ? s.selections[scope]?.length || 0 : 0));
  const clearSelection = useSelection(s => s.clear);

  const router = useRouter();
  const displayTitle = isStoryDetail ? '' : isStories ? '' : isTags ? '' : isTrash ? '' : title;

  const createUntitledAgent = async () => {
    try {
      const agents = (await idbGet('PLAYGROUND_AGENTS')) as
        | Array<{ id: string; name: string; description: string }>
        | undefined;
      const newAgent = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: '',
        description: '',
      };
      const next = agents ? [...agents, newAgent] : [newAgent];
      await idbSet('PLAYGROUND_AGENTS', next);
      window.dispatchEvent(new Event('agents-updated'));
      router.push(`/agents/${newAgent.id}`);
    } catch (err) {
      toast.error('Failed to create agent');
    }
  };

  const onAction = (action: string) => {
    try {
      window.dispatchEvent(new CustomEvent('story-action', { detail: { action } }));
    } catch (e) {
      /* ignore */
    }
  };

  useEffect(() => {
    const setVar = () => {
      const h = headerRef.current?.offsetHeight ?? 56;
      try {
        document.documentElement.style.setProperty('--app-header-height', `${h}px`);
      } catch (e) {
        /* ignore */
      }
    };
    setVar();
    window.addEventListener('resize', setVar);
    return () => window.removeEventListener('resize', setVar);
  }, []);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-10 w-full bg-background/95 shadow backdrop-blur supports-[backdrop-filter]:bg-background/60 dark:shadow-secondary"
    >
      <div className="mx-4 sm:mx-8 flex h-14 items-center">
        <div className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-4">
          <div className="flex items-center space-x-4 lg:space-x-0">
            <SheetMenu />
            {leftSlot ? (
              leftSlot
            ) : isStoryDetail && selectedCount > 0 ? (
              <button
                onClick={() => {
                  try {
                    clearSelection(scope);
                  } catch (e) {
                    /* ignore */
                  }
                }}
                className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
                aria-label="Clear selection"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>

          <div className="flex justify-center min-w-0">
            {selectedCount ? (
              <h2 className="text-sm font-medium lowercase truncate">{selectedCount} selected</h2>
            ) : (
              <h2
                className={
                  (isStories || isStoryDetail || isTags || isTrash
                    ? 'text-sm font-medium lowercase'
                    : 'text-lg font-medium') + ' w-full max-w-[calc(100%-6rem)] truncate'
                }
              >
                {titleMarquee && displayTitle && !isStoryDetail ? (
                  <Marquee gap="12rem" className="w-full font-medium text-current">
                    {displayTitle}
                  </Marquee>
                ) : (
                  displayTitle
                )}
              </h2>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            {(pathname === '/agents' || pathname === '/agents/list') && (
              <button
                onClick={createUntitledAgent}
                className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Create agent"
              >
                <GrUserAdd size={18} />
              </button>
            )}
            {isStoryDetail && selectedCount > 0 ? (
              <TooltipProvider>
                <div className="flex items-center gap-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onAction('move-to-heap')}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                      >
                        <LayoutGrid size={18} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={10}>
                      <p>Move to Heap</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onAction('move-to-chapter')}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                      >
                        <SquarePen size={18} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={10}>
                      <p>Move to Chapter</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onAction('move-to-trash')}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={10}>
                      <p>Move to Trash</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            ) : (
              navRight
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
