'use client';

import { ChevronLeft } from '@/components/icons';
import { DialogLineStyleEditor } from '@/components/dialog-line-style-editor';
import type { CharacterDialogStyle } from '@/lib/character-dialog-style';
import { resolveCharacterDialogStyle } from '@/lib/character-dialog-style';
import type { GameCharacterSlot } from '@/lib/game-dialog-layout';
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
  dialogStyle?: CharacterDialogStyle | null;
};

export function GameDialogComposer({
  open,
  onOpenChange,
  tabs,
  activeCharacter,
  onActiveCharacterChange,
  dialogStyle,
}: GameDialogComposerProps) {
  const activeTab = tabs.find(tab => tab.id === activeCharacter) ?? tabs[0];
  const style = resolveCharacterDialogStyle(dialogStyle);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="pointer-events-auto absolute inset-y-0 right-0 z-30 flex w-10 flex-col items-center justify-center gap-1 rounded-l-md border border-r-0 border-border/60 bg-background/95 text-foreground shadow-lg backdrop-blur-sm transition-colors hover:bg-accent/20"
        aria-label="Open dialog panel"
        title="Open dialog panel"
      >
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
        <span className="text-[10px] font-medium uppercase tracking-wide [writing-mode:vertical-rl]">
          Dialog
        </span>
      </button>
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
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-transparent text-foreground hover:bg-accent/20"
            aria-label="Close dialog panel"
            title="Close dialog panel"
          >
            ×
          </button>
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

                <fieldset disabled className="min-w-0 border-0 p-0 opacity-90">
                  <DialogLineStyleEditor
                    values={{
                      textEffects: style.textEffects,
                      font: style.font,
                      fontScale: style.fontScale,
                      color: style.color,
                      shadowColor: style.shadowColor,
                      speakerColor: style.speakerColor,
                    }}
                    onChange={() => {
                      /* game dialog styles come from character settings for now */
                    }}
                  />
                </fieldset>

                <p className="text-[11px] text-muted-foreground">
                  Drag the highlighted dialog bubble on the scene to move it · use the corner
                  handle to resize.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
