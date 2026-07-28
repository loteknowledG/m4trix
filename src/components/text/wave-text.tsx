"use client";

import { motion, useReducedMotion, useTime, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

export type WaveTextProps = {
  text: string;
  className?: string;
  amplitude?: number;
  wavelength?: number;
  speed?: number;
  rotation?: number;
};

function WaveLetter({
  char,
  index,
  amplitude,
  wavelength,
  speed,
  rotation,
}: {
  char: string;
  index: number;
  amplitude: number;
  wavelength: number;
  speed: number;
  rotation: number;
}) {
  const time = useTime();

  const y = useTransform(time, t => {
    const seconds = t / 1000;
    return amplitude * Math.sin(2 * Math.PI * speed * seconds - (2 * Math.PI * index) / wavelength);
  });

  const rotate = useTransform(time, t => {
    const seconds = t / 1000;
    const phase = 2 * Math.PI * speed * seconds - (2 * Math.PI * index) / wavelength;
    return rotation * Math.cos(phase);
  });

  return (
    <motion.span className="inline-block whitespace-pre" style={{ y, rotate }}>
      {char === " " ? "\u00a0" : char}
    </motion.span>
  );
}

export function WaveText({
  text,
  className,
  amplitude = 8,
  wavelength = 6,
  speed = 0.8,
  rotation = 8,
}: WaveTextProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={cn("inline", className)} aria-label={text}>
      {Array.from(text).map((char, index) => (
        <WaveLetter
          key={`${index}-${char}`}
          char={char}
          index={index}
          amplitude={amplitude}
          wavelength={wavelength}
          speed={speed}
          rotation={rotation}
        />
      ))}
    </span>
  );
}
