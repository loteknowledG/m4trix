/** Static-export-safe character detail URL (IndexedDB ids are created at runtime). */
export function characterDetailHref(id: string) {
  return `/characters/detail?id=${encodeURIComponent(id)}`;
}

export function isCharacterDetailPath(pathname: string | null | undefined) {
  return pathname === '/characters/detail';
}

export function isActiveCharacterDetail(
  pathname: string | null | undefined,
  characterId: string,
  searchId: string | null | undefined,
) {
  return isCharacterDetailPath(pathname) && searchId === characterId;
}
