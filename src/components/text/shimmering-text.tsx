"use client";

import { cn } from "@/lib/utils";

export type ShimmeringTextProps = {
  children: string;
  className?: string;
};

export function ShimmeringText({ children, className }: ShimmeringTextProps) {
  return (
    <span
      className={cn(
        "inline-block bg-[length:200%_100%] bg-clip-text text-transparent animate-dialog-shimmer",
        "bg-gradient-to-r from-current via-white/95 to-current",
        className,
      )}
    >
      {children}
    </span>
  );
}
