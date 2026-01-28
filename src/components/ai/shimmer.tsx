"use client"

import type { ReactNode } from "react"

type ShimmerProps = {
  duration?: number
  children?: ReactNode
}

export function Shimmer({ duration = 1, children }: ShimmerProps) {
  // Simple shimmer/pulse placeholder used during reasoning streaming
  return (
    <span
      aria-live="polite"
      className="inline-block text-sm text-muted-foreground animate-pulse"
      style={{ animationDuration: `${duration}s` }}
    >
      {children}
    </span>
  )
}

export default Shimmer
