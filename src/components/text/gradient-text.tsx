"use client";

import { cn } from "@/lib/utils";

export type GradientTextProps = {
  children: string;
  className?: string;
};

export function GradientText({ children, className }: GradientTextProps) {
  return (
    <span
      className={cn(
        "inline-block bg-[length:200%_auto] bg-clip-text text-transparent animate-dialog-gradient",
        "bg-gradient-to-r from-sky-300 via-fuchsia-300 to-lime-300",
        className,
      )}
    >
      {children}
    </span>
  );
}
