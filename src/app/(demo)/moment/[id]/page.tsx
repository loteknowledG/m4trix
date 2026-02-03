"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { get, set } from "idb-keyval";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { ArrowLeft } from "lucide-react";
import MomentCard from "@/components/moment-card";

export default function MomentPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params as any)?.id as string | undefined;

  const [item, setItem] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!id) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        // support both new and old storage keys for compatibility
        const saved = (await get<any[]>("heap-moments")) || (await get<any[]>("heap-gifs")) || [];
        let found = saved.find((s) => s.id === id) || null;

        // if not in heap, try searching stories for this moment id
        if (!found) {
          try {
            const storiesMeta = (await get<any[]>("stories")) || [];
            for (const meta of storiesMeta) {
              const storyKey = `story:${meta.id}`;
              const stored = (await get<any>(storyKey)) || [];
              let items: any[] = [];
              if (Array.isArray(stored)) items = stored;
              else if (stored && Array.isArray(stored.items)) items = stored.items;
              const f = items.find((s) => (s && (s.id || s)) === id);
              if (f) {
                // normalize to object with id/src
                if (typeof f === "string") {
                  found = { id: f, src: f };
                } else {
                  found = { id: f.id || id, src: f.src || f, name: f.name };
                }
                break;
              }
            }
          } catch (err) {
            // ignore errors searching stories
          }
        }

        if (mounted) setItem(found);
      } catch (e) {
        console.error("Failed to load moment", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false };
  }, [id]);

  return (
    <div className="fixed inset-0 z-[2000] bg-black/95 flex items-center justify-center">
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !item ? (
        <div className="text-center text-muted-foreground">Moment not found.</div>
      ) : (
        <>
          <button
            onClick={() => router.back()}
            className="absolute left-4 top-4 inline-flex items-center justify-center w-10 h-10 rounded-full bg-transparent hover:bg-white/5 text-white"
            aria-label="Close"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="max-w-6xl w-full h-full flex items-center justify-center">
            <div className="w-full h-full flex items-center justify-center">
              <div className="max-h-full max-w-full flex items-center justify-center">
                <MomentCard item={item} anySelected={false} toggleSelect={() => { }} fullHeight />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
