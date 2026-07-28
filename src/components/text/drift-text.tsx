"use client";

import { motion, useReducedMotion, useTime, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

export type DriftTextProps = {
  text: string;
  className?: string;
  intensity?: number;
  speed?: number;
};

function DriftLetter({
  char,
  index,
  intensity,
  speed,
}: {
  char: string;
  index: number;
  intensity: number;
  speed: number;
}) {
  const time = useTime();
  const phase = index * 0.7;

  const x = useTransform(time, t => {
    const seconds = t / 1000;
    return (
      intensity *
      (Math.sin(seconds * speed * 0.9 + phase) +
        Math.sin(seconds * speed * 1.7 + phase * 1.3) * 0.5)
    );
  });

  const y = useTransform(time, t => {
    const seconds = t / 1000;
    return (
      intensity *
      (Math.cos(seconds * speed * 1.1 + phase * 0.8) +
        Math.sin(seconds * speed * 2.1 + phase * 1.1) * 0.45)
    );
  });

  const rotate = useTransform(time, t => {
    const seconds = t / 1000;
    return (
      intensity *
      0.35 *
      (Math.sin(seconds * speed * 0.75 + phase) +
        Math.cos(seconds * speed * 1.5 + phase * 0.9) * 0.5)
    );
  });

  return (
    <motion.span className="inline-block whitespace-pre" style={{ x, y, rotate }}>
      {char === " " ? "\u00a0" : char}
    </motion.span>
  );
}

export function DriftText({
  text,
  className,
  intensity = 3,
  speed = 1,
}: DriftTextProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={cn("inline", className)} aria-label={text}>
      {Array.from(text).map((char, index) => (
        <DriftLetter
          key={`${index}-${char}`}
          char={char}
          index={index}
          intensity={intensity}
          speed={speed}
        />
      ))}
    </span>
  );
}
