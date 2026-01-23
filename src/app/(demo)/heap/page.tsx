"use client";
import Link from "next/link";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import ErrorBoundary from "@/components/error-boundary";
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
import useSelection from "@/hooks/use-selection";
import { usePathname, useRouter } from "next/navigation";
import { get, set } from "idb-keyval";
import MomentCard from "@/components/moment-card";
import { MomentsProvider } from "@/context/moments-collection";
import CollectionOverlay from "@/components/collection-overlay";
import { Check, Circle, CheckCircle, X, Trash2, SquarePen, Upload } from "lucide-react";
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

type Moment = {
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
      if (n > 0) toast.show(`${n} duplicate moment${n > 1 ? "s" : ""} ignored`);
    }, 250);
  }, [toast]);

  const router = useRouter();
  type Story = { id: string; title: string; count?: number };
  const [stories, setStories] = useState<Story[]>([]);
  const [storyPreviews, setStoryPreviews] = useState<Record<string, string | null>>({});
  const loadStories = useCallback(async () => {
    try {
      const saved = (await get<Story[]>("stories")) || [];
      if (Array.isArray(saved)) setStories(saved);
      try {
        const previewEntries = await Promise.all(
          (Array.isArray(saved) ? saved : []).map(async (s) => {
            try {
              const items = (await get<any>(`story:${s.id}`)) || [];
              const first = Array.isArray(items) && items.length > 0 ? items[0] : (items && items.items && items.items[0]) || null;
              const src = first ? (first.src || first) : null;
              return [s.id, src] as const;
            } catch (e) {
              return [s.id, null] as const;
            }
          })
        );
        const map: Record<string, string | null> = {};
        previewEntries.forEach(([id, src]) => (map[id] = src));
        setStoryPreviews(map);
      } catch (e) {
        console.warn("Failed to load story previews", e);
        setStoryPreviews({});
      }
    } catch (e) {
      console.error("Failed to load stories", e);
    }
  }, []);
  useEffect(() => {
    loadStories();
  }, [loadStories]);

  useEffect(() => {
    const handler = () => loadStories();
    window.addEventListener("stories-updated", handler);
    return () => window.removeEventListener("stories-updated", handler);
  }, [loadStories]);

  const [moments, setMoments] = useState<Moment[]>([]);
  const [loaded, setLoaded] = useState(false);

  const selectedIds = useSelection((s) => s.selections["heap"] || []);
  const toggleSelectStore = useSelection((s) => s.toggle);
  const clearSelectionStore = useSelection((s) => s.clear);
  const anySelected = (selectedIds || []).length > 0;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedCount = (selectedIds || []).length;
  const clearSelection = useCallback(() => {
    try { clearSelectionStore("heap"); } catch (e) {}
  }, [clearSelectionStore]);

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
      const saved = (await get<Moment[]>("heap-moments")) || (await get<Moment[]>("heap-gifs")) || [];
      if (Array.isArray(saved)) {
        setMoments(saved);
        console.debug("Loaded saved moments:", saved.length, saved);
        setLoaded(true);
      }
    } catch (e) {
      console.error("Failed to load saved moments", e);
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

  

  // persist moments to IndexedDB whenever they change (only after initial load)
  useEffect(() => {
    if (!loaded) return;
    set("heap-moments", moments)
      .then(() => {
        console.debug("Saved moments to idb", moments.length);
        try {
          window.dispatchEvent(new CustomEvent("moments-updated", { detail: { count: moments.length } }));
        } catch (e) {
          // ignore in non-browser
        }
      })
      .catch((e) => console.error("Failed to save moments to idb", e));
  }, [moments, loaded]);

  const addMomentFromFile = useCallback((file: File) => {
    // reject empty files
    if (!file || file.size === 0) return;
    // accept GIF and JPG files
    const isMomentMime = file.type === "image/gif" || file.type === "image/jpeg";
    const isMomentExt = file.name?.toLowerCase().endsWith(".gif") || file.name?.toLowerCase().endsWith(".jpg") || file.name?.toLowerCase().endsWith(".jpeg");
    if (!isMomentMime && !isMomentExt) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string | null;
      if (!result) return;
      setMoments((s) => {
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

  const addMomentFromUrl = useCallback((url: string) => {
    // simple validation
    if (!url) return;
    const u = url.trim();
    // accept data GIF/JPG or URLs that look like GIF/JPG (moments)
    const isDataMoment = u.startsWith("data:image/gif") || u.startsWith("data:image/jpeg");
    const isMomentUrl = [".gif", ".jpg", ".jpeg"].some(ext => u.toLowerCase().split("?")[0].endsWith(ext));
    if (!isDataMoment && !isMomentUrl) return;
    setMoments((s) => {
      if (s.some((x) => x.src === u)) {
        queueDuplicateToast(u);
        return s;
      }
      return [{ id: `${Date.now()}-${Math.random()}`, src: u, name: u }, ...s];
    });
  }, [toast]);

  const onFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => addMomentFromFile(f));
  }, [addMomentFromFile]);

  

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
      addMomentFromUrl(url);
    }
  }, [onFiles, addMomentFromUrl]);

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
              addMomentFromFile(file);
              handled = true;
            }
          } else if (it.type && it.type.indexOf("image/") === 0) {
            const blob = it.getAsFile?.();
            if (blob) {
              addMomentFromFile(blob);
              handled = true;
            }
          } else if (it.type === "text/uri-list" || it.type === "text/plain") {
            const txt = clipboardData.getData(it.type as string);
            if (txt) {
              addMomentFromUrl(txt);
              handled = true;
            }
          }
        }
      }

      if (!handled) {
        const txt = clipboardData.getData("text/plain") || clipboardData.getData("text/uri-list");
        if (txt) addMomentFromUrl(txt);
      }

      // prevent default to avoid accidental navigation
      if ((e as any).preventDefault) (e as any).preventDefault();
    } catch (err) {
      console.error("paste handling failed", err);
    }
  }, [addMomentFromFile, addMomentFromUrl]);

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

  const removeMoment = useCallback((id: string) => {
    setMoments((s) => s.filter((g) => g.id !== id));
  }, []);

  const toggleSelect = useCallback((id: string) => {
    toggleSelectStore("heap", id);
  }, [toggleSelectStore]);

  const sidebar = useStore(useSidebar, (x) => x);
  if (!sidebar) return null;
  const { settings, setSettings } = sidebar;
  return (
    <ContentLayout
      title=""
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
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setStorySheetOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded bg-secondary text-secondary-foreground"
            >
              <SquarePen size={16} />
              <span className="text-sm">Move to Story</span>
            </button>
            <button
              onClick={async (e) => {
                e.stopPropagation();
                e.preventDefault();
                try {
                  const ids = (selectedIds || []);
                  if (!ids || ids.length === 0) return;
                  const toMove = moments.filter((g) => ids.includes(g.id));
                  // append to trash storage
                  const existing = (await get<any[]>("trash-moments")) || (await get<any[]>("trash-gifs")) || [];
                  const newTrash = [...existing, ...toMove];
                  await set("trash-moments", newTrash);
                  // remove from heap
                  setMoments((prev) => prev.filter((g) => !ids.includes(g.id)));
                  try { window.dispatchEvent(new CustomEvent("moments-updated", { detail: { count: newTrash.length } })); } catch (e) {}
                } catch (err) {
                  console.error("Failed to move to trash", err);
                }
              }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded bg-destructive text-destructive-foreground"
            >
              <Trash2 size={16} />
              <span className="text-sm">Move to Trash</span>
            </button>
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
                      const selected = moments.filter((g) => (selectedIds || []).includes(g.id));
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
                          toast.show(`Moved ${selected.length} moments to new story`);
                        } catch (e) {}
                      setMoments((prev) => prev.filter((g) => !(selectedIds || []).includes(g.id)));
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
                          const selected = moments.filter((g) => (selectedIds || []).includes(g.id));
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
                            toast.show(`Moved ${selected.length} moments to ${s.title || "story"}`);
                          } catch (e) {}
                          // remove moved moments from heap
                          setMoments((prev) => prev.filter((g) => !(selectedIds || []).includes(g.id)));
                          router.push(`/stories/${s.id}`);
                        } catch (err) {
                          console.error("Failed to add to story", err);
                          router.push(`/stories/${s.id}`);
                        }
                      }}
                      className="flex items-center gap-3 w-full p-3 rounded hover:bg-accent"
                    >
                      <div className="w-10 h-10 bg-zinc-800 rounded overflow-hidden flex items-center justify-center">
                        {storyPreviews[s.id] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={storyPreviews[s.id] || undefined} alt={s.title ?? "story"} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-zinc-700" />
                        )}
                      </div>
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
              <span>{isDragActive ? "Release to add moments" : "Drag and drop or click here to upload moments"}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {moments.length === 0 && (
              <div className="col-span-full text-center text-muted-foreground py-12">
                  No moments yet — drop files or click to add
                </div>
            )}
          </div>
          <MomentsProvider collection={moments}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
              {moments.length === 0 && (
                <div className="col-span-full text-center text-muted-foreground py-12">
                  No moments yet — drop files or click to add
                </div>
              )}

              {moments.map((g) => (
                <MomentCard key={g.id} item={{ ...g, selected: (selectedIds || []).includes(g.id) }} anySelected={anySelected} toggleSelect={(tid) => toggleSelect(tid)} />
              ))}
            </div>
            <CollectionOverlay />
          </MomentsProvider>
         
        </div>
      </div>
    </ContentLayout>
  );
}

export default function HeapPage() {
  return (
    <ToastProvider>
      <ErrorBoundary>
        <HeapInner />
      </ErrorBoundary>
    </ToastProvider>
  );
}
