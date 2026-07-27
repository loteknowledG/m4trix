export const DIALOG_TEXT_EFFECTS = [
  { id: "none", label: "Plain" },
  { id: "generate", label: "Generate" },
  { id: "blur", label: "Blur in" },
  { id: "shimmer", label: "Shimmer" },
  { id: "gradient", label: "Gradient" },
  { id: "highlight", label: "Highlight" },
  { id: "typewriter", label: "Typewriter" },
] as const;

export type DialogTextEffect = (typeof DIALOG_TEXT_EFFECTS)[number]["id"];

export function normalizeDialogTextEffect(value: unknown): DialogTextEffect {
  if (typeof value !== "string") return "none";
  return DIALOG_TEXT_EFFECTS.some((effect) => effect.id === value)
    ? (value as DialogTextEffect)
    : "none";
}

export function dialogTextEffectLabel(effect: DialogTextEffect): string {
  return DIALOG_TEXT_EFFECTS.find((entry) => entry.id === effect)?.label ?? "Plain";
}
