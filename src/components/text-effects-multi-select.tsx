'use client';

import {
  VIDEO_CUE_TEXT_EFFECTS,
  toggleVideoCueTextEffect,
  normalizeVideoCueTextEffects,
  type VideoCueTextEffect,
} from '@/lib/video-cue-text-effects';
import { cn } from '@/lib/utils';

type TextEffectsMultiSelectProps = {
  value?: VideoCueTextEffect[] | VideoCueTextEffect | null;
  onChange: (effects: VideoCueTextEffect[]) => void;
  className?: string;
};

export function TextEffectsMultiSelect({ value, onChange, className }: TextEffectsMultiSelectProps) {
  const selected = normalizeVideoCueTextEffects(value);
  const selectedSet = new Set(selected);

  const toggle = (effect: VideoCueTextEffect) => {
    onChange(toggleVideoCueTextEffect(selected, effect));
  };

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">Text effects</span>
        {selected.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
          >
            Clear
          </button>
        ) : null}
      </div>
      <div className="max-h-44 overflow-y-auto rounded-md border border-input bg-background p-1">
        <div className="grid grid-cols-2 gap-1">
          {VIDEO_CUE_TEXT_EFFECTS.filter(option => option.id !== 'none').map(option => {
            const active = selectedSet.has(option.id);
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(option.id)}
                className={cn(
                  'rounded px-2 py-1.5 text-left text-[10px] transition-colors',
                  active
                    ? 'border border-primary bg-primary/15 text-foreground'
                    : 'border border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      {selected.length > 0 ? (
        <p className="text-[10px] text-muted-foreground">
          {selected.length} selected — applied inside-out in selection order.
        </p>
      ) : (
        <p className="text-[10px] text-muted-foreground">Plain text (no effects).</p>
      )}
    </div>
  );
}
