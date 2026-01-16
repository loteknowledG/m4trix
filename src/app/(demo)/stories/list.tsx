"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { get } from "idb-keyval";
import { ContentLayout } from "@/components/admin-panel/content-layout";

type Story = { id: string; title?: string; count?: number };

export default function StoriesList() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = (await get<Story[]>("stories")) || [];
        if (mounted) setStories(saved);
      } catch (err) {
        console.error("Failed to load stories", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ContentLayout title="Stories">
      <div className="py-4">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : stories.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No stories yet.</div>
        ) : (
          <ul className="space-y-2">
            {stories.map((s) => (
              <li key={s.id}>
                <Link href={`/stories/${s.id}`} className="block p-3 rounded hover:bg-accent flex items-center justify-between">
                  <div className="font-medium truncate">{s.title && s.title.trim() ? s.title : "Untitled"}</div>
                  <div className="text-sm text-muted-foreground">{s.count ?? 0}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ContentLayout>
  );
}
