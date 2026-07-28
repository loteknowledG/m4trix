"use client";

import { motion, useReducedMotion, useTime, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

export type WaveformTextProps = {
  text: string;
  className?: string;
  amplitude?: number;
  wavelength?: number;
  speed?: number;
};

function WaveformLetter({
  char,
  index,
  amplitude,
  wavelength,
  speed,
}: {
  char: string;
  index: number;
  amplitude: number;
  wavelength: number;
  speed: number;
}) {
  const time = useTime();

  const y = useTransform(time, t => {
    const seconds = t / 1000;
    return amplitude * Math.sin(2 * Math.PI * speed * seconds - (2 * Math.PI * index) / wavelength);
  });

  return (
    <motion.span className="inline-block whitespace-pre" style={{ y }}>
      {char === " " ? "\u00a0" : char}
    </motion.span>
  );
}

export function WaveformText({
  text,
  className,
  amplitude = 10,
  wavelength = 5,
  speed = 1,
}: WaveformTextProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={cn("inline", className)} aria-label={text}>
      {Array.from(text).map((char, index) => (
        <WaveformLetter
          key={`${index}-${char}`}
          char={char}
          index={index}
          amplitude={amplitude}
          wavelength={wavelength}
          speed={speed}
        />
      ))}
    </span>
  );
}
