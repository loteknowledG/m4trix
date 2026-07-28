"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type EchoTextProps = {
  text: string;
  className?: string;
  echoes?: number;
  offset?: number;
  decay?: number;
  catchUpDelay?: number;
};

export function EchoText({
  text,
  className,
  echoes = 4,
  offset = 2,
  decay = 0.45,
  catchUpDelay = 70,
}: EchoTextProps) {
  const [layers, setLayers] = useState<string[]>(() => Array.from({ length: echoes }, () => text));

  useEffect(() => {
    setLayers(prev => {
      if (prev[0] === text) return prev;
      const next = [...prev];
      next[0] = text;
      return next;
    });

    const timers = Array.from({ length: echoes - 1 }, (_, index) =>
      window.setTimeout(() => {
        setLayers(prev => {
          if (prev[index + 1] === text) return prev;
          const next = [...prev];
          next[index + 1] = text;
          return next;
        });
      }, (index + 1) * catchUpDelay),
    );

    return () => {
      timers.forEach(timer => window.clearTimeout(timer));
    };
  }, [catchUpDelay, echoes, text]);

  return (
    <span className={cn("relative inline-block", className)} aria-label={text}>
      {layers.map((layerText, layerIndex) => {
        const opacity = layerIndex === 0 ? 1 : decay ** layerIndex;
        const translate = layerIndex * offset;

        return (
          <span
            key={`echo-${layerIndex}-${layerText}`}
            aria-hidden={layerIndex > 0}
            className={cn(
              "whitespace-pre-wrap",
              layerIndex === 0 ? "relative" : "pointer-events-none absolute left-0 top-0",
            )}
            style={{
              opacity,
              transform: layerIndex === 0 ? undefined : `translate(${translate}px, ${translate}px)`,
            }}
          >
            {layerText}
          </span>
        );
      })}
    </span>
  );
}
