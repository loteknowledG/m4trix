"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type PopTextProps = {
  text: string;
  className?: string;
  staggerDelay?: number;
  showBurst?: boolean;
  burstColor?: string;
};

function PopBurst({ color }: { color: string }) {
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[1.5em] w-[1.5em] -translate-x-1/2 -translate-y-1/2 rounded-full"
      initial={{ scale: 0, opacity: 0.85, rotate: 0 }}
      animate={{ scale: [0, 1.8, 0], opacity: [0.85, 0.45, 0], rotate: 45 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{
        background: `radial-gradient(circle, ${color} 0%, transparent 72%)`,
      }}
    />
  );
}

function PopLetter({
  char,
  index,
  staggerDelay,
  showBurst,
  burstColor,
}: {
  char: string;
  index: number;
  staggerDelay: number;
  showBurst: boolean;
  burstColor: string;
}) {
  return (
    <motion.span
      aria-hidden={char === " "}
      className="relative inline-block whitespace-pre"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: "spring",
        stiffness: 520,
        damping: 11,
        delay: index * staggerDelay,
      }}
    >
      {showBurst && char !== " " ? <PopBurst color={burstColor} /> : null}
      {char === " " ? "\u00a0" : char}
    </motion.span>
  );
}

export function PopText({
  text,
  className,
  staggerDelay = 0.06,
  showBurst = true,
  burstColor = "rgba(255, 255, 255, 0.75)",
}: PopTextProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={cn("inline", className)} aria-label={text}>
      {Array.from(text).map((char, index) => (
        <PopLetter
          key={`${index}-${char}`}
          char={char}
          index={index}
          staggerDelay={staggerDelay}
          showBurst={showBurst}
          burstColor={burstColor}
        />
      ))}
    </span>
  );
}
