"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type BouncingTextProps = {
  text: string;
  className?: string;
  segmentClassName?: string;
  bounceHeight?: number;
  staggerDelay?: number;
  duration?: number;
  loop?: boolean;
  repeatDelay?: number;
};

export function BouncingText({
  text,
  className,
  segmentClassName,
  bounceHeight = 12,
  staggerDelay = 0.08,
  duration = 0.6,
  loop = false,
  repeatDelay = 1.2,
}: BouncingTextProps) {
  const reduceMotion = useReducedMotion();
  const letters = Array.from(text);

  if (reduceMotion) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={cn("inline", className)} aria-label={text}>
      <span className="sr-only">{text}</span>
      {letters.map((letter, index) => (
        <motion.span
          key={`${index}-${letter}`}
          aria-hidden
          className={cn("inline-block whitespace-pre", segmentClassName)}
          animate={{
            y: [0, -bounceHeight, 0, -bounceHeight * 0.35, 0],
          }}
          transition={{
            duration,
            delay: index * staggerDelay,
            repeat: loop ? Infinity : 0,
            repeatDelay: loop ? repeatDelay : 0,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {letter === " " ? "\u00a0" : letter}
        </motion.span>
      ))}
    </span>
  );
}
