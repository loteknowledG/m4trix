/** Static-export-safe playlist detail URL (IndexedDB ids are created at runtime). */
export function playlistEditorHref(id: string) {
  return `/videos/new/?playlist=${encodeURIComponent(id)}`;
}

export function playlistDetailHref(id: string) {
  return playlistEditorHref(id);
}

export function isPlaylistDetailPath(pathname: string | null | undefined) {
  return pathname?.startsWith('/videos/') ?? false;
}

export function isActivePlaylistDetail(
  pathname: string | null | undefined,
  playlistId: string,
  searchPlaylist: string | null | undefined,
) {
  if (!isPlaylistDetailPath(pathname)) return false;
  const routeId = pathname?.split('/')[2];
  if (routeId && routeId !== 'new') return routeId === playlistId;
  return searchPlaylist === playlistId;
}
