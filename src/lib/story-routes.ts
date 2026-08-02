export function resolveStoryId(
  routeId: string | null | undefined,
  storyQuery: string | null | undefined,
): string | null {
  if (!routeId) return null;
  if (routeId === "new" || routeId === "edit") {
    const queryId = storyQuery?.trim();
    return queryId || null;
  }
  return routeId;
}

export function storyIdFromPathname(
  pathname: string | null | undefined,
  storyQuery: string | null | undefined,
): string | null {
  if (!pathname) return null;
  const match = pathname.match(/\/stories\/([^/]+)/);
  return resolveStoryId(match?.[1], storyQuery);
}
