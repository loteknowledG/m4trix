"use client";

import { ShineBorder } from "@/components/ui/shine-border";

export const SELECTED_SHINE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--secondary))",
  "hsl(var(--primary))",
];

type SelectedShineBorderProps = {
  selected?: boolean;
  borderWidth?: number;
  duration?: number;
};

export function SelectedShineBorder({
  selected = false,
  borderWidth = 2,
  duration = 10,
}: SelectedShineBorderProps) {
  if (!selected) return null;

  return (
    <ShineBorder
      borderWidth={borderWidth}
      duration={duration}
      shineColor={SELECTED_SHINE_COLORS}
      className="z-20"
    />
  );
}
