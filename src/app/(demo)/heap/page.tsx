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
import { usePathname } from "next/navigation";
import { get, set } from "idb-keyval";
import { Check, Circle, CheckCircle, X, MoreVertical, Trash2, SquarePen } from "lucide-react";
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

  const stories = [
    { id: "s1", title: "Pandora", count: 304 },
    { id: "s2", title: "Marion4", count: 153 },
    { id: "s3", title: "Marion", count: 253 },
  ];

  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [loaded, setLoaded] = useState(false);
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

  // persist gifs to IndexedDB whenever they change (only after initial load)
  useEffect(() => {
    if (!loaded) return;
    set("heap-gifs", gifs)
      .then(() => console.debug("Saved gifs to idb", gifs.length))
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
                  <SheetTitle>Add to story</SheetTitle>
                  <SheetClose />
                </div>
                <SheetDescription className="text-sm">Select a story to add the selected items.</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-3 overflow-y-auto max-h-[60vh]">
                <button className="flex items-center gap-3 w-full p-3 rounded border">
                  <div className="w-10 h-10 bg-zinc-800 rounded flex items-center justify-center">+</div>
                  <div className="text-sm">New story</div>
                </button>
                {stories.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      const ids = gifs.filter((g) => g.selected).map((g) => g.id);
                      console.debug("Add to story", s.id, ids);
                      // simulate adding: clear selection
                      setGifs((prev) => prev.map((g) => ({ ...g, selected: false })));
                      setStorySheetOpen(false);
                    }}
                    className="flex items-center gap-3 w-full p-3 rounded hover:bg-accent"
                  >
                    <div className="w-10 h-10 bg-zinc-800 rounded" />
                    <div className="text-sm text-left">
                      <div className="font-medium">{s.title}</div>
                      <div className="text-xs text-muted-foreground">{s.count} items</div>
                    </div>
                  </button>
                ))}
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
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-muted-foreground text-center">
              {isDragActive ? "Release to add GIFs" : "Drag and drop or click here to upload your animated GIFs"}
            </p>
          </div>

          

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {gifs.length === 0 && (
              <div className="col-span-full text-center text-muted-foreground py-12">
                No GIFs yet — drop files or click to add
              </div>
            )}

            {gifs.map((g) => (
              <div
                key={g.id}
                onClick={(e) => {
                  if (anySelected) {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleSelect(g.id);
                  }
                }}
                className={`relative group bg-zinc-100 dark:bg-zinc-800 rounded overflow-hidden shadow-sm h-40 ${
                  g.selected ? "ring-2 ring-primary/60" : ""
                }`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleSelect(g.id);
                  }}
                  className={`absolute z-0 top-1 left-1 rounded-full w-7 h-7 flex items-center justify-center ${
                    g.selected || anySelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  } transition-opacity pointer-events-auto`}
                  aria-label="Select gif"
                >
                  {!g.selected && (
                    <div className="relative w-7 h-7 flex items-center justify-center">
                      <Circle size={18} className="text-white/70" />
                      <Check size={14} className="absolute opacity-0 hover:opacity-100 transition-opacity text-white" />
                    </div>
                  )}
                  {g.selected && (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground">
                      <CheckCircle size={14} />
                    </span>
                  )}
                </button>
                <img
                  src={g.src}
                  alt={g.name || "gif"}
                  className="w-full h-full object-cover opacity-0 transition-opacity duration-500"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    img.style.opacity = "1";
                  }}
                />
              </div>
            ))}
          </div>
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
