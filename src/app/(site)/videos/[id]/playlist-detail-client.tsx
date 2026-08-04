'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { set } from 'idb-keyval';
import { ContentLayout } from '@/components/admin-panel/content-layout';
import ErrorBoundary from '@/components/error-boundary';
import PlaylistRollerDeck from '@/components/playlist-roller-deck';
import UniversalVideoPlayer from '@/components/universal-video-player';
import VideoCueTimeline from '@/components/video-cue-timeline';
import { HeaderBackButton } from '@/components/ui/header-back-button';
import { Trash2, Upload } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Marquee } from '@/components/ui/marquee';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { logger } from '@/lib/logger';
import {
  addVideoToPlaylist,
  getPlaylistMeta,
  isEphemeralPlaylistVideo,
  loadPlaylistVideos,
  newPlaylistId,
  renamePlaylist,
  removeVideoFromPlaylist,
  updatePlaylistVideo,
  type PlaylistVideo,
} from '@/lib/playlists';
import { isValidVideoUrl, parseEmbedCode } from '@/lib/video-utils';
import { getIframeEmbedKind } from '@/lib/videojs-source';
import PlaylistVideoCueEditor from '@/components/playlist-video-cue-editor';
import PlaylistVideoSkipSegmentEditor from '@/components/playlist-video-skip-segment-editor';
import StoryExperienceModeToggle, {
  type StoryExperienceMode,
} from '@/components/story-experience-mode-toggle';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { normalizeVideoTimedCues, type VideoTimedCue } from '@/lib/video-timed-cues';
import { normalizeVideoSkipSegments, type VideoSkipSegment } from '@/lib/video-skip-segments';
import { dispatchVideoSelected } from '@/lib/video-playback-events';
import type { VideoPlaybackControls } from '@/lib/video-playback-controls';
import { usePlaybackDebugHud } from '@/hooks/use-playback-debug-hud';
import { cn } from '@/lib/utils';

function videoLabel(video: PlaylistVideo) {
  if (video.name?.trim()) {
    const name = video.name.trim();
    return video.kind === 'blob' ? `${name} (session)` : name;
  }
  if (video.kind === 'blob') return 'Local preview (session)';
  if (video.kind === 'upload') return 'Uploaded video';
  if (video.kind === 'embed') return 'Embedded video';
  try {
    const url = new URL(video.src);
    return url.hostname + url.pathname.slice(0, 24);
  } catch {
    return video.src.slice(0, 48);
  }
}

function PlaylistVideoNameField({
  videoId,
  value,
  placeholder,
  selected,
  onCommit,
}: {
  videoId: string;
  value: string;
  placeholder: string;
  selected: boolean;
  onCommit: (name: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value, videoId]);

  return (
    <Input
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setDraft(value);
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      placeholder={placeholder}
      aria-label="Edit video name"
      className={cn(
        'h-8 min-w-0 border-0 bg-transparent px-2 text-sm shadow-none focus-visible:ring-1',
        selected ? 'focus-visible:ring-primary/40' : 'focus-visible:ring-border',
      )}
    />
  );
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
  const [embedInput, setEmbedInput] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);
  const [addingEmbed, setAddingEmbed] = useState(false);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);
  const [playbackDebugHud, setPlaybackDebugHud] = usePlaybackDebugHud();
  const [playbackArmed, setPlaybackArmed] = useState(false);
  const [placementCueId, setPlacementCueId] = useState<string | null>(null);
  const [playbackCurrentTime, setPlaybackCurrentTime] = useState(0);
  const [timelineFollowEnabled, setTimelineFollowEnabled] = useState(false);
  const [storyMode, setStoryMode] = useState<StoryExperienceMode>('view');
  const playbackControlsRef = useRef<VideoPlaybackControls | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blobRevokeRef = useRef<Map<string, () => void>>(new Map());

  const selectedIndex = videos.findIndex(v => v.id === selectedVideoId);
  const selectedVideo = selectedIndex >= 0 ? videos[selectedIndex] : null;
  const selectedVideoCues = normalizeVideoTimedCues(selectedVideo?.cues);
  const selectedSkipSegments = normalizeVideoSkipSegments(selectedVideo?.skipSegments);
  const selectedIframeEmbedKind = selectedVideo
    ? getIframeEmbedKind(selectedVideo.src, selectedVideo.kind)
    : null;
  const needsManualTimelineFollow = selectedIframeEmbedKind === 'direct';
  const isEditMode = storyMode === 'edit';

  const enterViewMode = useCallback(() => {
    setStoryMode('view');
    setPlacementCueId(null);
    setPlaybackArmed(true);
  }, []);

  const enterEditMode = useCallback(() => {
    setStoryMode('edit');
  }, []);

  const handleStoryModeChange = useCallback(
    (mode: StoryExperienceMode) => {
      if (mode === 'view') {
        enterViewMode();
        return;
      }
      enterEditMode();
    },
    [enterEditMode, enterViewMode],
  );

  useEffect(() => {
    if (storyMode === 'view' && !loading && videos.length > 0) {
      setPlaybackArmed(true);
    }
  }, [storyMode, loading, videos.length]);

  const selectedCueIdsKey = useMemo(
    () => selectedVideoCues.map(cue => cue.id).join(','),
    [selectedVideoCues],
  );

  useEffect(() => {
    if (!selectedVideoId || selectedVideoCues.length === 0) return;
    setPlacementCueId(prev => {
      if (prev && selectedVideoCues.some(cue => cue.id === prev)) return prev;
      const first = [...selectedVideoCues].sort((a, b) => a.start - b.start)[0];
      return first?.id ?? null;
    });
  }, [selectedVideoId, selectedCueIdsKey, selectedVideoCues]);

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
    const revokeAll = blobRevokeRef.current;
    return () => {
      revokeAll.forEach(revoke => revoke());
      revokeAll.clear();
    };
  }, []);

  useEffect(() => {
    const handler = async () => {
      if (!playlistId) return;
      try {
        const items = await loadPlaylistVideos(playlistId);
        setVideos(prev => {
          const sessionBlobs = prev.filter(v => isEphemeralPlaylistVideo(v));
          return [...items, ...sessionBlobs];
        });
      } catch (err) {
        logger.error('Failed to refresh playlist videos', err);
      }
    };
    window.addEventListener('playlists-updated', handler);
    return () => window.removeEventListener('playlists-updated', handler);
  }, [playlistId]);

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
      setVideos(prev => {
        const sessionBlobs = prev.filter(v => isEphemeralPlaylistVideo(v));
        return [...next, ...sessionBlobs];
      });
      selectVideo(video.id);
      setUrlInput('');
    } catch (err) {
      logger.error('Failed to add video URL', err);
    } finally {
      setAddingUrl(false);
    }
  };

  const handleAddEmbed = async () => {
    const trimmed = embedInput.trim();
    if (!playlistId || !trimmed || addingEmbed) return;

    const parsed = parseEmbedCode(trimmed);
    if (!parsed) {
      logger.warn('Invalid embed code', trimmed);
      return;
    }

    setAddingEmbed(true);
    try {
      const video: PlaylistVideo = {
        id: newPlaylistId(),
        src: parsed.src,
        name: parsed.name,
        kind: 'embed',
      };
      const next = await addVideoToPlaylist(playlistId, video);
      setVideos(prev => {
        const sessionBlobs = prev.filter(v => isEphemeralPlaylistVideo(v));
        return [...next, ...sessionBlobs];
      });
      selectVideo(video.id);
      setEmbedInput('');
    } catch (err) {
      logger.error('Failed to add embed code', err);
    } finally {
      setAddingEmbed(false);
    }
  };

  const handlePreviewLocalFile = (file: File) => {
    const src = URL.createObjectURL(file);
    const video: PlaylistVideo = {
      id: newPlaylistId(),
      src,
      name: file.name,
      kind: 'blob',
      mimeType: file.type || undefined,
    };
    blobRevokeRef.current.set(video.id, () => URL.revokeObjectURL(src));
    setVideos(prev => [...prev, video]);
    selectVideo(video.id);
  };

  const handleRemoveVideo = async (videoId: string) => {
    const removedIndex = videos.findIndex(v => v.id === videoId);
    const removed = videos[removedIndex];
    if (removed && isEphemeralPlaylistVideo(removed)) {
      blobRevokeRef.current.get(videoId)?.();
      blobRevokeRef.current.delete(videoId);
      setVideos(prev => {
        const next = prev.filter(v => v.id !== videoId);
        setSelectedVideoId(current => {
          if (current !== videoId) return current;
          if (next.length === 0) return null;
          const nextIndex = Math.min(Math.max(removedIndex, 0), next.length - 1);
          return next[nextIndex]?.id ?? null;
        });
        return next;
      });
      return;
    }

    if (!playlistId) return;
    try {
      const next = await removeVideoFromPlaylist(playlistId, videoId);
      setVideos(prev => {
        const sessionBlobs = prev.filter(v => isEphemeralPlaylistVideo(v));
        return [...next, ...sessionBlobs];
      });
      setSelectedVideoId(prev => {
        if (prev !== videoId) return prev;
        if (next.length === 0) return null;
        const nextIndex = Math.min(Math.max(removedIndex, 0), next.length - 1);
        return next[nextIndex]?.id ?? null;
      });
    } catch (err) {
      logger.error('Failed to remove video from playlist', err);
    }
  };

  const handleRenameVideo = useCallback(
    async (videoId: string, name: string) => {
      const trimmed = name.trim();
      const nextName = trimmed || undefined;
      const current = videos.find(v => v.id === videoId);
      if ((current?.name ?? '') === (nextName ?? '')) return;

      setVideos(prev =>
        prev.map(v => (v.id === videoId ? { ...v, name: nextName } : v)),
      );
      if (current && isEphemeralPlaylistVideo(current)) return;

      if (!playlistId) return;
      try {
        const next = await updatePlaylistVideo(playlistId, videoId, { name: nextName });
        setVideos(prev => {
          const sessionBlobs = prev.filter(v => isEphemeralPlaylistVideo(v));
          const persisted = next.filter(v => !isEphemeralPlaylistVideo(v));
          return [...persisted, ...sessionBlobs];
        });
      } catch (err) {
        logger.error('Failed to rename playlist video', err);
        void loadPlaylist();
      }
    },
    [playlistId, videos, loadPlaylist],
  );

  const handleCuesChange = useCallback(
    async (videoId: string, cues: VideoTimedCue[]) => {
      const current = videos.find(v => v.id === videoId);
      setVideos(prev => prev.map(v => (v.id === videoId ? { ...v, cues } : v)));
      if (current && isEphemeralPlaylistVideo(current)) return;

      if (!playlistId) return;
      try {
        const next = await updatePlaylistVideo(playlistId, videoId, { cues });
        setVideos(prev => {
          const sessionBlobs = prev.filter(v => isEphemeralPlaylistVideo(v));
          const persisted = next.filter(v => !isEphemeralPlaylistVideo(v));
          return [...persisted, ...sessionBlobs];
        });
      } catch (err) {
        logger.error('Failed to save video dialogs', err);
        void loadPlaylist();
      }
    },
    [playlistId, loadPlaylist, videos],
  );

  const handleSkipSegmentsChange = useCallback(
    async (videoId: string, skipSegments: VideoSkipSegment[]) => {
      const current = videos.find(v => v.id === videoId);
      setVideos(prev => prev.map(v => (v.id === videoId ? { ...v, skipSegments } : v)));
      if (current && isEphemeralPlaylistVideo(current)) return;

      if (!playlistId) return;
      try {
        const next = await updatePlaylistVideo(playlistId, videoId, { skipSegments });
        setVideos(prev => {
          const sessionBlobs = prev.filter(v => isEphemeralPlaylistVideo(v));
          const persisted = next.filter(v => !isEphemeralPlaylistVideo(v));
          return [...persisted, ...sessionBlobs];
        });
      } catch (err) {
        logger.error('Failed to save skip segments', err);
        void loadPlaylist();
      }
    },
    [playlistId, loadPlaylist, videos],
  );

  const handleCueLayoutChange = useCallback(
    (cueId: string, patch: Partial<Pick<VideoTimedCue, 'x' | 'y' | 'width' | 'fontScale'>>) => {
      if (!selectedVideoId) return;
      const nextCues = selectedVideoCues.map(cue =>
        cue.id === cueId ? { ...cue, ...patch } : cue,
      );
      void handleCuesChange(selectedVideoId, nextCues);
    },
    [selectedVideoId, selectedVideoCues, handleCuesChange],
  );

  const handleCueTimingChange = useCallback(
    (cueId: string, patch: { start?: number; end?: number }) => {
      if (!selectedVideoId) return;
      const nextCues = selectedVideoCues.map(cue =>
        cue.id === cueId ? { ...cue, ...patch } : cue,
      );
      void handleCuesChange(selectedVideoId, nextCues);
    },
    [selectedVideoId, selectedVideoCues, handleCuesChange],
  );

  const handleTimelineSeek = useCallback((time: number) => {
    playbackControlsRef.current?.seek(time);
    setPlaybackCurrentTime(time);
  }, []);

  const handleTimelineScrubStart = useCallback(() => {
    playbackControlsRef.current?.pause();
  }, []);

  const handleTimelineFollowToggle = useCallback(() => {
    const controls = playbackControlsRef.current;
    if (!controls) return;
    const next = !controls.isTimelineFollowEnabled();
    controls.setTimelineFollow(next);
    setTimelineFollowEnabled(next);
  }, []);

  const selectVideo = useCallback(
    (videoId: string, userInitiated = true) => {
      const video = videos.find(v => v.id === videoId);
      if (userInitiated) {
        setPlaybackArmed(true);
      }
      setPlacementCueId(null);
      setPlaybackCurrentTime(0);
      setTimelineFollowEnabled(false);
      setSelectedVideoId(videoId);
      if (video) {
        dispatchVideoSelected({
          id: video.id,
          kind: video.kind,
          src: video.src,
          userInitiated,
        });
      }
    },
    [videos]
  );

  const advanceToNext = useCallback(() => {
    if (videos.length === 0) return;
    const currentIndex = videos.findIndex(v => v.id === selectedVideoId);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % videos.length : 0;
    const nextId = videos[nextIndex]?.id;
    if (!nextId) return;
    setPlaybackArmed(true);
    selectVideo(nextId, false);
  }, [videos, selectedVideoId, selectVideo]);

  const goToPreviousVideo = useCallback(() => {
    if (selectedIndex <= 0) return;
    const prevId = videos[selectedIndex - 1]?.id;
    if (!prevId) return;
    setPlaybackArmed(true);
    selectVideo(prevId, true);
  }, [selectedIndex, selectVideo, videos]);

  const goToNextVideo = useCallback(() => {
    if (videos.length === 0) return;
    if (selectedIndex < 0 || selectedIndex >= videos.length - 1) {
      advanceToNext();
      return;
    }
    const nextId = videos[selectedIndex + 1]?.id;
    if (!nextId) return;
    setPlaybackArmed(true);
    selectVideo(nextId, true);
  }, [advanceToNext, selectVideo, selectedIndex, videos]);

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
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <HeaderBackButton label="Back to videos" onClick={() => router.push('/videos')} />
            </TooltipTrigger>
            <TooltipContent>
              <p>Back to videos</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      }
      navRight={
        <StoryExperienceModeToggle
          mode={storyMode}
          onModeChange={handleStoryModeChange}
        />
      }
    >
      <ErrorBoundary>
        <div
          className={cn(
            'overflow-auto',
            !isEditMode && 'bg-gradient-to-b from-background via-background to-black/90',
          )}
          style={{ height: 'calc(100vh - var(--app-header-height, 56px))' }}
        >
          <div
            className={cn(
              isEditMode
                ? 'py-4'
                : 'mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center px-2 py-8 sm:px-4',
            )}
          >
            {isEditMode ? (
              <div className="mb-6">
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
                    className="w-full text-5xl font-light bg-transparent border-0 focus:ring-0 placeholder:text-muted-foreground"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingTitle(true)}
                    className="w-full text-left text-5xl font-light bg-transparent border-0 focus:outline-none"
                    aria-label="Edit playlist title"
                  >
                    <Marquee
                      className="text-5xl font-light"
                      duration="8s"
                      gap="13rem"
                      distance="200%"
                    >
                      {title.trim() ? title : 'Add a title'}
                    </Marquee>
                  </button>
                )}
              </div>
            ) : (
              <div className="mb-5 text-center">
                <h1 className="text-3xl font-light tracking-tight text-foreground sm:text-4xl">
                  {title.trim() ? title : 'Untitled story'}
                </h1>
                {selectedVideo ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {videoLabel(selectedVideo)}
                    {videos.length > 1
                      ? ` · Part ${selectedIndex + 1} of ${videos.length}`
                      : null}
                  </p>
                ) : null}
              </div>
            )}

            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <div
                className={cn(
                  isEditMode ? 'flex flex-col gap-6 lg:flex-row lg:items-start' : 'space-y-4',
                )}
              >
                <div className={cn('min-w-0 flex-1', isEditMode ? 'space-y-6' : 'space-y-4')}>
                  <div className={cn('space-y-3', !isEditMode && 'overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10')}>
                    <UniversalVideoPlayer
                      key={selectedVideo?.id ?? 'playlist-empty'}
                      src={selectedVideo?.src ?? ''}
                      kind={selectedVideo?.kind ?? 'url'}
                      mimeType={selectedVideo?.mimeType}
                      videoId={selectedVideo?.id}
                      autoPlay={autoPlayEnabled}
                      userActivated={playbackArmed}
                      onEnded={autoPlayEnabled ? advanceToNext : undefined}
                      cues={selectedVideoCues}
                      editCueId={isEditMode ? placementCueId : null}
                      onCueLayoutChange={isEditMode ? handleCueLayoutChange : undefined}
                      skipSegments={selectedSkipSegments}
                      playbackDebugHud={isEditMode && playbackDebugHud}
                      onPlaybackTimeChange={isEditMode ? setPlaybackCurrentTime : undefined}
                      onTimelineFollowChange={
                        isEditMode ? setTimelineFollowEnabled : undefined
                      }
                      playbackControlsRef={isEditMode ? playbackControlsRef : undefined}
                    />

                    {isEditMode && selectedVideo ? (
                      <VideoCueTimeline
                        cues={selectedVideoCues}
                        skipSegments={selectedSkipSegments}
                        selectedCueId={placementCueId}
                        currentTime={playbackCurrentTime}
                        onSelectCue={setPlacementCueId}
                        onCueTimingChange={handleCueTimingChange}
                        onSeek={handleTimelineSeek}
                        onScrubStart={handleTimelineScrubStart}
                        manualFollow={needsManualTimelineFollow}
                        followRunning={timelineFollowEnabled}
                        onFollowToggle={handleTimelineFollowToggle}
                      />
                    ) : null}

                    {isEditMode ? (
                      <>
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
                          <div>
                            <div className="text-sm font-medium">Autoplay</div>
                            <div className="text-xs text-muted-foreground">
                              Start each video automatically and continue to the next
                            </div>
                          </div>
                          <Switch
                            checked={autoPlayEnabled}
                            onCheckedChange={setAutoPlayEnabled}
                            aria-label="Toggle autoplay"
                          />
                        </div>

                        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
                          <div>
                            <div className="text-sm font-medium">Playback debugger</div>
                            <div className="text-xs text-muted-foreground">
                              Show current time, next mark, and manual clock controls
                            </div>
                          </div>
                          <Switch
                            checked={playbackDebugHud}
                            onCheckedChange={setPlaybackDebugHud}
                            aria-label="Toggle playback debugger"
                          />
                        </div>
                      </>
                    ) : null}
                  </div>

                  {!isEditMode && videos.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 bg-card/40 px-4 py-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        This story has no videos yet.
                      </p>
                      <Button type="button" className="mt-4" onClick={enterEditMode}>
                        Switch to Edit to add videos
                      </Button>
                    </div>
                  ) : null}

                  {!isEditMode && videos.length > 1 ? (
                    <div className="flex items-center justify-center gap-3 pt-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={selectedIndex <= 0}
                        onClick={goToPreviousVideo}
                      >
                        Previous
                      </Button>
                      <span className="min-w-[5rem] text-center text-xs tabular-nums text-muted-foreground">
                        {selectedIndex + 1} / {videos.length}
                      </span>
                      <Button type="button" variant="secondary" size="sm" onClick={goToNextVideo}>
                        Next
                      </Button>
                    </div>
                  ) : null}

                  {isEditMode ? (
                    <PlaylistRollerDeck
                      videos={videos}
                      selectedId={selectedVideoId}
                      onSelect={selectVideo}
                    />
                  ) : null}
                </div>

                {isEditMode ? (
                  <aside className="w-full shrink-0 lg:w-80 xl:w-96">
                  <div className="sticky top-4 space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
                    <div className="space-y-2">
                      <label htmlFor="playlist-video-select" className="text-sm font-medium">
                        Playlist
                      </label>
                      {videos.length > 0 ? (
                        <>
                          <Select
                            value={selectedVideoId ?? undefined}
                            onValueChange={selectVideo}
                          >
                            <SelectTrigger id="playlist-video-select" aria-label="Select video">
                              <SelectValue placeholder="Choose a video" />
                            </SelectTrigger>
                            <SelectContent>
                              {videos.map((video, index) => (
                                <SelectItem key={video.id} value={video.id}>
                                  {index + 1}. {videoLabel(video)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <ul className="max-h-48 overflow-y-auto rounded-lg border border-border/60 p-1">
                            {videos.map((video, index) => (
                              <li
                                key={video.id}
                                className={cn(
                                  'grid grid-cols-[2.25rem_minmax(0,1fr)_2rem] items-center gap-1 rounded-md',
                                  selectedVideoId === video.id &&
                                    'bg-primary/15 ring-1 ring-primary/30',
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => selectVideo(video.id)}
                                  className="flex h-8 items-center justify-center text-xs tabular-nums text-muted-foreground transition-colors hover:text-foreground"
                                  aria-label={`Play video ${index + 1}: ${videoLabel(video)}`}
                                >
                                  {index + 1}
                                </button>
                                <PlaylistVideoNameField
                                  videoId={video.id}
                                  value={video.name ?? ''}
                                  placeholder={videoLabel(video)}
                                  selected={selectedVideoId === video.id}
                                  onCommit={name => void handleRenameVideo(video.id, name)}
                                />
                                <button
                                  type="button"
                                  onClick={() => void handleRemoveVideo(video.id)}
                                  className="inline-flex h-8 shrink-0 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10"
                                  aria-label={`Remove ${videoLabel(video)}`}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">No videos yet.</p>
                      )}
                    </div>

                    {selectedVideo ? (
                      <>
                        <PlaylistVideoCueEditor
                          cues={selectedVideoCues}
                          onChange={cues => void handleCuesChange(selectedVideo.id, cues)}
                          placementCueId={placementCueId}
                          onPlacementCueIdChange={setPlacementCueId}
                          currentTime={playbackCurrentTime}
                        />
                        <PlaylistVideoSkipSegmentEditor
                          segments={selectedSkipSegments}
                          onChange={segments =>
                            void handleSkipSegmentsChange(selectedVideo.id, segments)
                          }
                        />
                      </>
                    ) : null}

                    <div className="space-y-3 border-t border-border/60 pt-4">
                      <div className="text-sm font-medium">Add to playlist</div>
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
                        className="w-full"
                        onClick={() => void handleAddUrl()}
                        disabled={addingUrl || !urlInput.trim()}
                      >
                        Add URL
                      </Button>

                      <Textarea
                        value={embedInput}
                        onChange={e => setEmbedInput(e.target.value)}
                        placeholder={'Paste embed code (<iframe …>) or embed URL'}
                        rows={4}
                        className="resize-y font-mono text-xs"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                        onClick={() => void handleAddEmbed()}
                        disabled={addingEmbed || !embedInput.trim()}
                      >
                        Add embed
                      </Button>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handlePreviewLocalFile(file);
                          e.target.value = '';
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload size={16} className="mr-2" />
                        Preview local file
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Plays from a blob URL for this session only. Refreshing the page removes
                        it.
                      </p>
                    </div>
                  </div>
                </aside>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </ErrorBoundary>
    </ContentLayout>
  );
}
