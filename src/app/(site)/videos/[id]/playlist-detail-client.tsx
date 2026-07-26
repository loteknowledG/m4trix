'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { set } from 'idb-keyval';
import { ContentLayout } from '@/components/admin-panel/content-layout';
import ErrorBoundary from '@/components/error-boundary';
import PlaylistRollerDeck from '@/components/playlist-roller-deck';
import WebVideoPlayer from '@/components/web-video-player';
import { ChevronLeft, Upload } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Marquee } from '@/components/ui/marquee';
import { logger } from '@/lib/logger';
import {
  addVideoToPlaylist,
  getPlaylistMeta,
  loadPlaylistVideos,
  newPlaylistId,
  renamePlaylist,
  type PlaylistVideo,
} from '@/lib/playlists';
import { isValidVideoUrl } from '@/lib/video-utils';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default function PlaylistDetailClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const routeId = params?.id as string | undefined;
  const playlistId =
    routeId === 'new' ? searchParams?.get('playlist') || undefined : routeId;

  const [videos, setVideos] = useState<PlaylistVideo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedVideo = videos.find(v => v.id === selectedVideoId) ?? null;

  const loadPlaylist = useCallback(async () => {
    if (!playlistId) {
      setLoading(false);
      return;
    }
    try {
      await set('playlists-active', playlistId);
      const meta = await getPlaylistMeta(playlistId);
      setTitle(meta?.title ?? '');
      const items = await loadPlaylistVideos(playlistId);
      setVideos(items);
      setSelectedVideoId(prev => {
        if (prev && items.some(v => v.id === prev)) return prev;
        return items[0]?.id ?? null;
      });
    } catch (err) {
      logger.error('Failed to load playlist', err);
    } finally {
      setLoading(false);
    }
  }, [playlistId]);

  useEffect(() => {
    void loadPlaylist();
  }, [loadPlaylist]);

  useEffect(() => {
    const handler = () => {
      void loadPlaylist();
    };
    window.addEventListener('playlists-updated', handler);
    return () => window.removeEventListener('playlists-updated', handler);
  }, [loadPlaylist]);

  useEffect(() => {
    const prev = document.title;
    document.title = title.trim() ? `m4trix - ${title}` : 'm4trix - playlist';
    return () => {
      document.title = prev ?? 'm4trix';
    };
  }, [title]);

  const saveTitle = async () => {
    if (!playlistId) return;
    try {
      await renamePlaylist(playlistId, title);
    } catch (err) {
      logger.error('Failed to save playlist title', err);
    }
  };

  const handleAddUrl = async () => {
    const trimmed = urlInput.trim();
    if (!playlistId || !trimmed || addingUrl) return;
    if (!isValidVideoUrl(trimmed)) {
      logger.warn('Invalid video URL', trimmed);
      return;
    }
    setAddingUrl(true);
    try {
      const video: PlaylistVideo = {
        id: newPlaylistId(),
        src: trimmed,
        name: trimmed,
        kind: 'url',
      };
      const next = await addVideoToPlaylist(playlistId, video);
      setVideos(next);
      setSelectedVideoId(video.id);
      setUrlInput('');
    } catch (err) {
      logger.error('Failed to add video URL', err);
    } finally {
      setAddingUrl(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!playlistId) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const video: PlaylistVideo = {
        id: newPlaylistId(),
        src: dataUrl,
        name: file.name,
        kind: 'upload',
      };
      const next = await addVideoToPlaylist(playlistId, video);
      setVideos(next);
      setSelectedVideoId(video.id);
    } catch (err) {
      logger.error('Failed to upload video', err);
    }
  };

  const advanceToNext = useCallback(() => {
    if (videos.length === 0) return;
    const currentIndex = videos.findIndex(v => v.id === selectedVideoId);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % videos.length : 0;
    setSelectedVideoId(videos[nextIndex]?.id ?? null);
  }, [videos, selectedVideoId]);

  if (!playlistId) {
    return (
      <ContentLayout title="Videos">
        <div className="p-6 text-sm text-muted-foreground">Playlist not found.</div>
      </ContentLayout>
    );
  }

  return (
    <ContentLayout
      title={title.trim() ? title : 'Untitled'}
      titleMarquee
      navLeft={
        <button
          type="button"
          onClick={() => router.push('/videos')}
          className="m4-circle-ghost hover:bg-zinc-100 dark:hover:bg-zinc-700"
          aria-label="Back to videos"
          title="Back to videos"
        >
          <ChevronLeft size={16} />
        </button>
      }
    >
      <ErrorBoundary>
        <div
          className="overflow-auto px-4 pb-8"
          style={{ height: 'calc(100vh - var(--app-header-height, 56px))' }}
        >
          <div className="py-4 space-y-6">
            <div>
              {editingTitle ? (
                <input
                  autoFocus
                  aria-label="Edit playlist title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onBlur={async () => {
                    await saveTitle();
                    setEditingTitle(false);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      (e.target as HTMLInputElement).blur();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setEditingTitle(false);
                    }
                  }}
                  className="w-full text-3xl font-light bg-transparent border-0 focus:ring-0 placeholder:text-muted-foreground"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingTitle(true)}
                  className="w-full text-left text-3xl font-light bg-transparent border-0 focus:outline-none"
                  aria-label="Edit playlist title"
                >
                  <Marquee className="text-3xl font-light" duration="8s" gap="13rem" distance="200%">
                    {title.trim() ? title : 'Add a title'}
                  </Marquee>
                </button>
              )}
            </div>

            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <>
                <WebVideoPlayer
                  src={selectedVideo?.src ?? ''}
                  autoPlay={Boolean(selectedVideo)}
                  onEnded={advanceToNext}
                />

                <PlaylistRollerDeck
                  videos={videos}
                  selectedId={selectedVideoId}
                  onSelect={setSelectedVideoId}
                />

                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="text-sm font-medium">Add video</div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      value={urlInput}
                      onChange={e => setUrlInput(e.target.value)}
                      placeholder="Paste video URL (YouTube, Vimeo, MP4…)"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleAddUrl();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      onClick={() => void handleAddUrl()}
                      disabled={addingUrl || !urlInput.trim()}
                    >
                      Add URL
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) void handleUpload(file);
                        e.target.value = '';
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload size={16} className="mr-2" />
                      Upload video
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </ErrorBoundary>
    </ContentLayout>
  );
}
