"use client";
import { useCallback, useRef } from "react";
import { get, set } from "idb-keyval";

export default function BackupsPage() {
  const importRef = useRef<HTMLInputElement | null>(null);

  const handleExport = useCallback(async () => {
    try {
      const data = (await get("heap-gifs")) || [];
      const dataStr = JSON.stringify(data, null, 2);
      const blob = new Blob([dataStr], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `heap-gifs-backup-${Date.now()}.json`;
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
        if (!Array.isArray(parsed)) {
          alert("Invalid backup file");
          return;
        }
        // normalize
        const validated = parsed.map((p: any) => ({
          id: p.id ?? `${Date.now()}-${Math.random()}`,
          src: p.src ?? p.url,
          name: p.name ?? p.title
        }));
        await set("heap-gifs", validated);
        alert(`Imported ${validated.length} GIFs`);
      } catch (err) {
        console.error(err);
        alert("Import failed");
      }
    };
    reader.readAsText(f);
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Backups</h2>
      <p className="mb-4">Export or import your GIF backups as JSON.</p>
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
