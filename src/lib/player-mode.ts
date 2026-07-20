export type PlayerMode = "say" | "do" | "think";

export function normalizePlayerMode(mode?: string | null): PlayerMode {
  if (mode === "do" || mode === "think") return mode;
  if (mode === "tell" || mode === "say") return "say";
  return "say";
}

export function formatPlayerMemoryLabel(
  player?: { name?: string } | null,
  npcKnowsPlayer = true,
  playerMode?: PlayerMode | string | null,
) {
  const baseName =
    npcKnowsPlayer === false ? "Stranger" : player?.name?.trim() || "Player";
  const mode = normalizePlayerMode(playerMode);
  if (mode === "do") return `${baseName} does`;
  if (mode === "think") return `${baseName} thinks`;
  return `${baseName} says`;
}
