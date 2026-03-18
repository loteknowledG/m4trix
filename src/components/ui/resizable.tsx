'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

type Orientation = 'horizontal' | 'vertical';

type SizeValue = string | number | undefined;

export type ResizablePanelGroupProps = {
  orientation?: Orientation;
  className?: string;
  children: React.ReactNode;
};

const parseFraction = (value?: SizeValue) => {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return value > 1 ? value / 100 : value;

  const withoutPercent = value.replace('%', '');
  const num = Number(withoutPercent);
  if (!Number.isFinite(num)) return undefined;

  return value.includes('%') ? num / 100 : num > 1 ? num / 100 : num;
};

const clamp = (value: number, min?: number, max?: number) => {
  let result = value;
  if (typeof min === 'number') result = Math.max(result, min);
  if (typeof max === 'number') result = Math.min(result, max);
  return result;
};

export function ResizablePanelGroup({
  orientation = 'horizontal',
  className,
  children,
}: ResizablePanelGroupProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = React.useState(0);
  const [sizes, setSizes] = React.useState<number[]>([]);

  const childrenArray = React.Children.toArray(children) as React.ReactElement[];
  const panelCount = Math.ceil(childrenArray.length / 2);

  // Track container size so we can calculate fractions for dragging.
  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setContainerSize(orientation === 'horizontal' ? rect.width : rect.height);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [orientation]);

  // Initialize sizes from panel props if not already set.
  React.useLayoutEffect(() => {
    if (sizes.length === panelCount) return;

    const initialSizes = Array(panelCount).fill(1 / panelCount);

    for (let i = 0; i < panelCount; i += 1) {
      const panel = childrenArray[i * 2] as React.ReactElement<{ defaultSize?: SizeValue }>;
      const fraction = parseFraction(panel?.props?.defaultSize);
      if (typeof fraction === 'number' && fraction > 0) {
        initialSizes[i] = fraction;
      }
    }

    setSizes(initialSizes);
  }, [panelCount, childrenArray, sizes.length]);

  const dragState = React.useRef<{
    index: number;
    startPos: number;
    startSizes: number[];
    minSizes: number[];
    maxSizes: number[];
  } | null>(null);

  const isHorizontal = orientation === 'horizontal';

  const getPanelFraction = (i: number) => sizes[i] ?? 0;

  const updateSizes = (index: number, deltaPx: number) => {
    if (containerSize <= 0) return;

    const deltaFraction = deltaPx / containerSize;
    const leftIndex = index;
    const rightIndex = index + 1;

    const state = dragState.current;
    if (!state) return;

    const leftMin = state.minSizes[leftIndex];
    const leftMax = state.maxSizes[leftIndex];
    const rightMin = state.minSizes[rightIndex];
    const rightMax = state.maxSizes[rightIndex];

    let newLeft = state.startSizes[leftIndex] + deltaFraction;
    let newRight = state.startSizes[rightIndex] - deltaFraction;

    // Enforce min/max constraints.
    newLeft = clamp(newLeft, leftMin, leftMax);
    newRight = clamp(newRight, rightMin, rightMax);

    // Ensure they still add up to the same total (approx).
    const total = newLeft + newRight;
    const startTotal = state.startSizes[leftIndex] + state.startSizes[rightIndex];
    if (total !== 0 && startTotal !== 0) {
      const scale = startTotal / total;
      newLeft *= scale;
      newRight *= scale;
    }

    const nextSizes = [...state.startSizes];
    nextSizes[leftIndex] = newLeft;
    nextSizes[rightIndex] = newRight;
    setSizes(nextSizes);
  };

  const endDrag = () => {
    dragState.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
  };

  const onPointerMove = (event: PointerEvent) => {
    const state = dragState.current;
    if (!state) return;

    const currentPos = isHorizontal ? event.clientX : event.clientY;
    const delta = currentPos - state.startPos;
    updateSizes(state.index, delta);
  };

  const startDrag = (index: number, startPos: number) => {
    const minSizes = Array(panelCount).fill(0);
    const maxSizes = Array(panelCount).fill(1);

    for (let i = 0; i < panelCount; i += 1) {
      const panel = childrenArray[i * 2] as React.ReactElement<{
        minSize?: SizeValue;
        maxSize?: SizeValue;
      }>;
      const minFraction = parseFraction(panel?.props?.minSize);
      const maxFraction = parseFraction(panel?.props?.maxSize);
      if (typeof minFraction === 'number') minSizes[i] = minFraction;
      if (typeof maxFraction === 'number') maxSizes[i] = maxFraction;
    }

    dragState.current = {
      index,
      startPos,
      startSizes: [...sizes],
      minSizes,
      maxSizes,
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  };

  return (
    <div
      ref={containerRef}
      className={cn('h-full w-full', className)}
      style={{
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        height: '100%',
        width: '100%',
      }}
    >
      {childrenArray.map((child, idx) => {
        const isPanel = idx % 2 === 0;
        if (isPanel) {
          const panelIndex = idx / 2;
          const panel = child as React.ReactElement<ResizablePanelProps>;
          const size = getPanelFraction(panelIndex) * 100;

          const style: React.CSSProperties = isHorizontal
            ? {
                flexGrow: 0,
                flexShrink: 0,
                flexBasis: `${size}%`,
                minWidth: `${(parseFraction(panel.props.minSize) ?? 0) * 100}%`,
                maxWidth: `${(parseFraction(panel.props.maxSize) ?? 1) * 100}%`,
              }
            : {
                flexGrow: 0,
                flexShrink: 0,
                flexBasis: `${size}%`,
                minHeight: `${(parseFraction(panel.props.minSize) ?? 0) * 100}%`,
                maxHeight: `${(parseFraction(panel.props.maxSize) ?? 1) * 100}%`,
              };

          return React.cloneElement(panel, {
            style: { ...style, ...panel.props.style },
          });
        }

        const handleIndex = (idx - 1) / 2;
        const handle = child as React.ReactElement<ResizableHandleProps>;

        return React.cloneElement(handle, {
          role: 'separator',
          onPointerDown: (event: React.PointerEvent) => {
            event.preventDefault();
            event.stopPropagation();
            startDrag(handleIndex, isHorizontal ? event.clientX : event.clientY);
          },
          style: {
            cursor: isHorizontal ? 'col-resize' : 'row-resize',
            ...handle.props.style,
          },
        });
      })}
    </div>
  );
}

export type ResizablePanelProps = {
  defaultSize?: string | number;
  minSize?: string | number;
  maxSize?: string | number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

export function ResizablePanel({
  defaultSize,
  minSize,
  maxSize,
  className,
  children,
  ...props
}: ResizablePanelProps) {
  // defaultSize/minSize/maxSize are only used by the ResizablePanelGroup logic.
  // They should not be forwarded to the DOM element.
  return (
    <div className={cn('relative min-w-0 min-h-0', className)} {...props}>
      {children}
    </div>
  );
}

export type ResizableHandleProps = {
  withHandle?: boolean;
  className?: string;
  style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>;

export function ResizableHandle({ withHandle = false, className, ...props }: ResizableHandleProps) {
  return (
    <div
      className={cn(
        'flex-none self-stretch h-full flex items-center justify-center bg-transparent hover:bg-slate-700/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300',
        className
      )}
      {...props}
    >
      {withHandle ? <div className="rounded-full bg-slate-400/70 h-full w-1" /> : null}
    </div>
  );
}
