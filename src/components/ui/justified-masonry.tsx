"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type JustifiedMasonryItem = {
  id: string;
  src: string;
};

export type JustifiedMasonryProps<T extends JustifiedMasonryItem> = {
  items: T[];
  /** Approximate target row height in pixels. */
  targetRowHeight?: number;
  /** Horizontal gap between items in a row (px). */
  itemSpacing?: number;
  /** Vertical gap between rows (px). */
  rowSpacing?: number;
  className?: string;
  /** Optional override to extract id from an item. Defaults to item.id. */
  getId?: (item: T) => string;
  /** Optional override to extract src from an item. Defaults to item.src. */
  getSrc?: (item: T) => string;
  /**
   * Render function for each item. The style argument contains width (as a percentage)
   * and can be spread onto the outer wrapper for the card.
   */
  renderItem: (item: T, style: React.CSSProperties) => React.ReactNode;
};

type LayoutEntry<T> = {
  item: T;
  rowIndex: number;
  widthPercent: number;
};

export function JustifiedMasonry<T extends JustifiedMasonryItem>(props: JustifiedMasonryProps<T>) {
  const {
    items,
    targetRowHeight = 220,
    itemSpacing = 16,
    rowSpacing = 16,
    className,
    getId = (item) => item.id,
    getSrc = (item) => item.src,
    renderItem,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [ratios, setRatios] = useState<Record<string, number>>({});

  // Track container width using ResizeObserver when available,
  // and fall back to a simple resize listener otherwise.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Modern browsers: use ResizeObserver for precise container width.
    if (typeof ResizeObserver !== "undefined") {
      const obs = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          if (w && w !== containerWidth) {
            setContainerWidth(w);
          }
        }
      });
      obs.observe(el);
      return () => {
        obs.disconnect();
      };
    }

    // Fallback: measure via getBoundingClientRect + window resize.
    const updateWidth = () => {
      try {
        const rect = el.getBoundingClientRect();
        const w = rect?.width || 0;
        if (w && w !== containerWidth) {
          setContainerWidth(w);
        }
      } catch {
        // ignore
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => {
      window.removeEventListener("resize", updateWidth);
    };
  }, [containerWidth]);

  // Compute layout rows based on aspect ratios
  const layout = useMemo<LayoutEntry<T>[]>(() => {
    if (!items.length || !containerWidth) return [];

    const result: LayoutEntry<T>[] = [];
    let currentRow: { item: T; ar: number }[] = [];
    let currentRowWidthAtTarget = 0; // in px at targetRowHeight
    let rowIndex = 0;

    const flushRow = (isLast: boolean) => {
      if (!currentRow.length) return;
      const totalItemSpacing = itemSpacing * (currentRow.length - 1);
      let rowHeight = targetRowHeight;
      let rowWidth = currentRow.reduce((sum, entry) => sum + entry.ar * targetRowHeight, 0);

      if (!isLast && rowWidth > 0) {
        const scale = (containerWidth - totalItemSpacing) / rowWidth;
        rowHeight = targetRowHeight * Math.max(scale, 0.5);
        rowWidth *= scale;
      }

      currentRow.forEach(({ item, ar }) => {
        const w = ar * rowHeight; // px
        const widthPercent = (w / containerWidth) * 100;
        result.push({ item, rowIndex, widthPercent });
      });

      rowIndex += 1;
      currentRow = [];
      currentRowWidthAtTarget = 0;
    };

    items.forEach((item, index) => {
      const id = getId(item);
      const ar = ratios[id] && ratios[id] > 0 ? ratios[id] : 1; // fallback to square
      const itemWidthAtTarget = ar * targetRowHeight;
      const totalItemSpacing = itemSpacing * currentRow.length;

      if (
        currentRow.length > 0 &&
        currentRowWidthAtTarget + itemWidthAtTarget + totalItemSpacing > containerWidth
      ) {
        flushRow(false);
      }

      currentRow.push({ item, ar });
      currentRowWidthAtTarget += itemWidthAtTarget;

      // Flush the last row at the end
      if (index === items.length - 1) {
        flushRow(true);
      }
    });

    return result;
  }, [items, containerWidth, ratios, targetRowHeight, itemSpacing, getId]);

  // Group layout entries by row index
  const rows = useMemo(() => {
    const map = new Map<number, LayoutEntry<T>[]>();
    for (const entry of layout) {
      const row = map.get(entry.rowIndex) || [];
      row.push(entry);
      map.set(entry.rowIndex, row);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, entries]) => entries);
  }, [layout]);

  // Items that still need their aspect ratio measured
  const itemsNeedingMeasure = useMemo(() => {
    return items.filter((item) => {
      const id = getId(item);
      return !ratios[id];
    });
  }, [items, ratios, getId]);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {rows.length === 0 && items.length === 0 && (
        <div className="w-full" />
      )}
      {rows.map((row, rowIdx) => (
        <div
          key={rowIdx}
          className="flex"
          style={{
            columnGap: itemSpacing,
            marginBottom: rowIdx === rows.length - 1 ? 0 : rowSpacing,
          }}
        >
          {row.map((entry) => {
            const style: React.CSSProperties = {
              width: `${entry.widthPercent}%`,
              flex: "0 0 auto",
            };
            return (
              <div key={getId(entry.item)} style={style}>
                {renderItem(entry.item, { width: "100%" })}
              </div>
            );
          })}
        </div>
      ))}

      {/* Hidden measuring images to compute aspect ratios without altering layout */}
      <div className="pointer-events-none fixed inset-0 -z-50 opacity-0">
        {itemsNeedingMeasure.map((item) => {
          const id = getId(item);
          const src = getSrc(item);
          return (
             
            <img
              key={id}
              src={src}
              alt=""
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight) {
                  setRatios((prev) => {
                    if (prev[id]) return prev;
                    return {
                      ...prev,
                      [id]: img.naturalWidth / img.naturalHeight,
                    };
                  });
                }
              }}
              onError={() => {
                // fall back to square if we can't measure
                setRatios((prev) => {
                  if (prev[id]) return prev;
                  return { ...prev, [id]: 1 };
                });
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export default JustifiedMasonry;
