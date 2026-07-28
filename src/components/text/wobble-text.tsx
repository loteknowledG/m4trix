"use client";

import { motion, useReducedMotion, useTime, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

export type WobbleTextProps = {
  text: string;
  className?: string;
  rotation?: number;
  scalePulse?: number;
  speed?: number;
};

function WobbleLetter({
  char,
  index,
  rotation,
  scalePulse,
  speed,
}: {
  char: string;
  index: number;
  rotation: number;
  scalePulse: number;
  speed: number;
}) {
  const time = useTime();
  const phase = index * 0.65;

  const rotate = useTransform(time, t => {
    const seconds = t / 1000;
    return rotation * Math.sin(seconds * speed * 2.4 + phase);
  });

  const scale = useTransform(time, t => {
    const seconds = t / 1000;
    return 1 + scalePulse * Math.sin(seconds * speed * 3.1 + phase * 1.2);
  });

  return (
    <motion.span className="inline-block origin-center whitespace-pre" style={{ rotate, scale }}>
      {char === " " ? "\u00a0" : char}
    </motion.span>
  );
}

export function WobbleText({
  text,
  className,
  rotation = 6,
  scalePulse = 0.04,
  speed = 1.2,
}: WobbleTextProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={cn("inline", className)} aria-label={text}>
      {Array.from(text).map((char, index) => (
        <WobbleLetter
          key={`${index}-${char}`}
          char={char}
          index={index}
          rotation={rotation}
          scalePulse={scalePulse}
          speed={speed}
        />
      ))}
    </span>
  );
}
