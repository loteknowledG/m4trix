"use client";
import { useCallback, useRef, useState } from "react";
import { get, set, clear } from "idb-keyval";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";

export default function BackupsPage() {
  const importRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
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
            } catch (e) {}
          }
        };
        collectFor(heap);
        collectFor(trash);
        for (const s of storiesWithItems) collectFor(s.items);
        if (Object.keys(overlays).length > 0) (payload as any).overlays = overlays;
      } catch (e) {
        // continue without overlays on error
      }
      const dataStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([dataStr], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `moments-backup-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed", e);
    }
  }, []);

  const handleImport = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || "null"));

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
          console.warn("Failed to clear IndexedDB before import", e);
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
          console.warn("Failed to reset stories keys after import", e);
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
                console.warn("Failed to restore overlay for", key, e);
              }
            }
          }
        } catch (e) {
          console.warn("Failed to apply overlays from import", e);
        }
        // restore trash items if present
        if (trashPayload) {
          try {
            await set("trash-moments", trashPayload);
          } catch (e) {
            console.warn("Failed to restore trash items", e);
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
                  console.warn("Failed to write story items", s.id, e);
                }
              })
            );
            try {
              window.dispatchEvent(new CustomEvent("stories-updated", { detail: {} }));
            } catch (e) {
              /* ignore in non-browser */
            }
          } catch (e) {
            console.warn("Failed to restore stories metadata", e);
          }
        }
        // notify app to refresh any in-memory state
        try {
          window.dispatchEvent(new CustomEvent("moments-updated", { detail: { count: validated.length } }));
        } catch (e) {
          // ignore in non-browser
        }
        // reload so components pick up cleared data reliably
        try {
          window.location.reload();
        } catch (e) {}
        setMessage(`Imported ${validated.length} moments`);
        setTimeout(() => setMessage(null), 4000);
      } catch (err) {
        console.error(err);
        setMessage("Import failed");
        setTimeout(() => setMessage(null), 4000);
      }
    };
    reader.readAsText(f);
  }, []);

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
    </div>
  );
}
