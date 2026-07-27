"use client";

import { motion, type Transition, useReducedMotion } from "motion/react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

export type TextGenerateEffectProps = {
  children: string;
  className?: string;
  wordClassName?: string;
  trigger?: boolean;
  staggerDuration?: number;
  transition?: Transition;
  filter?: boolean;
};

export function TextGenerateEffect({
  children,
  className,
  wordClassName,
  trigger = true,
  staggerDuration = 0.08,
  transition = { duration: 0.45 },
  filter = true,
}: TextGenerateEffectProps) {
  const reduceMotion = useReducedMotion();
  const words = useMemo(() => children.split(/\s+/).filter(Boolean), [children]);

  if (reduceMotion) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span className={cn("inline", className)} aria-label={children}>
      {words.map((word, index) => (
        <motion.span
          key={`${index}-${word}`}
          className={cn("inline-block whitespace-pre-wrap", wordClassName)}
          initial={{ filter: filter ? "blur(8px)" : undefined, opacity: 0 }}
          animate={
            trigger
              ? { filter: filter ? "blur(0px)" : undefined, opacity: 1 }
              : { filter: filter ? "blur(8px)" : undefined, opacity: 0 }
          }
          transition={{ ...transition, delay: index * staggerDuration }}
        >
          {word}
          {index < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </span>
  );
}
