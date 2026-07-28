"use client";

import { cn } from "@/lib/utils";

export type PaperCutTextProps = {
  text: string;
  className?: string;
  layers?: number;
  layerOffset?: number;
  color?: string;
  shadowColor?: string;
};

function PaperCutChar({
  char,
  color,
  shadowColor,
  layers,
  layerOffset,
}: {
  char: string;
  color: string;
  shadowColor: string;
  layers: number;
  layerOffset: number;
}) {
  if (char === " ") {
    return <span className="inline-block">&nbsp;</span>;
  }

  return (
    <span className="relative inline-block">
      {Array.from({ length: layers - 1 }, (_, index) => {
        const depth = layers - 1 - index;
        const shift = depth * layerOffset;

        return (
          <span
            key={depth}
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 select-none"
            style={{
              color: shadowColor,
              opacity: 0.25 + (index / layers) * 0.45,
              transform: `translate(${shift}px, ${shift}px)`,
            }}
          >
            {char}
          </span>
        );
      })}
      <span className="relative" style={{ color }}>
        {char}
      </span>
    </span>
  );
}

export function PaperCutText({
  text,
  className,
  layers = 4,
  layerOffset = 1.25,
  color = "#ffffff",
  shadowColor = "rgba(0, 0, 0, 0.65)",
}: PaperCutTextProps) {
  return (
    <span
      className={cn("inline", className)}
      aria-label={text}
      style={{
        filter: `drop-shadow(1px 2px 1px ${shadowColor}) drop-shadow(2px 4px 6px ${shadowColor})`,
      }}
    >
      {Array.from(text).map((char, index) => (
        <PaperCutChar
          key={`${index}-${char}`}
          char={char}
          color={color}
          shadowColor={shadowColor}
          layers={layers}
          layerOffset={layerOffset}
        />
      ))}
    </span>
  );
}
