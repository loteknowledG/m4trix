'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCueTime, parseCueTime } from '@/lib/video-timed-cues';

type CueTimeFieldProps = {
  fieldId: string;
  label: string;
  value: number;
  currentTime?: number;
  onCommit: (seconds: number) => void;
};

export function CueTimeField({
  fieldId,
  label,
  value,
  currentTime,
  onCommit,
}: CueTimeFieldProps) {
  const [draft, setDraft] = useState(formatCueTime(value));

  useEffect(() => {
    setDraft(formatCueTime(value));
  }, [value, fieldId]);

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
          onChange={event => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              (event.currentTarget as HTMLInputElement).blur();
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
