'use client';

import { useCallback, useState } from 'react';
import { VideoCueTextEffectView } from '@/components/text/video-cue-text-effect-view';
import {
  characterDialogFontSize,
  resolveCharacterDialogStyle,
  type CharacterDialogStyle,
} from '@/lib/character-dialog-style';
import { videoCueTextEffectsKey } from '@/lib/video-cue-text-effects';
import { buildCueTextShadow, resolveVideoCueFontFamily } from '@/lib/video-timed-cues';
import { cn } from '@/lib/utils';
import { getImageFileFromPasteEvent } from '@/lib/clipboard-image';
import { toast } from 'sonner';

type DescriptionEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  dialogStyle?: CharacterDialogStyle;
};

function stripDescriptionForDisplay(value: string): string {
  return value
    .replace(/<img[^>]*>/gi, '[image]')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
}

export function DescriptionEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  className,
  dialogStyle,
}: DescriptionEditorProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const file = getImageFileFromPasteEvent(e);
      if (!file) return;

      e.preventDefault();

      const reader = new FileReader();
      reader.onload = event => {
        const dataUrl = event.target?.result as string;
        const imgTag = `\n<img src="${dataUrl}" alt="Pasted image" style="max-width:100%;border-radius:8px;" />\n`;
        const newValue = value + imgTag;
        onChange(newValue);
        toast.success('Image pasted into description.');
      };
      reader.readAsDataURL(file);
    },
    [value, onChange],
  );

  const resolvedStyle = resolveCharacterDialogStyle(dialogStyle);
  const displayText = stripDescriptionForDisplay(value);
  const fontSize = characterDialogFontSize(resolvedStyle.fontScale, false);
  const hasEffectOverlay = Boolean(displayText);
  const styledText = {
    fontFamily: resolveVideoCueFontFamily(resolvedStyle.font),
    fontSize,
    lineHeight: 1.625,
    textShadow: buildCueTextShadow(resolvedStyle.shadowColor),
  };
  const textareaStyle = hasEffectOverlay
    ? {
        fontFamily: styledText.fontFamily,
        fontSize: styledText.fontSize,
        lineHeight: styledText.lineHeight,
        color: 'transparent',
        WebkitTextFillColor: 'transparent',
        textShadow: 'none',
        caretColor: resolvedStyle.color,
      }
    : {
        ...styledText,
        color: resolvedStyle.color,
      };

  if (!dialogStyle) {
    return (
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        onBlur={onBlur}
        onPaste={handlePaste}
        placeholder={placeholder}
        aria-label="Description"
        rows={6}
        className={cn(
          'w-full min-h-[120px] resize-y rounded border border-zinc-700 bg-transparent px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-zinc-500 focus:border-primary',
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        'relative w-full min-h-[220px] rounded border border-zinc-700 bg-black/20 transition-colors focus-within:border-primary',
        className,
      )}
    >
      {displayText ? (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden px-3 py-2 whitespace-pre-wrap break-words leading-relaxed"
          aria-hidden
          style={styledText}
        >
          <VideoCueTextEffectView
            key={`${videoCueTextEffectsKey(resolvedStyle.textEffects)}-${isFocused ? 'edit' : 'preview'}`}
            text={displayText}
            effects={resolvedStyle.textEffects}
            color={resolvedStyle.color}
            shadowColor={resolvedStyle.shadowColor}
            lineKey="character-description"
            animated={!isFocused}
          />
        </div>
      ) : null}
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          onBlur?.();
        }}
        onPaste={handlePaste}
        placeholder={placeholder}
        aria-label="Description"
        rows={8}
        className={cn(
          'relative z-[1] w-full min-h-[220px] resize-y bg-transparent px-3 py-2 outline-none placeholder:text-zinc-500',
          hasEffectOverlay ? 'text-transparent' : 'text-foreground',
        )}
        style={textareaStyle}
      />
    </div>
  );
}
