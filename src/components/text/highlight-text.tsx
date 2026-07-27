"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type HighlightTextProps = {
  children: string;
  className?: string;
  highlightClassName?: string;
};

export function HighlightText({
  children,
  className,
  highlightClassName,
}: HighlightTextProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span className={cn("relative inline-block px-0.5", className)}>
      <motion.span
        aria-hidden
        className={cn(
          "absolute inset-y-0 -inset-x-1 -z-10 rounded-sm bg-yellow-300/45",
          highlightClassName,
        )}
        initial={{ scaleX: 0, originX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
      />
      {children}
    </span>
  );
}
