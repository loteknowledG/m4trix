"use client";
import Link from "next/link";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { useSidebar } from "@/hooks/use-sidebar";
import { useStore } from "@/hooks/use-store";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { get, set } from "idb-keyval";
import MomentCard from "@/components/moment-card";
import { Check, Circle, CheckCircle, X, MoreVertical, Trash2, SquarePen, Upload, ArrowLeft, ArrowRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { ToastProvider, useToast } from "@/components/ui/toast";

// Local TextScramble component — lightweight scramble for numbers
function TextScramble({
  value,
  duration = 800,
  speed = 40,
  characterSet = "0123456789",
  className,
}: {
  value: number | string;
  duration?: number;
  speed?: number;
  characterSet?: string;
  className?: string;
}) {
  const target = String(value ?? "");
  const [display, setDisplay] = useState(target);
  const rafRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const start = Date.now();
    const chars = characterSet;

    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(1, elapsed / duration);
      const out: string[] = [];
      for (let i = 0; i < target.length; i++) {
        if (Math.random() < progress) {
          out.push(target[i]);
        } else {
          out.push(chars[Math.floor(Math.random() * chars.length)]);
        }
      }
      setDisplay(out.join(""));
      if (progress >= 1) {
        // ensure final value
        setDisplay(target);
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      }
    };

    // run immediately then at an interval
    tick();
    intervalRef.current = window.setInterval(tick, speed);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [target, duration, speed, characterSet]);

  return <span className={className}>{display}</span>;
}

type GifItem = {
  id: string;
  src: string;
  name?: string;
  selected?: boolean;
};

function HeapInner() {
  const toast = useToast();
  const [storySheetOpen, setStorySheetOpen] = useState(false);

  // aggregate duplicate notifications so multiple duplicates show as one toast
  const dupSetRef = useRef<Set<string>>(new Set());
  const dupTimerRef = useRef<number | null>(null);
  const queueDuplicateToast = useCallback((src: string) => {
    dupSetRef.current.add(src);
    if (dupTimerRef.current) window.clearTimeout(dupTimerRef.current);
    dupTimerRef.current = window.setTimeout(() => {
      const n = dupSetRef.current.size;
      dupSetRef.current.clear();
      dupTimerRef.current = null;
      if (n > 0) toast.show(`${n} duplicate GIF${n > 1 ? "s" : ""} ignored`);
    }, 250);
  }, [toast]);

  const router = useRouter();
  type Story = { id: string; title: string; count?: number };
  const [stories, setStories] = useState<Story[]>([]);
  const loadStories = useCallback(async () => {
    try {
      const saved = (await get<Story[]>("stories")) || [];
      if (Array.isArray(saved)) setStories(saved);
    } catch (e) {
      console.error("Failed to load stories", e);
    }
  }, []);
  useEffect(() => {
    loadStories();
  }, [loadStories]);

  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [modalItem, setModalItem] = useState<GifItem | null>(null);
  const anySelected = gifs.some((g) => !!g.selected);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedCount = gifs.filter((g) => !!g.selected).length;
  const clearSelection = useCallback(() => {
    setGifs((s) => s.map((g) => ({ ...g, selected: false })));
  }, []);

  useEffect(() => {
    const prev = document.title;
    document.title = "matrix - heap";
    return () => {
      document.title = prev ?? "matrix";
    };
  }, []);
  
  const [isDragActive, setIsDragActive] = useState(false);

  const pathname = usePathname();

  const loadSaved = useCallback(async () => {
    try {
      const saved = (await get<GifItem[]>("heap-gifs")) || [];
      if (Array.isArray(saved)) {
        setGifs(saved);
        console.debug("Loaded saved gifs:", saved.length, saved);
        setLoaded(true);
      }
    } catch (e) {
      console.error("Failed to load saved gifs", e);
    }
  }, []);

  // load on mount and when pathname changes (so navigating back reloads)
  useEffect(() => {
    loadSaved();
  }, [loadSaved, pathname]);

  // also reload when window/tab becomes visible or focused
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") loadSaved();
    };
    const onFocus = () => loadSaved();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    // global paste handler (fallback if wrapper not focused)
    const onPasteWindow = (e: ClipboardEvent) => handlePaste(e);
    window.addEventListener("paste", onPasteWindow as EventListener);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("paste", onPasteWindow as EventListener);
    };
  }, [loadSaved]);

  // navigation helpers for modal preview
  const showPrev = useCallback(() => {
    if (!modalItem) return;
    const idx = gifs.findIndex((g) => g.id === modalItem.id);
    if (idx === -1) return;
    if (idx > 0) setModalItem(gifs[idx - 1]);
    else if (gifs.length > 0) setModalItem(gifs[gifs.length - 1]); // wrap to last
  }, [gifs, modalItem]);

  const showNext = useCallback(() => {
    if (!modalItem) return;
    const idx = gifs.findIndex((g) => g.id === modalItem.id);
    if (idx === -1) return;
    if (idx < gifs.length - 1) setModalItem(gifs[idx + 1]);
    else if (gifs.length > 0) setModalItem(gifs[0]); // wrap to first
  }, [gifs, modalItem]);

  // close modal on Escape, navigate with ArrowLeft/ArrowRight, and lock scrolling while modal open
  useEffect(() => {
    if (!modalItem) return;
    const prevOverflow = document.body.style.overflow || "";
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setModalItem(null);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        showPrev();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        showNext();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      try {
        document.body.style.overflow = prevOverflow;
      } catch (err) {
        // ignore in non-browser
      }
    };
  }, [modalItem, showPrev, showNext]);

  // persist gifs to IndexedDB whenever they change (only after initial load)
  useEffect(() => {
    if (!loaded) return;
    set("heap-gifs", gifs)
      .then(() => {
        console.debug("Saved gifs to idb", gifs.length);
        try {
          window.dispatchEvent(new CustomEvent("heap-updated", { detail: { count: gifs.length } }));
        } catch (e) {
          // ignore in non-browser
        }
      })
      .catch((e) => console.error("Failed to save gifs to idb", e));
  }, [gifs, loaded]);

  const addGifFromFile = useCallback((file: File) => {
    // reject empty files
    if (!file || file.size === 0) return;
    // only accept GIF files
    const isGifMime = file.type === "image/gif";
    const isGifExt = file.name?.toLowerCase().endsWith(".gif");
    if (!isGifMime && !isGifExt) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string | null;
      if (!result) return;
      setGifs((s) => {
        // avoid duplicates by src
        if (s.some((x) => x.src === result)) {
          queueDuplicateToast(result);
          return s;
        }
        return [{ id: `${Date.now()}-${Math.random()}`, src: result, name: file.name }, ...s];
      });
    };
    reader.readAsDataURL(file);
  }, [toast]);

  const addGifFromUrl = useCallback((url: string) => {
    // simple validation
    if (!url) return;
    const u = url.trim();
    // accept data gif or urls that look like gif
    const isDataGif = u.startsWith("data:image/gif");
    const isGifUrl = u.toLowerCase().split("?")[0].endsWith(".gif");
    if (!isDataGif && !isGifUrl) return;
    setGifs((s) => {
      if (s.some((x) => x.src === u)) {
        queueDuplicateToast(u);
        return s;
      }
      return [{ id: `${Date.now()}-${Math.random()}`, src: u, name: u }, ...s];
    });
  }, [toast]);

  const onFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => addGifFromFile(f));
  }, [addGifFromFile]);

  

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onFiles(files);
      return;
    }
    // try URL from dataTransfer
    const url = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (url) {
      addGifFromUrl(url);
    }
  }, [onFiles, addGifFromUrl]);

  const handlePaste = useCallback((e: ClipboardEvent | React.ClipboardEvent) => {
    try {
      const clipboardData = (e as any).clipboardData ?? (window as any).clipboardData;
      if (!clipboardData) return;

      const items = clipboardData.items as DataTransferItemList | null | undefined;
      let handled = false;
      if (items && items.length) {
        for (const raw of Array.from(items)) {
          const it = raw as DataTransferItem;
          // file items (images)
          if (it.kind === "file") {
            const file = it.getAsFile?.();
            if (file) {
              addGifFromFile(file);
              handled = true;
            }
          } else if (it.type && it.type.indexOf("image/") === 0) {
            const blob = it.getAsFile?.();
            if (blob) {
              addGifFromFile(blob);
              handled = true;
            }
          } else if (it.type === "text/uri-list" || it.type === "text/plain") {
            const txt = clipboardData.getData(it.type as string);
            if (txt) {
              addGifFromUrl(txt);
              handled = true;
            }
          }
        }
      }

      if (!handled) {
        const txt = clipboardData.getData("text/plain") || clipboardData.getData("text/uri-list");
        if (txt) addGifFromUrl(txt);
      }

      // prevent default to avoid accidental navigation
      if ((e as any).preventDefault) (e as any).preventDefault();
    } catch (err) {
      console.error("paste handling failed", err);
    }
  }, [addGifFromFile, addGifFromUrl]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  }, []);

  const removeGif = useCallback((id: string) => {
    setGifs((s) => s.filter((g) => g.id !== id));
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setGifs((s) => s.map((g) => (g.id === id ? { ...g, selected: !g.selected } : g)));
  }, []);

  const sidebar = useStore(useSidebar, (x) => x);
  if (!sidebar) return null;
  const { settings, setSettings } = sidebar;
  return (
    <ContentLayout
      title="Heap"
      navLeft={
        anySelected ? (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                clearSelection();
              }}
              className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
              aria-label="Clear selection"
            >
              <X size={16} />
            </button>
            <span className="text-sm font-medium">{selectedCount} selected</span>
          </div>
        ) : (
          <div className="text-sm font-medium">heap</div>
        )
      }
      navRight={
        anySelected ? (
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  aria-label="More actions"
                >
                  <MoreVertical size={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setStorySheetOpen(true);
                  }}
                >
                  <SquarePen className="mr-2" />
                  Move to Story
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setGifs((s) => s.filter((g) => !g.selected));
                  }}
                >
                  <Trash2 className="mr-2" />
                  Move to Trash
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null
      }
    >
      <div className="mt-6">
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onClick={() => fileInputRef.current?.click()}
          onPaste={handlePaste}
          tabIndex={0}
          className={`relative min-h-[60vh] rounded-lg p-4 transition-colors ${
            isDragActive
              ? "border-4 border-primary/60 bg-primary/5"
              : "border-2 border-dashed border-border/60 bg-transparent"
          }`}
        >
          <Sheet open={storySheetOpen} onOpenChange={setStorySheetOpen}>
            <SheetContent side="center" onClick={(e) => e.stopPropagation()}>
              <SheetHeader>
                <div className="flex items-center justify-between">
                  <SheetTitle>Move to story</SheetTitle>
                  <SheetClose />
                </div>
                <SheetDescription className="text-sm">Select a story to move the selected items.</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-3 overflow-y-auto max-h-[60vh]">
                <button
                  onClick={async () => {
                    setStorySheetOpen(false);
                    try {
                      const selected = gifs.filter((g) => !!g.selected);
                      if (selected.length === 0) {
                        router.push("/stories");
                        return;
                      }
                      const id = `${Date.now()}-${Math.random()}`;
                      await set(`story:${id}`, selected);
                      const saved = (await get("stories")) || [];
                      const meta = { id, title: "New story", count: selected.length };
                      await set("stories", [meta, ...saved]);
                      try {
                        window.dispatchEvent(new CustomEvent("stories-updated", { detail: { id } }));
                      } catch (e) {
                        // no-op in non-browser environments
                      }
                      await set("stories-active", id);
                        try {
                          toast.show(`Moved ${selected.length} GIFs to new story`);
                        } catch (e) {}
                      setGifs((prev) => prev.filter((g) => !g.selected));
                        router.push(`/stories/${id}`);
                    } catch (err) {
                      console.error("Failed to create story", err);
                      router.push("/stories");
                    }
                  }}
                  className="flex items-center gap-3 w-full p-3 rounded border"
                >
                  <div className="w-10 h-10 bg-zinc-800 rounded flex items-center justify-center">+</div>
                  <div className="text-sm">New story</div>
                </button>
                {stories.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No stories yet — create a new story.</div>
                ) : (
                  stories.map((s) => (
                    <button
                      key={s.id}
                      onClick={async () => {
                        setStorySheetOpen(false);
                        try {
                          const selected = gifs.filter((g) => !!g.selected);
                          if (selected.length === 0) {
                            // nothing to move, just navigate
                            router.push(`/stories/${s.id}`);
                            return;
                          }

                          const storyKey = `story:${s.id}`;
                          const existing = (await get<any>(storyKey)) || null;

                          if (Array.isArray(existing)) {
                            await set(storyKey, [...existing, ...selected]);
                          } else if (existing && Array.isArray(existing.items)) {
                            existing.items = [...existing.items, ...selected];
                            await set(storyKey, existing);
                          } else {
                            // unknown format, overwrite with array
                            await set(storyKey, selected);
                          }

                          // update stories metadata count
                          const saved = (await get<any>("stories")) || [];
                          const idx = saved.findIndex((m: any) => m.id === s.id);
                          if (idx > -1) {
                            saved[idx] = { ...saved[idx], count: (saved[idx].count || 0) + selected.length };
                            await set("stories", saved);
                          }

                          try {
                            window.dispatchEvent(new CustomEvent("stories-updated", { detail: { id: s.id } }));
                          } catch (e) {
                            // ignore
                          }

                          await set("stories-active", s.id);
                          try {
                            toast.show(`Moved ${selected.length} GIFs to ${s.title || "story"}`);
                          } catch (e) {}
                          // remove moved gifs from heap
                          setGifs((prev) => prev.filter((g) => !g.selected));
                          router.push(`/stories/${s.id}`);
                        } catch (err) {
                          console.error("Failed to add to story", err);
                          router.push(`/stories/${s.id}`);
                        }
                      }}
                      className="flex items-center gap-3 w-full p-3 rounded hover:bg-accent"
                    >
                      <div className="w-10 h-10 bg-zinc-800 rounded" />
                      <div className="text-sm text-left">
                        <div className="font-medium">{s.title}</div>
                        <div className="text-xs text-muted-foreground">{s.count ?? 0} items</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
              <SheetFooter className="mt-4">
                <div />
              </SheetFooter>
            </SheetContent>
          </Sheet>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          {/* Instruction banner — moved above the grid to avoid overlapping images */}

          

          <div className="mb-4 flex justify-center">
            <div className="bg-background/50 backdrop-blur-sm px-4 py-1 rounded text-sm text-muted-foreground flex items-center gap-2">
              <Upload size={16} />
              <span>{isDragActive ? "Release to add GIFs" : "Drag and drop or click here to upload animated GIFs"}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {gifs.length === 0 && (
              <div className="col-span-full text-center text-muted-foreground py-12">
                No GIFs yet — drop files or click to add
              </div>
            )}

            {gifs.map((g) => (
              <MomentCard key={g.id} item={g} anySelected={anySelected} toggleSelect={toggleSelect} onOpen={(it) => setModalItem(it)} />
            ))}
          </div>
          {modalItem && (
            <div
              className="fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center"
              onClick={(e) => {
                // prevent clicks on the overlay from reaching parent (which opens file picker)
                e.stopPropagation();
                e.preventDefault();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setModalItem(null);
                }}
                className="absolute left-4 top-4 inline-flex items-center justify-center w-10 h-10 rounded-full bg-transparent hover:bg-white/5 text-white z-10"
                aria-label="Close"
              >
                <X size={18} />
              </button>
              <div className="max-w-6xl w-full h-full flex items-center justify-center">
                <div className="w-full h-full flex items-center justify-center relative">
                  {/* Prev/Next controls */}
                  {gifs.length > 1 && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          showPrev();
                        }}
                        aria-label="Previous"
                        className="absolute left-4 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white z-20"
                      >
                        <ArrowLeft size={20} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          showNext();
                        }}
                        aria-label="Next"
                        className="absolute right-4 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white z-20"
                      >
                        <ArrowRight size={20} />
                      </button>
                    </>
                  )}
                  <div className="max-h-full max-w-full flex items-center justify-center">
                    {/* Plain full-height preview for modal — avoid MomentCard to remove selection UI and click handlers */}
                    <div className="flex items-center justify-center w-full">
                      <img
                        src={modalItem.src}
                        alt={modalItem.name || "GIF preview"}
                        className="h-screen max-w-full object-contain rounded"
                        onClick={(e) => {
                          // prevent clicks inside the preview from bubbling to parent upload handler
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
      </div>
    </ContentLayout>
  );
}

export default function HeapPage() {
  return (
    <ToastProvider>
      <HeapInner />
    </ToastProvider>
  );
}
