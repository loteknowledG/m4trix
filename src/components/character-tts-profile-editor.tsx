'use client';

import { useState } from 'react';
import {
  CHARACTER_TTS_PROFILE_OPTIONS,
  CHARACTER_TTS_PROFILE_OPTIONS_ALPHABETICAL,
  characterTtsVoiceLabel,
  normalizeCharacterTtsVoice,
  resolveCharacterTtsVoice,
  type CharacterTtsVoice,
} from '@/lib/character-tts-profile';
import { speakWithCharacterTtsVoice, unlockAudioPlayback } from '@/lib/tts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type CharacterTtsProfileEditorProps = {
  value: CharacterTtsVoice;
  previewText?: string;
  onChange: (voice: CharacterTtsVoice) => void;
};

export function CharacterTtsProfileEditor({
  value,
  previewText = 'Hello. This is how I will sound when I speak.',
  onChange,
}: CharacterTtsProfileEditorProps) {
  const [previewing, setPreviewing] = useState(false);
  const settings = resolveCharacterTtsVoice(value);
  const selectedProfile = CHARACTER_TTS_PROFILE_OPTIONS.find(
    option => option.id === settings.profileId,
  );

  const patch = (next: Partial<CharacterTtsVoice>) => {
    onChange(normalizeCharacterTtsVoice({ ...settings, ...next }));
  };

  const handlePreview = async () => {
    const text = previewText.trim();
    if (previewing) return;
    if (!text) {
      toast.error('Add a character name or description to preview voice.');
      return;
    }
    unlockAudioPlayback();
    setPreviewing(true);
    try {
      const result = await speakWithCharacterTtsVoice(text, settings, undefined, {
        allowFallback: true,
      });
      if (!result.ok) {
        toast.error(result.error || 'Voice preview failed.');
      }
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="space-y-2 overflow-visible rounded-md border border-border/50 bg-muted/20 p-2 pb-3">
      <div>
        <div className="text-[11px] font-medium text-muted-foreground">Voice profile</div>
        <p className="text-[10px] leading-relaxed text-muted-foreground/80">
          Local styled voices rendered on your machine via Edge TTS.
        </p>
      </div>

      <label className="grid gap-1">
        <span className="text-[11px] text-muted-foreground">Profile</span>
        <select
          value={settings.profileId}
          onChange={event => patch({ profileId: event.target.value as CharacterTtsVoice['profileId'] })}
          className="relative z-10 h-8 w-full cursor-pointer rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Voice profile"
        >
          {CHARACTER_TTS_PROFILE_OPTIONS_ALPHABETICAL.map(option => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {selectedProfile?.description ? (
        <p className="text-[10px] leading-relaxed text-muted-foreground">{selectedProfile.description}</p>
      ) : null}

      <div className="flex items-center justify-between gap-2 overflow-visible pb-1">
        <span className="text-[11px] text-muted-foreground">{characterTtsVoiceLabel(settings)}</span>
        <button
          type="button"
          disabled={previewing}
          onPointerDown={() => {
            unlockAudioPlayback();
          }}
          onClick={() => {
            void handlePreview();
          }}
          className={cn(
            'm4-paper-pushable-btn pointer-events-auto h-7 px-2.5 text-[11px] font-medium',
            'hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {previewing ? 'Playing…' : 'Preview voice'}
        </button>
      </div>
    </div>
  );
}
