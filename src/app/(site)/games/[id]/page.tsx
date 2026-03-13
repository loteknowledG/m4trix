'use client';

import { useEffect, useState } from 'react';
import { get } from 'idb-keyval';
import { useParams } from 'next/navigation';
import { ContentLayout } from '@/components/admin-panel/content-layout';
import ErrorBoundary from '@/components/error-boundary';

export default function GamePage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const [gameData, setGameData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!id) {
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    (async () => {
      try {
        const stored = (await get<any>(`game:${id}`)) || null;
        if (!mounted) return;
        setGameData(stored);
      } catch (e) {
        console.error('Failed to load game data', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id]);

  const title = id ? `Game ${id}` : 'Game';

  return (
    <ContentLayout title={title} titleMarquee={false}>
      <ErrorBoundary>
        <div className="p-6">
          {loading ? (
            <div className="text-center text-muted-foreground">Loading game…</div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">This is the game editor page.</div>
              <pre className="rounded bg-slate-950/40 p-4 text-xs overflow-auto">
                {JSON.stringify(gameData ?? { message: 'No game data found yet' }, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </ErrorBoundary>
    </ContentLayout>
  );
}
