import type { PlaylistVideo } from '@/lib/playlists';

export const M4TRIX_VIDEO_SELECTED = 'm4trix:video-selected';

export type VideoSelectedDetail = {
  id: string;
  kind: PlaylistVideo['kind'];
  src: string;
  userInitiated: boolean;
};

export function dispatchVideoSelected(detail: VideoSelectedDetail) {
  window.dispatchEvent(new CustomEvent(M4TRIX_VIDEO_SELECTED, { detail }));
}
