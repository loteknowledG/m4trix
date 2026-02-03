"use client";
import { useCallback, useRef, useState } from "react";
import { get, set, clear } from "idb-keyval";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import JsonTree from "@/components/ui/json-tree";
import { logger } from "@/lib/logger";


function removeSrc(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(removeSrc);
  if (typeof obj === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "src") continue;
      out[k] = removeSrc(v);
    }
    return out;
  }
  return obj;
}

function sanitizeAndStringify(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(removeSrc(parsed), null, 2);
  } catch (e) {
    // fallback: remove simple "src": "..." occurrences to avoid leaking large base64/urls
    try {
      return raw.replace(/"src"\s*:\s*"[^"]*"/g, '"src":"<removed>"');
    } catch (e2) {
      return raw;
    }
  }
}

export default function BackupsPage() {
  const importRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [exportedText, setExportedText] = useState<string | null>(null);
  const [exportedObj, setExportedObj] = useState<any | null>(null);
  const [importedText, setImportedText] = useState<string | null>(null);
  const MAX_EXPORT_BYTES = 5 * 1024 * 1024; // 5 MB
  const MAX_IMPORT_BYTES = 10 * 1024 * 1024; // 10 MB

  const handleExport = useCallback(async () => {
    let previewSummary: any = null
    try {
      const heap = (await get("heap-moments")) || (await get("heap-gifs")) || [];
      const trash = (await get("trash-moments")) || (await get("trash-gifs")) || [];
      // include stories and per-story items
      const savedStories = (await get<{ id: string; title?: string; count?: number }[]>("stories")) || [];
      const storiesWithItems = await Promise.all(
        savedStories.map(async (s) => {
          try {
            const items = (await get<any[]>(`story:${s.id}`)) || [];
            return { ...s, items };
          } catch (e) {
            return { ...s, items: [] };
          }
        })
      );

      const payload = {
        heap,
        trash,
        stories: storiesWithItems,
      };
      previewSummary = {
        heapCount: Array.isArray(heap) ? heap.length : 0,
        trashCount: Array.isArray(trash) ? trash.length : 0,
        storiesCount: Array.isArray(savedStories) ? savedStories.length : 0,
      };
      // collect any per-item overlay text saved in localStorage
      try {
        const overlays: Record<string, any> = {};
        const collectFor = (items: any[] | undefined) => {
          if (!Array.isArray(items)) return;
          for (const it of items) {
            const id = it?.id;
            if (!id) continue;
            try {
              const raw = localStorage.getItem(`overlay:text:${id}`);
              if (raw) {
                try {
                  overlays[id] = JSON.parse(raw);
                } catch (e) {
                  overlays[id] = raw;
                }
              }
            } catch (e) { }
          }
        };
        collectFor(heap);
        collectFor(trash);
        for (const s of storiesWithItems) collectFor(s.items);
        if (Object.keys(overlays).length > 0) (payload as any).overlays = overlays;
      } catch (e) {
        // continue without overlays on error
      }
      // Prepare preview (sanitized) and download (full) strings.
      const previewStr = (() => {
        try {
          return JSON.stringify(removeSrc(payload), null, 2);
        } catch (err) {
          return JSON.stringify(removeSrc(previewSummary), null, 2);
        }
      })();

      let downloadStr: string | null = null;
      try {
        downloadStr = JSON.stringify(payload, null, 2);
      } catch (err) {
        // try removing overlays then retry
        if ((payload as any).overlays) {
          const tmp = { ...payload } as any;
          delete tmp.overlays;
          try {
            downloadStr = JSON.stringify(tmp, null, 2);
          } catch (err2) {
            setExportedText(previewStr);
            setExportedObj(removeSrc(previewSummary));
            setMessage("Export failed: payload too large (showing summary)");
            setTimeout(() => setMessage(null), 4000);
            return;
          }
        } else {
          setExportedText(previewStr);
          setExportedObj(removeSrc(previewSummary));
          setMessage("Export failed: could not serialize payload (showing summary)");
          setTimeout(() => setMessage(null), 4000);
          return;
        }
      }

      // Check size of full download; if too large, show trimmed preview and skip download
      try {
        const encoder = new TextEncoder();
        if (downloadStr && encoder.encode(downloadStr).length > MAX_EXPORT_BYTES) {
          // payload is large — keep a sanitized object for the tree preview and show a trimmed text summary,
          // but still allow the user to download the full payload to a file.
          setExportedObj(removeSrc(payload));
          setExportedText(previewStr.slice(0, 1024) + "\n\n...export trimmed (too large)...");
          setMessage("Export large: showing trimmed preview but download will proceed");
          setTimeout(() => setMessage(null), 4000);
          // do not return; proceed to create blob and trigger download
        }
      } catch (e) {
        // ignore encoding errors
      }

      // Show sanitized preview but download the full payload (downloadStr)
      setExportedObj(removeSrc(payload));
      setExportedText(previewStr);
      const blob = new Blob([downloadStr || previewStr], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `moments-backup-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      logger.error("Export failed", e);
      try {
        if (previewSummary) {
          const s = JSON.stringify(removeSrc(previewSummary), null, 2);
          setExportedObj(removeSrc(previewSummary));
          setExportedText(s);
        }
      } catch (er) { }
      setMessage("Export failed");
      setTimeout(() => setMessage(null), 4000);
    }
  }, [MAX_EXPORT_BYTES]);

  const handleImport = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    // Always read the full file and attempt to parse it (will be sanitized for preview)
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || "null"));
        try {
          setImportedText(JSON.stringify(removeSrc(parsed), null, 2));
        } catch (e) {
          try {
            setImportedText(sanitizeAndStringify(String(reader.result || "")));
          } catch (ee) { }
        }

        // Handle old flat-array backups (array of heap items)
        let validated: any[] = [];
        let storiesPayload: any[] | null = null;
        let trashPayload: any[] | null = null;
        let overlaysPayload: any | null = null;

        if (Array.isArray(parsed)) {
          validated = parsed.map((p: any) => ({
            id: p.id ?? `${Date.now()}-${Math.random()}`,
            src: p.src ?? p.url,
            name: p.name ?? p.title,
          }));
        } else if (parsed && typeof parsed === "object") {
          // structured backup: { heap: [...], stories: [{id,title,count,items: [...]}, ...] }
          const heapArr = parsed.moments ?? parsed.heap ?? parsed["heap-gifs"] ?? [];
          if (!Array.isArray(heapArr)) {
            setMessage("Invalid backup file");
            setTimeout(() => setMessage(null), 4000);
            return;
          }
          validated = heapArr.map((p: any) => ({
            id: p.id ?? `${Date.now()}-${Math.random()}`,
            src: p.src ?? p.url,
            name: p.name ?? p.title,
          }));

          if (Array.isArray(parsed.stories)) {
            storiesPayload = parsed.stories.map((s: any) => ({
              id: s.id,
              title: s.title,
              count: s.count ?? (Array.isArray(s.items) ? s.items.length : 0),
              items: Array.isArray(s.items) ? s.items : [],
            }));
          }
          // legacy or structured trash payloads
          const trashArr = parsed.trash ?? parsed["trash-moments"] ?? parsed["trash-gifs"] ?? null;
          if (Array.isArray(trashArr)) {
            trashPayload = trashArr.map((p: any) => ({
              id: p.id ?? `${Date.now()}-${Math.random()}`,
              src: p.src ?? p.url,
              name: p.name ?? p.title,
            }));
          }
          // if the backup contains overlay data, keep it for later restoration
          overlaysPayload = parsed.overlays ?? parsed.overlay ?? null;
        } else {
          setMessage("Invalid backup file");
          setTimeout(() => setMessage(null), 4000);
          return;
        }
        // wipe existing IndexedDB data before restoring
        try {
          await clear();
        } catch (e) {
          logger.warn("Failed to clear IndexedDB before import", e);
        }
        // immediately clear story metadata/submenus and notify UI so submenus disappear before restore
        try {
          await set("stories", []);
          await set("stories-active", null as any);
          try {
            window.dispatchEvent(new CustomEvent("stories-updated", { detail: {} }));
          } catch (e) {
            /* ignore in non-browser */
          }
        } catch (e) {
          logger.warn("Failed to reset stories keys after import", e);
        }

        // restore heap items
        await set("heap-moments", validated);
        // restore any overlays from the imported payload
        try {
          if (overlaysPayload && typeof overlaysPayload === "object") {
            for (const [key, val] of Object.entries(overlaysPayload)) {
              try {
                await Promise.resolve(localStorage.setItem(`overlay:text:${key}`, JSON.stringify(val)));
              } catch (e) {
                logger.warn("Failed to restore overlay for", key, e);
              }
            }
          }
        } catch (e) {
          logger.warn("Failed to apply overlays from import", e);
        }
        // restore trash items if present
        if (trashPayload) {
          try {
            await set("trash-moments", trashPayload);
          } catch (e) {
            logger.warn("Failed to restore trash items", e);
          }
        }
        // restore stories if present
        if (storiesPayload) {
          const meta = storiesPayload.map(({ id, title, count }) => ({ id, title, count }));
          try {
            await set("stories", meta);
            // write per-story items
            await Promise.all(
              storiesPayload.map(async (s) => {
                try {
                  await set(`story:${s.id}`, s.items || []);
                } catch (e) {
                  logger.warn("Failed to write story items", s.id, e);
                }
              })
            );
            try {
              window.dispatchEvent(new CustomEvent("stories-updated", { detail: {} }));
            } catch (e) {
              /* ignore in non-browser */
            }
          } catch (e) {
            logger.warn("Failed to restore stories metadata", e);
          }
        }
        // notify app to refresh any in-memory state
        try {
          window.dispatchEvent(new CustomEvent("moments-updated", { detail: { count: validated.length } }));
        } catch (e) {
          // ignore in non-browser
        }
        // don't reload the page; dispatch events above already notify the app
        setMessage(`Imported ${validated.length} moments`);
        setTimeout(() => setMessage(null), 4000);
      } catch (err) {
        logger.error(err);
        setMessage("Import failed");
        try {
          setImportedText(sanitizeAndStringify(String(reader.result || "")));
        } catch (e) { }
        setTimeout(() => setMessage(null), 4000);
      }
    };
    reader.readAsText(f);
  }, []);

  const renderPreview = (text: string | null, emptyLabel = "No data") => {
    if (!text) return <div className="text-slate-400">{emptyLabel}</div>;
    try {
      const parsed = JSON.parse(text);
      return <JsonTree data={parsed} />;
    } catch (e) {
      return (
        <pre className="font-mono text-xs whitespace-pre-wrap text-slate-700">{text}</pre>
      );
    }
  };

  // Prefer the parsed sanitized object when available so we can render a tree
  const renderExportPreview = (text: string | null, emptyLabel = "No data") => {
    if (exportedObj) return <JsonTree data={exportedObj} />;
    return renderPreview(text, emptyLabel);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {message ? (
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>{message}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}
      <h2 className="text-2xl font-bold mb-4">Backups</h2>
      <p className="mb-4">Export or import your moment backups as JSON.</p>
      <div className="flex gap-3">
        <button
          onClick={handleExport}
          className="px-4 py-2 rounded bg-slate-800 text-white"
        >
          Export JSON
        </button>
        <input
          ref={importRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => handleImport(e.target.files)}
        />
        <button
          onClick={() => importRef.current?.click()}
          className="px-4 py-2 rounded border"
        >
          Import JSON
        </button>
      </div>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium mb-2">Exported Preview</label>
            {!exportedText ? null : <span className="text-xs text-slate-500">sanitized (no src)</span>}
          </div>
          <div className="w-full rounded border-0 p-2 bg-slate-900 text-slate-100 max-h-96 overflow-auto">
            {renderExportPreview(exportedText, "No export yet")}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium mb-2">Imported Preview</label>
            {!importedText ? null : <span className="text-xs text-slate-500">sanitized (no src)</span>}
          </div>
          <div className="w-full rounded border-0 p-2 bg-slate-900 text-slate-100 max-h-96 overflow-auto">
            {renderPreview(importedText, "No import yet")}
          </div>
        </div>
      </div>
    </div>
  );
}
