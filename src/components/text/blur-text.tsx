"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type BlurTextProps = {
  text: string;
  className?: string;
  segmentClassName?: string;
  animateBy?: "words" | "letters";
  delay?: number;
};

export function BlurText({
  text,
  className,
  segmentClassName,
  animateBy = "words",
  delay = 0.04,
}: BlurTextProps) {
  const reduceMotion = useReducedMotion();
  const segments =
    animateBy === "words"
      ? text.split(/\s+/).filter(Boolean)
      : Array.from(text);

  if (reduceMotion) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={cn("inline", className)} aria-label={text}>
      <span className="sr-only">{text}</span>
      {segments.map((segment, index) => (
        <motion.span
          key={`${index}-${segment}`}
          aria-hidden
          className={cn("inline-block whitespace-pre-wrap", segmentClassName)}
          initial={{ opacity: 0, filter: "blur(8px)", y: 6 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          transition={{ duration: 0.4, delay: index * delay }}
        >
          {segment}
          {animateBy === "words" && index < segments.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </span>
  );
}
