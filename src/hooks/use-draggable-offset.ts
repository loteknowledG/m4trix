'use client';

import { useCallback, useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';

type Offset = { x: number; y: number };

export function useDraggableOffset(active: boolean) {
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!active) {
      setOffset({ x: 0, y: 0 });
      setDragging(false);
    }
  }, [active]);

  const startDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      if ((event.target as HTMLElement).closest('[data-drag-cancel]')) return;

      event.preventDefault();
      const startX = event.clientX;
      const startY = event.clientY;
      const originX = offset.x;
      const originY = offset.y;
      setDragging(true);

      const onMove = (moveEvent: PointerEvent) => {
        setOffset({
          x: originX + moveEvent.clientX - startX,
          y: originY + moveEvent.clientY - startY,
        });
      };

      const onUp = () => {
        setDragging(false);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [offset.x, offset.y],
  );

  const panelStyle = {
    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
  } as const;

  const handleProps = {
    onPointerDown: startDrag,
    'aria-label': 'Drag dialog',
  } as const;

  return { panelStyle, handleProps, dragging };
}
