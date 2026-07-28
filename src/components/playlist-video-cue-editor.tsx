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
      onChange(cues.filter(cue => cue.id !== cueId));
      if (placementCueId === cueId) onPlacementCueIdChange(null);
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
            Use the timeline under the video, or type times below
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
        <ul className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
          {sortedCues.map((cue, index) => {
            const placing = placementCueId === cue.id;
            return (
              <li
                key={cue.id}
                className={cn(
                  'space-y-2 rounded-lg border border-border/60 p-2',
                  placing && 'border-primary/50 ring-1 ring-primary/30',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Dialog {index + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={placing ? 'default' : 'outline'}
                      className="h-7 px-2 text-xs"
                      onClick={() => onPlacementCueIdChange(placing ? null : cue.id)}
                    >
                      {placing ? 'Done' : 'Edit on video'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => removeCue(cue.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <CueTimeField
                    cueId={cue.id}
                    label="Start"
                    value={cue.start}
                    currentTime={currentTime}
                    onCommit={start => {
                      const next = commitCueStartTime(start, cue.end);
                      updateCue(cue.id, next);
                    }}
                  />
                  <CueTimeField
                    cueId={cue.id}
                    label="End"
                    value={cue.end}
                    currentTime={currentTime}
                    onCommit={end => {
                      const next = commitCueEndTime(cue.start, end);
                      updateCue(cue.id, next);
                    }}
                  />
                </div>

                <Input
                  value={cue.speaker ?? ''}
                  onChange={e => updateCue(cue.id, { speaker: e.target.value })}
                  placeholder="Speaker (optional)"
                  className="h-8 text-xs"
                />

                <Textarea
                  value={cue.text}
                  onChange={e => updateCue(cue.id, { text: e.target.value })}
                  placeholder="Dialog text"
                  rows={2}
                  className="resize-y text-xs"
                />

                <div className="space-y-2 rounded-md border border-border/50 bg-muted/20 p-2">
                  <div className="text-[11px] font-medium text-muted-foreground">Style</div>

                  <label className="grid gap-1">
                    <span className="text-[11px] text-muted-foreground">Text effect</span>
                    <select
                      value={cue.textEffect ?? 'none'}
                      onChange={e =>
                        updateCue(cue.id, {
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
                      onChange={e =>
                        updateCue(cue.id, { font: e.target.value as VideoCueFontId })
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
                      <span>{Math.round((cue.fontScale ?? 0.04) * 1000) / 10}</span>
                    </span>
                    <input
                      type="range"
                      min={2}
                      max={12}
                      step={0.5}
                      value={(cue.fontScale ?? 0.04) * 100}
                      onChange={e =>
                        updateCue(cue.id, { fontScale: Number(e.target.value) / 100 })
                      }
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
                            updateCue(cue.id, {
                              color: normalizeCueColor(e.target.value, '#ffffff'),
                            })
                          }
                          className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent p-0.5"
                          aria-label="Text color"
                        />
                        <Input
                          value={cue.color ?? '#ffffff'}
                          onChange={e =>
                            updateCue(cue.id, {
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
                            updateCue(cue.id, {
                              shadowColor: normalizeCueColor(e.target.value, '#000000'),
                            })
                          }
                          className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent p-0.5"
                          aria-label="Shadow color"
                        />
                        <Input
                          value={cue.shadowColor ?? '#000000'}
                          onChange={e =>
                            updateCue(cue.id, {
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

                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                  <span>X {Math.round(cue.x * 100)}%</span>
                  <span>Y {Math.round(cue.y * 100)}%</span>
                  <span>Width {Math.round((cue.width ?? 0.72) * 100)}%</span>
                  <span>Size {Math.round((cue.fontScale ?? 0.04) * 1000) / 10}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
