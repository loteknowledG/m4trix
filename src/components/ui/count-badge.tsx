"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { CountingNumber } from "@/components/ui/counting-number";

export interface CountBadgeProps {
  value?: number | null;
  className?: string;
  variant?: Parameters<typeof Badge>[0]["variant"];
  shape?: Parameters<typeof Badge>[0]["shape"];
}

export function CountBadge({ value = 0, className, variant = "black", shape = "circle" }: CountBadgeProps) {
  const v = value ?? 0;
  if (v <= 0) return null;
  return (
    <Badge shape={shape} variant={variant} className={className}>
      <CountingNumber value={v} className="text-sm text-white" />
    </Badge>
  );
}

export default CountBadge;
