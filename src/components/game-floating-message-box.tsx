'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import type { GameCharacterSlot } from '@/lib/game-dialog-layout';
import { cn } from '@/lib/utils';

type GameFloatingMessageBoxTab = {
  id: GameCharacterSlot;
  label: string;
};

type BoxLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type GameFloatingMessageBoxProps = {
  tabs: GameFloatingMessageBoxTab[];
  activeCharacter: GameCharacterSlot;
  onActiveCharacterChange: (id: GameCharacterSlot) => void;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  stageRef?: RefObject<HTMLElement | null>;
  disabled?: boolean;
  inputMaxLength?: number;
};

const DEFAULT_LAYOUT: BoxLayout = {
  x: 0.02,
  y: 0.78,
  width: 0.3,
  height: 0.2,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function GameFloatingMessageBox({
  tabs,
  activeCharacter,
  onActiveCharacterChange,
  input,
  onInputChange,
  onSend,
  stageRef,
  disabled = false,
  inputMaxLength,
}: GameFloatingMessageBoxProps) {
  const layoutRef = useRef<BoxLayout>(DEFAULT_LAYOUT);
  const interactingRef = useRef(false);
  const [layout, setLayout] = useState<BoxLayout>(DEFAULT_LAYOUT);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyLayout = useCallback((next: BoxLayout) => {
    layoutRef.current = next;
    setLayout(next);
  }, []);

  const onStartDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!stageRef?.current || event.button !== 0 || disabled) return;
      event.preventDefault();
      event.stopPropagation();
      interactingRef.current = true;
      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);
      const stage = stageRef.current;
      const startX = event.clientX;
      const startY = event.clientY;
      const startLayout = { ...layoutRef.current };

      const onMove = (ev: PointerEvent) => {
        const rect = stage.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        applyLayout({
          ...layoutRef.current,
          x: clamp(startLayout.x + (ev.clientX - startX) / rect.width, 0, 1 - layoutRef.current.width),
          y: clamp(startLayout.y + (ev.clientY - startY) / rect.height, 0, 1 - layoutRef.current.height),
        });
      };

      const onEnd = (ev: PointerEvent) => {
        handle.releasePointerCapture(ev.pointerId);
        interactingRef.current = false;
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onEnd);
        handle.removeEventListener('pointercancel', onEnd);
      };

      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onEnd);
      handle.addEventListener('pointercancel', onEnd);
    },
    [applyLayout, disabled, stageRef],
  );

  const onStartResize = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!stageRef?.current || event.button !== 0 || disabled) return;
      event.preventDefault();
      event.stopPropagation();
      interactingRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      const stage = stageRef.current;
      const startX = event.clientX;
      const startY = event.clientY;
      const startLayout = { ...layoutRef.current };
      const handle = event.currentTarget;

      const onMove = (ev: PointerEvent) => {
        const rect = stage.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        applyLayout({
          ...layoutRef.current,
          width: clamp(startLayout.width + (ev.clientX - startX) / rect.width, 0.16, 1 - layoutRef.current.x),
          height: clamp(startLayout.height + (ev.clientY - startY) / rect.height, 0.12, 1 - layoutRef.current.y),
        });
      };

      const onEnd = (ev: PointerEvent) => {
        handle.releasePointerCapture(ev.pointerId);
        interactingRef.current = false;
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onEnd);
        handle.removeEventListener('pointercancel', onEnd);
      };

      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onEnd);
      handle.addEventListener('pointercancel', onEnd);
    },
    [applyLayout, disabled, stageRef],
  );

  useEffect(() => {
    if (disabled) return;
    textareaRef.current?.focus();
  }, [activeCharacter, disabled]);

  return (
    <div
      className="pointer-events-auto absolute z-40 touch-none select-none"
      style={{
        left: `${layout.x * 100}%`,
        top: `${layout.y * 100}%`,
        width: `${layout.width * 100}%`,
        height: `${layout.height * 100}%`,
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="relative flex h-full min-h-0 flex-col border-2 border-dashed border-white/70 bg-black/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-[1px]">
        <div
          className={cn(
            'flex shrink-0 items-center gap-2 border-b border-dashed border-white/40 px-2 py-1.5',
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-grab active:cursor-grabbing',
          )}
          onPointerDown={onStartDrag}
        >
          <label className="sr-only" htmlFor="game-floating-message-character">
            Character
          </label>
          <select
            id="game-floating-message-character"
            value={activeCharacter}
            disabled={disabled}
            onChange={(event) => onActiveCharacterChange(event.target.value as GameCharacterSlot)}
            className="max-w-[45%] truncate rounded border border-white/30 bg-black/35 px-2 py-0.5 text-[11px] text-white outline-none focus:border-white/60"
            onPointerDown={(event) => event.stopPropagation()}
          >
            {tabs.map((tab) => (
              <option key={tab.id} value={tab.id} className="bg-zinc-950 text-white">
                {tab.label}
              </option>
            ))}
          </select>
          <span className="ml-auto text-[10px] uppercase tracking-wide text-white/60">Message</span>
        </div>

        <textarea
          ref={textareaRef}
          value={input}
          disabled={disabled}
          maxLength={inputMaxLength}
          placeholder={`Write as ${tabs.find((tab) => tab.id === activeCharacter)?.label ?? 'character'}…`}
          onChange={(event) => {
            const next = event.target.value;
            if (inputMaxLength != null && next.length > inputMaxLength) {
              onInputChange(next.slice(0, inputMaxLength));
              return;
            }
            onInputChange(next);
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey) return;
            event.preventDefault();
            if (!disabled && input.trim()) onSend();
          }}
          className="min-h-0 flex-1 resize-none border-0 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />

        <button
          type="button"
          aria-label="Resize message box"
          disabled={disabled}
          onPointerDown={onStartResize}
          className="absolute -bottom-2 -right-2 z-10 h-4 w-4 cursor-se-resize border-2 border-white bg-black/60 shadow-md disabled:cursor-not-allowed disabled:opacity-40"
        />
      </div>
    </div>
  );
}
