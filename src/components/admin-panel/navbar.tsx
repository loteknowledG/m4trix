'use client';

import useSelection from '@/hooks/use-selection';
import { SheetMenu } from '@/components/admin-panel/sheet-menu';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Trash2, SquarePen, X, RotateCcw } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Marquee } from '@/components/ui/marquee';
import { useEffect, useState, useRef, type ReactNode } from 'react';
import 'quill/dist/quill.snow.css';

function SiThestorygraph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M8 20q-.825 0-1.412-.587T6 18v-3h3v-2.25q-.875-.05-1.662-.387T5.9 11.35v-1.1H4.75L1.5 7q.9-1.15 2.225-1.625T6.4 4.9q.675 0 1.313.1T9 5.375V4h12v13q0 1.25-.875 2.125T18 20zm3-5h6v2q0 .425.288.713T18 18t.713-.288T19 17V6h-8v.6l6 6V14h-1.4l-2.85-2.85l-.2.2q-.35.35-.737.625T11 12.4zM5.6 8.25h2.3v2.15q.3.2.625.275t.675.075q.575 0 1.038-.175t.912-.625l.2-.2l-1.4-1.4q-.725-.725-1.625-1.088T6.4 6.9q-.5 0-.95.075t-.9.225zM15 17H8v1h7.15q-.075-.225-.112-.475T15 17m-7 1v-1z" />
    </svg>
  );
}

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

  const [isBlurbOpen, setIsBlurbOpen] = useState(false);
  const [blurb, setBlurb] = useState('');
  const [quillLoading, setQuillLoading] = useState(false);
  const [quillLoaded, setQuillLoaded] = useState(false);
  const [quillError, setQuillError] = useState<string | null>(null);
  const quillEditorRef = useRef<HTMLDivElement | null>(null);
  const quillInstanceRef = useRef<any>(null);

  const storyIconPairs = [
    { icon: '#fff', bg: '#000' },
    { icon: '#000', bg: '#fff' },
    { icon: '#ddd', bg: '#333' },
    { icon: '#333', bg: '#ddd' },
    { icon: '#ff0', bg: '#fff' },
    { icon: '#000', bg: '#ff0' },
    { icon: '#0ff', bg: '#fff' },
    { icon: '#000', bg: '#0ff' },
    { icon: '#f0f', bg: '#fff' },
    { icon: '#000', bg: '#f0f' },
  ];
  const [storyIconThemeIndex, setStoryIconThemeIndex] = useState(0);
  const storyIconTheme = storyIconPairs[storyIconThemeIndex];

  // derive scope for selection store when on a story detail
  let scope = '';
  if (isStoryDetail && pathname) {
    const parts = pathname.split('/');
    const id = parts.length > 2 ? parts[2] : '';
    scope = id ? `story:${id}` : '';
  }

  const selectedCount = useSelection(s => (scope ? s.selections[scope]?.length || 0 : 0));
  const clearSelection = useSelection(s => s.clear);

  const showStoryBlurbIcon = isStoryDetail;
  const displayTitle = isStoryDetail ? '' : isStories ? '' : isTags ? '' : isTrash ? '' : title;

  useEffect(() => {
    if (!isBlurbOpen) {
      if (quillInstanceRef.current) {
        quillInstanceRef.current.off('text-change');
        quillInstanceRef.current = null;
      }
      setQuillLoaded(false);
      setQuillLoading(false);
      return;
    }

    if (typeof window === 'undefined') return;

    // reset container before mount so Quill toolbar and editor don't duplicate
    if (quillEditorRef.current) {
      quillEditorRef.current.innerHTML = '';
    }
    setQuillLoading(true);
    setQuillError(null);

    let cancelled = false;
    const load = async (attempt = 0) => {
      if (!quillEditorRef.current) {
        if (attempt < 20 && isBlurbOpen) {
          // defer while Sheet appears and DOM matches
          setTimeout(() => {
            if (!cancelled) load(attempt + 1);
          }, 50);
          return;
        }
        if (!cancelled) {
          setQuillLoading(false);
          setQuillError(
            'Could not initialize Quill editor container. Please close/reopen or refresh.'
          );
        }
        return;
      }

      try {
        const Quill = (await import('quill')).default;
        quillInstanceRef.current = new Quill(quillEditorRef.current!, {
          theme: 'snow',
          modules: {
            toolbar: [
              ['bold', 'italic', 'underline', 'strike'],
              ['blockquote', 'code-block'],
              [{ header: 1 }, { header: 2 }],
              [{ list: 'ordered' }, { list: 'bullet' }],
              [{ indent: '-1' }, { indent: '+1' }],
              [{ size: ['small', false, 'large', 'huge'] }],
              [{ color: [] }, { background: [] }],
              [{ align: [] }],
              ['link', 'image'],
              ['clean'],
            ],
          },
          placeholder: 'Write your story blurb here...',
        });

        quillInstanceRef.current.on('text-change', () => {
          setBlurb(quillInstanceRef.current.root.innerHTML);
        });

        // Ensure overlay text is visible on dark UI backgrounds
        if (quillInstanceRef.current.root) {
          quillInstanceRef.current.root.style.color = '#000000';
          quillInstanceRef.current.root.style.backgroundColor = '#ffffff';
          quillInstanceRef.current.root.style.minHeight = '320px';
        }

        if (blurb) {
          quillInstanceRef.current.clipboard.dangerouslyPasteHTML(blurb);
        }

        setQuillLoaded(true);
      } catch (error) {
        console.error('Failed to load Quill', error);
        setQuillError('Failed to load Quill editor. Please refresh and try again.');
      } finally {
        setQuillLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (quillInstanceRef.current) {
        quillInstanceRef.current.off('text-change');
        quillInstanceRef.current = null;
      }
      setQuillLoaded(false);
      setQuillLoading(false);
    };
  }, [isBlurbOpen]);

  useEffect(() => {
    if (quillLoaded && quillInstanceRef.current) {
      const html = blurb || '';
      const currentHtml = quillInstanceRef.current.root.innerHTML;
      if (html !== currentHtml) {
        quillInstanceRef.current.clipboard.dangerouslyPasteHTML(html);
      }
    }
  }, [quillLoaded, blurb]);

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

  useEffect(() => {
    return () => {
      if (quillInstanceRef.current) {
        quillInstanceRef.current.off('text-change');
        quillInstanceRef.current = null;
      }
    };
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

          <div className="flex justify-end min-w-0">
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
                {isStoryDetail ? (
                  <span className="text-sm font-medium lowercase" />
                ) : titleMarquee && displayTitle ? (
                  <Marquee gap="12rem" duration="4s" className="w-full font-medium text-current">
                    {displayTitle}
                  </Marquee>
                ) : (
                  displayTitle
                )}
              </h2>
            )}
          </div>

          <div className="flex items-center justify-end">
            {isStoryDetail && selectedCount > 0 ? (
              <TooltipProvider>
                <div className="flex items-center gap-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onAction('move-to-heap')}
                        title="Move selected items to Heap"
                        aria-label="Move selected items to Heap"
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
                        title="Move selected items to Chapter"
                        aria-label="Move selected items to Chapter"
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
                        title="Move selected items to Trash"
                        aria-label="Move selected items to Trash"
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
            ) : showStoryBlurbIcon ? (
              <>
                <button
                  type="button"
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-zinc-300 dark:border-zinc-700 bg-background/90 hover:bg-background"
                  style={{ color: storyIconTheme.icon }}
                  onClick={() => setIsBlurbOpen(true)}
                  title="Open blurb panel"
                  aria-label="Open blurb panel"
                >
                  <SiThestorygraph className="w-5 h-5" />
                </button>

                <Sheet open={isBlurbOpen} onOpenChange={setIsBlurbOpen}>
                  <SheetContent side="right">
                    <SheetHeader>
                      <SheetTitle>Blurb</SheetTitle>
                      <SheetDescription>Write your story blurb below.</SheetDescription>
                    </SheetHeader>
                    <div className="h-full">
                      <div className="space-y-2">
                        <div
                          ref={quillEditorRef}
                          className="h-[60vh] min-h-[320px] w-full bg-white relative"
                          style={{ display: quillLoading || quillError ? 'none' : 'block' }}
                        />
                        {quillLoading && (
                          <div className="absolute inset-0 rounded border border-gray-300 bg-gray-100 p-4 text-sm text-gray-600 flex items-center justify-center pointer-events-none">
                            Loading editor...
                          </div>
                        )}
                        {quillError && (
                          <div className="absolute inset-0 rounded border border-gray-300 bg-white p-4 text-sm text-red-500 pointer-events-none">
                            <div className="absolute inset-0 bg-white/80" />
                            <div className="relative z-10">
                              <div className="mb-2">{quillError}</div>
                              <div className="mt-2">
                                <textarea
                                  value={blurb}
                                  onChange={e => setBlurb(e.target.value)}
                                  className="h-48 w-full rounded border border-gray-300 p-2 text-sm"
                                  placeholder="Write your story blurb here..."
                                />
                              </div>
                            </div>
                          </div>
                        )}
                        {!quillLoading && !quillError && !quillLoaded && (
                          <div className="absolute inset-0 rounded border border-gray-300 bg-gray-50 p-4 text-sm text-gray-600 flex items-center justify-center pointer-events-none">
                            Initializing editor...
                          </div>
                        )}
                      </div>
                    </div>
                    <SheetClose className="mt-4 inline-flex rounded bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:bg-secondary/80">
                      Close
                    </SheetClose>
                  </SheetContent>
                </Sheet>
              </>
            ) : (
              navRight
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
