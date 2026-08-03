'use client';

import { Input } from '@/components/ui/input';
import { TextEffectsMultiSelect } from '@/components/text-effects-multi-select';
import type { CharacterDialogStyle } from '@/lib/character-dialog-style';
import {
  normalizeCueColor,
  normalizeCueFont,
  VIDEO_CUE_FONT_OPTIONS,
} from '@/lib/video-timed-cues';

export type DialogLineStyleValues = CharacterDialogStyle;

type DialogLineStyleEditorProps = {
  values: DialogLineStyleValues;
  onChange: (patch: Partial<DialogLineStyleValues>) => void;
};

export function DialogLineStyleEditor({ values, onChange }: DialogLineStyleEditorProps) {
  const font = values.font ?? 'system';
  const fontScale = values.fontScale ?? 0.04;

  return (
    <div className="space-y-2 rounded-md border border-border/50 bg-muted/20 p-2">
      <div className="text-[11px] font-medium text-muted-foreground">Style</div>

      <TextEffectsMultiSelect
        value={values.textEffects ?? values.textEffect}
        onChange={textEffects => onChange({ textEffects, textEffect: undefined })}
      />

      <label className="grid gap-1">
        <span className="text-[11px] text-muted-foreground">Font</span>
        <select
          value={font}
          onChange={event =>
            onChange({ font: normalizeCueFont(event.target.value) ?? 'system' })
          }
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          {VIDEO_CUE_FONT_OPTIONS.map(option => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1">
        <span className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Font size</span>
          <span>{Math.round(fontScale * 1000) / 10}</span>
        </span>
        <input
          type="range"
          min={2}
          max={12}
          step={0.5}
          value={fontScale * 100}
          onChange={event => onChange({ fontScale: Number(event.target.value) / 100 })}
          className="w-full"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1">
          <span className="text-[11px] text-muted-foreground">Text color</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={values.color ?? '#ffffff'}
              onChange={event =>
                onChange({ color: normalizeCueColor(event.target.value, '#ffffff') })
              }
              className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent p-0.5"
              aria-label="Text color"
            />
            <Input
              value={values.color ?? '#ffffff'}
              onChange={event =>
                onChange({
                  color: normalizeCueColor(event.target.value, values.color ?? '#ffffff'),
                })
              }
              className="h-8 font-mono text-xs"
            />
          </div>
        </label>

        <label className="grid gap-1">
          <span className="text-[11px] text-muted-foreground">Shadow color</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={values.shadowColor ?? '#000000'}
              onChange={event =>
                onChange({ shadowColor: normalizeCueColor(event.target.value, '#000000') })
              }
              className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent p-0.5"
              aria-label="Shadow color"
            />
            <Input
              value={values.shadowColor ?? '#000000'}
              onChange={event =>
                onChange({
                  shadowColor: normalizeCueColor(
                    event.target.value,
                    values.shadowColor ?? '#000000',
                  ),
                })
              }
              className="h-8 font-mono text-xs"
            />
          </div>
        </label>
      </div>
    </div>
  );
}
