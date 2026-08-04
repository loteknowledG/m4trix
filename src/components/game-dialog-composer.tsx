'use client';

import { ChevronLeft, ChevronRight } from '@/components/icons';
import { DialogLineStyleEditor } from '@/components/dialog-line-style-editor';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { VideoCueTextEffectView } from '@/components/text/video-cue-text-effect-view';
import type { CharacterDialogStyle } from '@/lib/character-dialog-style';
import { resolveCharacterDialogStyle } from '@/lib/character-dialog-style';
import type { GameCharacterSlot } from '@/lib/game-dialog-layout';
import {
  buildCueTextShadow,
  resolveVideoCueFontFamily,
} from '@/lib/video-timed-cues';
import { videoCueTextEffectsKey } from '@/lib/video-cue-text-effects';
import { cn } from '@/lib/utils';

type CharacterTab = {
  id: GameCharacterSlot;
  label: string;
  role: 'player' | 'npc' | 'narrator';
};

type GameDialogComposerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabs: CharacterTab[];
  activeCharacter: GameCharacterSlot;
  onActiveCharacterChange: (id: GameCharacterSlot) => void;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  dialogStyle?: CharacterDialogStyle | null;
  onDialogStyleChange: (patch: Partial<CharacterDialogStyle>) => void;
  disabled?: boolean;
  inputMaxLength?: number;
};

export function GameDialogComposer({
  open,
  onOpenChange,
  tabs,
  activeCharacter,
  onActiveCharacterChange,
  input,
  onInputChange,
  onSend,
  dialogStyle,
  onDialogStyleChange,
  disabled = false,
  inputMaxLength,
}: GameDialogComposerProps) {
  const activeTab = tabs.find(tab => tab.id === activeCharacter) ?? tabs[0];
  const style = resolveCharacterDialogStyle(dialogStyle);
  const previewText = input.trim();

  if (!open) {
    return (
      <Button
        type="button"
        variant="raised"
        size="icon"
        onClick={() => onOpenChange(true)}
        className="m4-pushable-icon pointer-events-auto absolute top-1/2 right-0 z-30 translate-x-1/2 -translate-y-1/2"
        aria-label="Open dialog panel"
        title="Open dialog panel"
      >
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
      </Button>
    );
  }

  return (
    <div
      className="pointer-events-auto absolute inset-y-0 right-0 z-30 flex w-[min(100vw,26rem)] max-w-full flex-col border-l border-border/60 bg-background shadow-2xl"
      role="dialog"
      aria-label="Game dialog composer"
      onClick={event => event.stopPropagation()}
      onPointerDown={event => event.stopPropagation()}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
          <h3 className="text-sm font-medium">Dialog</h3>
          <Button
            type="button"
            variant="raised"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="m4-pushable-icon shrink-0"
            aria-label="Close dialog panel"
            title="Close dialog panel"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-border/60 px-4 py-3">
            <ul className="flex flex-wrap gap-1.5">
              {tabs.map(tab => (
                <li key={tab.id}>
                  <button
                    type="button"
                    onClick={() => onActiveCharacterChange(tab.id)}
                    className={cn(
                      'rounded-md border px-2 py-1 text-left text-[11px] transition-colors',
                      activeCharacter === tab.id
                        ? 'border-primary bg-primary/15 text-foreground ring-1 ring-primary/30'
                        : 'border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                    )}
                  >
                    {tab.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {activeTab ? (
              <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3 ring-1 ring-primary/20">
                <div>
                  <div className="text-sm font-medium">{activeTab.label} says</div>
                  <div className="text-[11px] text-muted-foreground">
                    {activeTab.role === 'narrator'
                      ? 'Narrator'
                      : activeTab.role === 'player'
                        ? 'Player'
                        : 'AI character'}
                  </div>
                </div>

                <label className="grid gap-1">
                  <span className="text-[11px] text-muted-foreground">Dialog text</span>
                  <Textarea
                    value={input}
                    onChange={event => {
                      const next = event.target.value;
                      if (inputMaxLength != null && next.length > inputMaxLength) {
                        onInputChange(next.slice(0, inputMaxLength));
                        return;
                      }
                      onInputChange(next);
                    }}
                    placeholder={`Write as ${activeTab.label}…`}
                    rows={4}
                    className="resize-y text-xs"
                    disabled={disabled}
                    maxLength={inputMaxLength}
                    onKeyDown={event => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        if (!disabled && input.trim()) onSend();
                      }
                    }}
                  />
                  {inputMaxLength != null ? (
                    <span className="text-right text-[10px] tabular-nums text-muted-foreground">
                      {input.length}/{inputMaxLength}
                    </span>
                  ) : null}
                </label>

                <DialogLineStyleEditor
                  values={{
                    textEffects: style.textEffects,
                    font: style.font,
                    fontScale: style.fontScale,
                    color: style.color,
                    shadowColor: style.shadowColor,
                    speakerColor: style.speakerColor,
                  }}
                  onChange={onDialogStyleChange}
                />

                {previewText ? (
                  <div
                    className="rounded-lg border border-border/40 bg-black/40 px-3 py-2 text-sm whitespace-pre-wrap"
                    style={{
                      color: style.color,
                      textShadow: buildCueTextShadow(style.shadowColor),
                      fontFamily: resolveVideoCueFontFamily(style.font),
                      fontSize: `${Math.max(0.75, style.fontScale * 18)}rem`,
                    }}
                  >
                    <VideoCueTextEffectView
                      text={previewText}
                      effects={style.textEffects}
                      color={style.color}
                      shadowColor={style.shadowColor}
                      lineKey={`${activeTab.id}-preview`}
                      replayKey={`${activeTab.id}-${videoCueTextEffectsKey(style.textEffects)}-${previewText}`}
                      className="text-inherit"
                    />
                  </div>
                ) : null}

                <p className="text-[11px] text-muted-foreground">
                  Drag the highlighted dialog bubble on the scene to move it · use the corner
                  handle to resize.
                </p>

                <Button
                  type="button"
                  className="w-full"
                  disabled={disabled || !input.trim()}
                  onClick={onSend}
                >
                  Send
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
