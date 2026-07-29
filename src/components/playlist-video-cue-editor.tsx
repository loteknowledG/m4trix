'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  commitCueEndTime,
  commitCueStartTime,
  defaultVideoTimedCue,
  formatCueTime,
  normalizeCueColor,
  parseCueTime,
  VIDEO_CUE_FONT_OPTIONS,
  type VideoCueFontId,
  type VideoCueTextEffect,
  type VideoTimedCue,
} from '@/lib/video-timed-cues';
import { VIDEO_CUE_TEXT_EFFECTS } from '@/lib/video-cue-text-effects';
import { cn } from '@/lib/utils';

type PlaylistVideoCueEditorProps = {
  cues: VideoTimedCue[];
  onChange: (cues: VideoTimedCue[]) => void;
  placementCueId: string | null;
  onPlacementCueIdChange: (cueId: string | null) => void;
  currentTime?: number;
};

function cueSummaryLabel(cue: VideoTimedCue, index: number) {
  if (cue.speaker?.trim()) return cue.speaker.trim();
  const text = cue.text.trim();
  if (text) return text.length > 28 ? `${text.slice(0, 28)}…` : text;
  return `Dialog ${index + 1}`;
}

function CueTimeField({
  cueId,
  label,
  value,
  currentTime,
  onCommit,
}: {
  cueId: string;
  label: string;
  value: number;
  currentTime?: number;
  onCommit: (seconds: number) => void;
}) {
  const [draft, setDraft] = useState(formatCueTime(value));

  useEffect(() => {
    setDraft(formatCueTime(value));
  }, [value, cueId]);

  const commitDraft = useCallback(() => {
    const parsed = parseCueTime(draft);
    if (parsed == null) {
      setDraft(formatCueTime(value));
      return;
    }
    onCommit(parsed);
    setDraft(formatCueTime(parsed));
  }, [draft, onCommit, value]);

  return (
    <label className="grid gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          className="h-8 flex-1 font-mono text-xs"
          placeholder="0:00"
        />
        {currentTime != null ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0 px-2 text-[10px]"
            onClick={() => {
              onCommit(currentTime);
              setDraft(formatCueTime(currentTime));
            }}
          >
            Now
          </Button>
        ) : null}
      </div>
    </label>
  );
}

function SelectedCueEditor({
  cue,
  index,
  currentTime,
  onUpdate,
  onRemove,
}: {
  cue: VideoTimedCue;
  index: number;
  currentTime?: number;
  onUpdate: (patch: Partial<VideoTimedCue>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3 ring-1 ring-primary/20">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">{cueSummaryLabel(cue, index)}</div>
          <div className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatCueTime(cue.start)} – {formatCueTime(cue.end)}
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          Remove
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <CueTimeField
          cueId={cue.id}
          label="Start"
          value={cue.start}
          currentTime={currentTime}
          onCommit={start => {
            onUpdate(commitCueStartTime(start, cue.end));
          }}
        />
        <CueTimeField
          cueId={cue.id}
          label="End"
          value={cue.end}
          currentTime={currentTime}
          onCommit={end => {
            onUpdate(commitCueEndTime(cue.start, end));
          }}
        />
      </div>

      <Input
        value={cue.speaker ?? ''}
        onChange={e => onUpdate({ speaker: e.target.value })}
        placeholder="Speaker (optional)"
        className="h-8 text-xs"
      />

      <Textarea
        value={cue.text}
        onChange={e => onUpdate({ text: e.target.value })}
        placeholder="Dialog text"
        rows={3}
        className="resize-y text-xs"
      />

      <div className="space-y-2 rounded-md border border-border/50 bg-muted/20 p-2">
        <div className="text-[11px] font-medium text-muted-foreground">Style</div>

        <label className="grid gap-1">
          <span className="text-[11px] text-muted-foreground">Text effect</span>
          <select
            value={cue.textEffect ?? 'none'}
            onChange={e =>
              onUpdate({
                textEffect: e.target.value as VideoCueTextEffect,
              })
            }
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            {VIDEO_CUE_TEXT_EFFECTS.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-[11px] text-muted-foreground">Font</span>
          <select
            value={cue.font ?? 'system'}
            onChange={e => onUpdate({ font: e.target.value as VideoCueFontId })}
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
            <span>{Math.round((cue.fontScale ?? 0.04) * 1000) / 10}</span>
          </span>
          <input
            type="range"
            min={2}
            max={12}
            step={0.5}
            value={(cue.fontScale ?? 0.04) * 100}
            onChange={e => onUpdate({ fontScale: Number(e.target.value) / 100 })}
            className="w-full"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1">
            <span className="text-[11px] text-muted-foreground">Text color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={cue.color ?? '#ffffff'}
                onChange={e =>
                  onUpdate({
                    color: normalizeCueColor(e.target.value, '#ffffff'),
                  })
                }
                className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent p-0.5"
                aria-label="Text color"
              />
              <Input
                value={cue.color ?? '#ffffff'}
                onChange={e =>
                  onUpdate({
                    color: normalizeCueColor(e.target.value, cue.color ?? '#ffffff'),
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
                value={cue.shadowColor ?? '#000000'}
                onChange={e =>
                  onUpdate({
                    shadowColor: normalizeCueColor(e.target.value, '#000000'),
                  })
                }
                className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent p-0.5"
                aria-label="Shadow color"
              />
              <Input
                value={cue.shadowColor ?? '#000000'}
                onChange={e =>
                  onUpdate({
                    shadowColor: normalizeCueColor(
                      e.target.value,
                      cue.shadowColor ?? '#000000',
                    ),
                  })
                }
                className="h-8 font-mono text-xs"
              />
            </div>
          </label>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Drag the highlighted dialog on the video to move it. Use the corner handle to resize.
      </p>

      <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
        <span>X {Math.round(cue.x * 100)}%</span>
        <span>Y {Math.round(cue.y * 100)}%</span>
        <span>Width {Math.round((cue.width ?? 0.72) * 100)}%</span>
        <span>Size {Math.round((cue.fontScale ?? 0.04) * 1000) / 10}</span>
      </div>
    </div>
  );
}

export default function PlaylistVideoCueEditor({
  cues,
  onChange,
  placementCueId,
  onPlacementCueIdChange,
  currentTime,
}: PlaylistVideoCueEditorProps) {
  const sortedCues = useMemo(
    () => [...cues].sort((a, b) => a.start - b.start),
    [cues],
  );

  const selectedCue = useMemo(
    () => sortedCues.find(cue => cue.id === placementCueId) ?? null,
    [sortedCues, placementCueId],
  );

  const selectedIndex = selectedCue
    ? sortedCues.findIndex(cue => cue.id === selectedCue.id)
    : -1;

  const updateCue = useCallback(
    (cueId: string, patch: Partial<VideoTimedCue>) => {
      onChange(
        cues.map(cue => (cue.id === cueId ? { ...cue, ...patch } : cue)),
      );
    },
    [cues, onChange],
  );

  const removeCue = useCallback(
    (cueId: string) => {
      const next = cues.filter(cue => cue.id !== cueId);
      onChange(next);
      if (placementCueId === cueId) {
        const sorted = [...next].sort((a, b) => a.start - b.start);
        onPlacementCueIdChange(sorted[0]?.id ?? null);
      }
    },
    [cues, onChange, placementCueId, onPlacementCueIdChange],
  );

  const addCue = useCallback(() => {
    const lastEnd = sortedCues.at(-1)?.end ?? 0;
    const next = defaultVideoTimedCue(lastEnd, lastEnd + 5);
    onChange([...cues, next]);
    onPlacementCueIdChange(next.id);
  }, [cues, onChange, onPlacementCueIdChange, sortedCues]);

  return (
    <div className="space-y-3 border-t border-border/60 pt-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">Timed dialogs</div>
          <div className="text-xs text-muted-foreground">
            Select a block on the timeline to edit one dialog at a time
          </div>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={addCue}>
          Add
        </Button>
      </div>

      {sortedCues.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No dialogs yet. Add one, then drag it on the timeline under the video.
        </p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-1.5">
            {sortedCues.map((cue, index) => {
              const selected = placementCueId === cue.id;
              return (
                <li key={cue.id}>
                  <button
                    type="button"
                    onClick={() => onPlacementCueIdChange(cue.id)}
                    className={cn(
                      'max-w-full rounded-md border px-2 py-1 text-left text-[11px] transition-colors',
                      selected
                        ? 'border-primary bg-primary/15 text-foreground ring-1 ring-primary/30'
                        : 'border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                    )}
                    title={`${cueSummaryLabel(cue, index)} (${formatCueTime(cue.start)}–${formatCueTime(cue.end)})`}
                  >
                    <span className="block truncate font-medium">
                      {cueSummaryLabel(cue, index)}
                    </span>
                    <span className="block font-mono tabular-nums opacity-80">
                      {formatCueTime(cue.start)}–{formatCueTime(cue.end)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {selectedCue ? (
            <SelectedCueEditor
              key={selectedCue.id}
              cue={selectedCue}
              index={selectedIndex}
              currentTime={currentTime}
              onUpdate={patch => updateCue(selectedCue.id, patch)}
              onRemove={() => removeCue(selectedCue.id)}
            />
          ) : (
            <p className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
              Select a dialog on the timeline or pick a chip above to edit its settings.
            </p>
          )}
        </>
      )}
    </div>
  );
}
