"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type TypingTextProps = {
  text: string;
  className?: string;
  speedMs?: number;
  showCursor?: boolean;
  variableSpeed?: boolean;
};

function nextDelay(baseMs: number, variableSpeed: boolean) {
  if (!variableSpeed) return baseMs;
  return baseMs * (0.55 + Math.random() * 0.9);
}

export function TypingText({
  text,
  className,
  speedMs = 32,
  showCursor = true,
  variableSpeed = true,
}: TypingTextProps) {
  const reduceMotion = useReducedMotion();
  const [visibleCount, setVisibleCount] = useState(reduceMotion ? text.length : 0);
  const [done, setDone] = useState(Boolean(reduceMotion));

  useEffect(() => {
    if (reduceMotion) {
      setVisibleCount(text.length);
      setDone(true);
      return;
    }

    setVisibleCount(0);
    setDone(false);
    if (!text.length) {
      setDone(true);
      return;
    }

    let index = 0;
    let timer: number | undefined;

    const tick = () => {
      index += 1;
      setVisibleCount(index);
      if (index >= text.length) {
        setDone(true);
        return;
      }
      timer = window.setTimeout(tick, nextDelay(speedMs, variableSpeed));
    };

    timer = window.setTimeout(tick, nextDelay(speedMs, variableSpeed));

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [reduceMotion, speedMs, text, variableSpeed]);

  return (
    <span className={cn("inline whitespace-pre-wrap", className)}>
      {text.slice(0, visibleCount)}
      {showCursor ? (
        <span
          className={cn(
            "ml-0.5 inline-block",
            done ? "animate-blink-cursor" : "opacity-90",
          )}
        >
          |
        </span>
      ) : null}
    </span>
  );
}
