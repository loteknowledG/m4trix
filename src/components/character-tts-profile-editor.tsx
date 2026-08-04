'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  CHARACTER_TTS_PROFILE_OPTIONS,
  CHARACTER_TTS_PROFILE_OPTIONS_ALPHABETICAL,
  characterTtsVoiceLabel,
  normalizeCharacterTtsVoice,
  resolveCharacterTtsVoice,
  type CharacterTtsVoice,
} from '@/lib/character-tts-profile';
import { speakWithCharacterTtsVoice } from '@/lib/tts';
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
    if (previewing || !previewText.trim()) return;
    setPreviewing(true);
    try {
      const result = await speakWithCharacterTtsVoice(previewText, settings, undefined, {
        allowFallback: false,
      });
      if (!result.ok) {
        toast.error(result.error);
      }
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-border/50 bg-muted/20 p-2">
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
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
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

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{characterTtsVoiceLabel(settings)}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[11px]"
          disabled={previewing}
          onClick={() => {
            void handlePreview();
          }}
        >
          {previewing ? 'Playing…' : 'Preview voice'}
        </Button>
      </div>
    </div>
  );
}
