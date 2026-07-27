"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type TypewriterTextProps = {
  text: string;
  className?: string;
  speedMs?: number;
  showCursor?: boolean;
};

export function TypewriterText({
  text,
  className,
  speedMs = 28,
  showCursor = true,
}: TypewriterTextProps) {
  const reduceMotion = useReducedMotion();
  const [visibleCount, setVisibleCount] = useState(reduceMotion ? text.length : 0);

  useEffect(() => {
    if (reduceMotion) {
      setVisibleCount(text.length);
      return;
    }

    setVisibleCount(0);
    if (!text.length) return;

    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setVisibleCount(index);
      if (index >= text.length) {
        window.clearInterval(timer);
      }
    }, speedMs);

    return () => window.clearInterval(timer);
  }, [reduceMotion, speedMs, text]);

  return (
    <span className={cn("inline whitespace-pre-wrap", className)}>
      {text.slice(0, visibleCount)}
      {showCursor && visibleCount < text.length ? (
        <span className="ml-0.5 inline-block animate-pulse opacity-70">|</span>
      ) : null}
    </span>
  );
}
