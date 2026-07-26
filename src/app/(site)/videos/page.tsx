'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ContentLayout } from '@/components/admin-panel/content-layout';
import ErrorBoundary from '@/components/error-boundary';
import MomentsGrid from '@/components/moments-grid';
import { SquarePen } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';
import {
  createEmptyPlaylist,
  loadAllPlaylists,
  playlistEditorHref,
  resolvePlaylistCover,
  type PlaylistMeta,
} from '@/lib/playlists';
import { VIDEO_PLACEHOLDER } from '@/lib/video-utils';

type PlaylistMoment = {
  id: string;
  src: string;
  name?: string;
};

export default function VideosPage() {
  const router = useRouter();
  const [playlists, setPlaylists] = useState<PlaylistMeta[]>([]);
  const [moments, setMoments] = useState<PlaylistMoment[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadPlaylists = useCallback(async () => {
    try {
      const saved = await loadAllPlaylists();
      setPlaylists(saved);

      const momentEntries = await Promise.all(
        saved.map(async playlist => {
          const cover = (await resolvePlaylistCover(playlist)) ?? VIDEO_PLACEHOLDER;
          return {
            id: playlist.id,
            src: cover,
            name: playlist.title?.trim() ? playlist.title : 'Untitled',
          } satisfies PlaylistMoment;
        })
      );
      setMoments(momentEntries);
    } catch (err) {
      logger.error('Failed to load playlists', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlaylists();
  }, [loadPlaylists]);

  useEffect(() => {
    const handler = () => {
      void loadPlaylists();
    };
    window.addEventListener('playlists-updated', handler);
    return () => window.removeEventListener('playlists-updated', handler);
  }, [loadPlaylists]);

  useEffect(() => {
    const prev = document.title;
    document.title = 'm4trix - videos';
    return () => {
      document.title = prev ?? 'm4trix';
    };
  }, []);

  const createNewPlaylist = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const meta = await createEmptyPlaylist();
      router.push(playlistEditorHref(meta.id));
    } catch (err) {
      logger.error('Failed to create playlist', err);
    } finally {
      setCreating(false);
    }
  };

  const openPlaylist = useCallback(
    (item: PlaylistMoment) => {
      router.push(playlistEditorHref(item.id));
    },
    [router]
  );

  return (
    <ContentLayout title="Videos">
      <ErrorBoundary>
        <div
          className="overflow-auto px-4"
          style={{ height: 'calc(100vh - var(--app-header-height, 56px))' }}
        >
          <div className="py-4">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : playlists.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No playlists yet. Tap + to create one.
              </div>
            ) : (
              <MomentsGrid
                moments={moments}
                selectedIds={[]}
                toggleSelect={() => {}}
                onOpen={openPlaylist}
              />
            )}
          </div>
        </div>

        <Button
          onClick={() => void createNewPlaylist()}
          size="icon"
          variant="default"
          disabled={creating}
          className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow duration-150 disabled:opacity-70"
          aria-label="New playlist"
          title="New playlist"
        >
          <SquarePen className="h-5 w-5" />
        </Button>
      </ErrorBoundary>
    </ContentLayout>
  );
}
