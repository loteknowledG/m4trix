"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  value: number;
  duration?: number;
  className?: string;
}

export function CountingNumber({ value, duration = 600, className }: Props) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef<number>(value);

  useEffect(() => {
    const start = performance.now();
    const from = fromRef.current;
    const delta = value - from;
    if (delta === 0) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }

    let raf = 0;
    const step = (ts: number) => {
      const t = Math.min(1, (ts - start) / duration);
      const cur = Math.round(from + delta * t);
      setDisplay(cur);
      if (t < 1) raf = requestAnimationFrame(step);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className={className}>{display}</span>;
}
