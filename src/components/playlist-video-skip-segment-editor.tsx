'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCueTime, parseCueTime } from '@/lib/video-timed-cues';
import {
  commitSkipSegmentEnd,
  commitSkipSegmentStart,
  defaultVideoSkipSegment,
  type VideoSkipSegment,
} from '@/lib/video-skip-segments';

type PlaylistVideoSkipSegmentEditorProps = {
  segments: VideoSkipSegment[];
  onChange: (segments: VideoSkipSegment[]) => void;
};

function SegmentTimeField({
  segmentId,
  label,
  value,
  onCommit,
}: {
  segmentId: string;
  label: string;
  value: number;
  onCommit: (seconds: number) => void;
}) {
  const [draft, setDraft] = useState(formatCueTime(value));

  useEffect(() => {
    setDraft(formatCueTime(value));
  }, [value, segmentId]);

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
        className="h-8 font-mono text-xs"
        placeholder="0:00"
      />
    </label>
  );
}

export default function PlaylistVideoSkipSegmentEditor({
  segments,
  onChange,
}: PlaylistVideoSkipSegmentEditorProps) {
  const sortedSegments = useMemo(
    () => [...segments].sort((a, b) => a.start - b.start),
    [segments],
  );

  const updateSegment = useCallback(
    (segmentId: string, patch: Partial<VideoSkipSegment>) => {
      onChange(segments.map(segment => (segment.id === segmentId ? { ...segment, ...patch } : segment)));
    },
    [onChange, segments],
  );

  const removeSegment = useCallback(
    (segmentId: string) => {
      onChange(segments.filter(segment => segment.id !== segmentId));
    },
    [onChange, segments],
  );

  const addSegment = useCallback(() => {
    const lastEnd = sortedSegments.at(-1)?.end ?? 0;
    onChange([...segments, defaultVideoSkipSegment(lastEnd, lastEnd + 5)]);
  }, [onChange, segments, sortedSegments]);

  return (
    <div className="space-y-3 border-t border-border/60 pt-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">Skip segments</div>
          <div className="text-xs text-muted-foreground">
            Playback jumps over these time ranges automatically
          </div>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={addSegment}>
          Add
        </Button>
      </div>

      {sortedSegments.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No skip segments yet. Add one to jump over intros, outros, or dead air.
        </p>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {sortedSegments.map((segment, index) => (
            <li
              key={segment.id}
              className="space-y-2 rounded-lg border border-border/60 p-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Skip {index + 1}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => removeSegment(segment.id)}
                >
                  Remove
                </Button>
              </div>

              <Input
                value={segment.label ?? ''}
                onChange={e => updateSegment(segment.id, { label: e.target.value })}
                placeholder="Optional label"
                className="h-8 text-xs"
              />

              <div className="grid grid-cols-2 gap-2">
                <SegmentTimeField
                  segmentId={segment.id}
                  label="Start"
                  value={segment.start}
                  onCommit={start => {
                    const next = commitSkipSegmentStart(start, segment.end);
                    updateSegment(segment.id, next);
                  }}
                />
                <SegmentTimeField
                  segmentId={segment.id}
                  label="End"
                  value={segment.end}
                  onCommit={end => {
                    const next = commitSkipSegmentEnd(segment.start, end);
                    updateSegment(segment.id, next);
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
