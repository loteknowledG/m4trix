"use client";

import { useId } from "react";
import { motion, useReducedMotion, useTime, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

export type LiquidTextProps = {
  text: string;
  className?: string;
  intensity?: number;
  speed?: number;
  blur?: number;
};

function LiquidGooFilter({ id, blur }: { id: string; blur: number }) {
  return (
    <svg aria-hidden className="absolute h-0 w-0" preserveAspectRatio="none">
      <defs>
        <filter id={id} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
            result="goo"
          />
          <feBlend in="SourceGraphic" in2="goo" />
        </filter>
      </defs>
    </svg>
  );
}

function LiquidLetter({
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
  const phase = index * 0.85;

  const x = useTransform(time, t => {
    const seconds = t / 1000;
    return (
      intensity *
      (Math.sin(seconds * speed * 1.2 + phase) +
        Math.sin(seconds * speed * 2.3 + phase * 1.4) * 0.55)
    );
  });

  return (
    <motion.span className="inline-block whitespace-pre" style={{ x }}>
      {char === " " ? "\u00a0" : char}
    </motion.span>
  );
}

export function LiquidText({
  text,
  className,
  intensity = 4,
  speed = 1,
  blur = 2.5,
}: LiquidTextProps) {
  const reduceMotion = useReducedMotion();
  const filterId = useId().replace(/:/g, "");

  if (reduceMotion) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={cn("relative inline", className)} aria-label={text}>
      <LiquidGooFilter id={filterId} blur={blur} />
      <span className="inline" style={{ filter: `url(#${filterId})` }}>
        {Array.from(text).map((char, index) => (
          <LiquidLetter
            key={`${index}-${char}`}
            char={char}
            index={index}
            intensity={intensity}
            speed={speed}
          />
        ))}
      </span>
    </span>
  );
}
