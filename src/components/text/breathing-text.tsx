"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type BreathingTextProps = {
  children: string;
  className?: string;
  duration?: number;
  scale?: number;
  opacityRange?: [number, number];
  blur?: boolean;
};

export function BreathingText({
  children,
  className,
  duration = 4,
  scale = 1.05,
  opacityRange = [0.72, 1],
  blur = true,
}: BreathingTextProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <span className={className}>{children}</span>;
  }

  return (
    <motion.span
      className={cn("inline-block", className)}
      animate={{
        scale: [1, scale, 1],
        opacity: [opacityRange[0], opacityRange[1], opacityRange[0]],
        filter: blur ? ["blur(0px)", "blur(2px)", "blur(0px)"] : undefined,
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {children}
    </motion.span>
  );
}
