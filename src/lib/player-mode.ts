export type PlayerMode = "say" | "do" | "think";

export function normalizePlayerMode(mode?: string | null): PlayerMode {
  if (mode === "do" || mode === "think") return mode;
  if (mode === "tell" || mode === "say") return "say";
  return "say";
}

/** Say/do/think label for any named character (player or NPC). */
export function formatDialogModeLabel(
  name: string,
  mode?: PlayerMode | string | null,
): string {
  const baseName = name.trim() || "Unknown";
  const normalized = normalizePlayerMode(mode);
  if (normalized === "do") return `${baseName} does`;
  if (normalized === "think") return `${baseName} thinks`;
  return `${baseName} says`;
}

export function formatPlayerMemoryLabel(
  player?: { name?: string } | null,
  npcKnowsPlayer = true,
  playerMode?: PlayerMode | string | null,
) {
  const baseName =
    npcKnowsPlayer === false ? "Stranger" : player?.name?.trim() || "Player";
  return formatDialogModeLabel(baseName, playerMode);
}
