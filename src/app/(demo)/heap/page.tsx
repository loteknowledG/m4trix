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
import { Check, Circle, CheckCircle } from "lucide-react";

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

export default function HeapPage() {
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const anySelected = gifs.some((g) => !!g.selected);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedCount = gifs.filter((g) => !!g.selected).length;
  
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
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string | null;
      if (!result) return;
      setGifs((s) => [{ id: `${Date.now()}-${Math.random()}`, src: result, name: file.name }, ...s]);
    };
    reader.readAsDataURL(file);
  }, []);

  const addGifFromUrl = useCallback((url: string) => {
    // simple validation
    if (!url) return;
    setGifs((s) => [{ id: `${Date.now()}-${Math.random()}`, src: url, name: url }, ...s]);
  }, []);

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
    <ContentLayout title="Heap">
      <div className="flex items-center justify-between">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Heap</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-4 text-sm font-medium text-muted-foreground">
          <TextScramble value={selectedCount} className="inline" />
          <span className="px-2">/</span>
          <TextScramble value={gifs.length} className="inline" />
        </div>
      </div>
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
              {isDragActive ? "Release to add GIFs" : "Drop GIFs anywhere here or click to browse"}
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
                  className={`absolute z-10 top-1 left-1 rounded-full w-7 h-7 flex items-center justify-center ${
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
