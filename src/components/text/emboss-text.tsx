"use client";

import { cn } from "@/lib/utils";

export type EmbossTextVariant = "embossed" | "debossed";

export type EmbossTextProps = {
  children: string;
  className?: string;
  variant?: EmbossTextVariant;
  depth?: number;
  highlightColor?: string;
  shadowColor?: string;
};

function buildEmbossShadow(
  variant: EmbossTextVariant,
  depth: number,
  highlight: string,
  shadow: string,
): string {
  const offset = Math.max(0.5, depth);
  if (variant === "debossed") {
    return `${offset}px ${offset}px 1px ${shadow}, ${-offset}px ${-offset}px 1px ${highlight}`;
  }
  return `${-offset}px ${-offset}px 1px ${highlight}, ${offset}px ${offset}px 1px ${shadow}`;
}

export function EmbossText({
  children,
  className,
  variant = "embossed",
  depth = 1.5,
  highlightColor = "rgba(255, 255, 255, 0.5)",
  shadowColor = "rgba(0, 0, 0, 0.55)",
}: EmbossTextProps) {
  return (
    <span
      className={cn("inline-block", className)}
      style={{
        textShadow: buildEmbossShadow(variant, depth, highlightColor, shadowColor),
      }}
    >
      {children}
    </span>
  );
}
