'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DialogLineStyleEditor } from '@/components/dialog-line-style-editor';
import { DialogTextEffectView } from '@/components/text/dialog-text-effect-view';
import { buildCueTextShadow, resolveVideoCueFontFamily } from '@/lib/video-timed-cues';
import { logger } from '@/lib/logger';
import {
  addLineForCharacter,
  clearLinePositionsInScript,
  ensureCharacterPositions,
  loadMomentDialogScript,
  moveCharacterInOrder,
  moveLineForCharacter,
  orderedCharactersFromScript,
  removeLineFromScript,
  resolveCharacterPosition,
  resolveMomentDialogLineStyle,
  saveMomentDialogScript,
  scriptPreviewLines,
  updateCharacterPositionInScript,
  updateLineInScript,
  updateLineTextInScript,
  type DialogSpeakerPosition,
  type MomentDialogLine,
  type MomentDialogScript,
} from '@/lib/moment-dialog';
import { loadStorySceneCharacters, type SceneCharacter } from '@/lib/scene-characters';
import { cn } from '@/lib/utils';

type MomentDialogModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  momentId: string | null;
  storyId?: string | null;
  onStartPlacement?: () => void | Promise<void>;
};

type OrderedCharacter = SceneCharacter & { roleLabel: string };

function lineChipLabel(line: MomentDialogLine) {
  const text = line.text.trim();
  if (text) return text.length > 28 ? `${text.slice(0, 28)}…` : text;
  return 'Empty line';
}

function SelectedMomentLineEditor({
  line,
  characterName,
  onUpdate,
  onRemove,
}: {
  line: MomentDialogLine;
  characterName: string;
  onUpdate: (patch: Partial<MomentDialogLine>) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(line.text);
  const style = resolveMomentDialogLineStyle(line);
  const effect = style.textEffect;

  useEffect(() => {
    setDraft(line.text);
  }, [line.id, line.text]);

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3 ring-1 ring-primary/20">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">{lineChipLabel(line)}</div>
          <div className="text-[11px] text-muted-foreground">{characterName}</div>
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

      <Textarea
        value={draft}
        onChange={event => setDraft(event.target.value)}
        onBlur={() => {
          const trimmed = draft.trim();
          if (!trimmed) {
            onRemove();
            return;
          }
          if (trimmed !== line.text) {
            onUpdate({ text: trimmed });
          } else {
            setDraft(trimmed);
          }
        }}
        placeholder="Dialog text"
        rows={3}
        className="resize-y text-xs"
      />

      <DialogLineStyleEditor
        values={{
          textEffect: style.textEffect,
          font: style.font,
          fontScale: style.fontScale,
          color: style.color,
          shadowColor: style.shadowColor,
          speakerColor: style.speakerColor,
        }}
        onChange={onUpdate}
      />

      {draft.trim() ? (
        <div
          className="rounded-lg px-3 py-2 text-sm"
          style={{
            color: style.color,
            textShadow: buildCueTextShadow(style.shadowColor),
            fontFamily: resolveVideoCueFontFamily(style.font),
            fontSize: `${Math.max(0.75, style.fontScale * 18)}rem`,
          }}
        >
          <DialogTextEffectView
            text={draft.trim()}
            effect={effect}
            lineKey={line.id}
            replayKey={`${line.id}-${effect}-preview`}
            className="text-inherit"
          />
        </div>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        Use Place on scene to drag this bubble, or rely on the speaker position setting.
      </p>
    </div>
  );
}

function ParticipantDialogCard({
  character,
  index,
  total,
  lines,
  position,
  selectedLineId,
  onSelectLine,
  onPositionChange,
  onMoveParticipant,
  onAddLine,
  onMoveLine,
}: {
  character: OrderedCharacter;
  index: number;
  total: number;
  lines: MomentDialogLine[];
  position: DialogSpeakerPosition;
  selectedLineId: string | null;
  onSelectLine: (lineId: string) => void;
  onPositionChange: (position: DialogSpeakerPosition) => void;
  onMoveParticipant: (direction: -1 | 1) => void;
  onAddLine: (text: string) => void;
  onMoveLine: (lineId: string, direction: -1 | 1) => void;
}) {
  const [draft, setDraft] = useState('');
  const palette = getStagePalette(index);

  return (
    <section
      className="rounded-xl border border-border/70 bg-background/40 p-3"
      style={{ boxShadow: `inset 3px 0 0 0 ${palette.fg}` }}
    >
      <div className="mb-3 flex items-start gap-2">
        <span
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
          style={{ backgroundColor: palette.bg, color: palette.fg }}
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{character.name}</div>
          <div className="text-[11px] text-muted-foreground">{character.roleLabel}</div>
          <label className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="shrink-0">Position</span>
            <select
              value={position}
              onChange={event =>
                onPositionChange(event.target.value as DialogSpeakerPosition)
              }
              className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary"
              aria-label={`${character.name} dialog position`}
            >
              {character.role === 'narrator' ? (
                <>
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                </>
              ) : (
                <>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </>
              )}
            </select>
          </label>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onMoveParticipant(-1)}
            disabled={index === 0}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent/40 disabled:opacity-30"
            aria-label={`Move ${character.name} earlier in scene`}
          >
            <ChevronUp size={16} />
          </button>
          <button
            type="button"
            onClick={() => onMoveParticipant(1)}
            disabled={index === total - 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent/40 disabled:opacity-30"
            aria-label={`Move ${character.name} later in scene`}
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {lines.length ? (
        <ul className="mb-3 flex flex-wrap gap-1.5">
          {lines.map((line, lineIndex) => {
            const selected = selectedLineId === line.id;
            return (
              <li key={line.id} className="inline-flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onSelectLine(line.id)}
                  className={cn(
                    'max-w-full rounded-md border px-2 py-1 text-left text-[11px] transition-colors',
                    selected
                      ? 'border-primary bg-primary/15 text-foreground ring-1 ring-primary/30'
                      : 'border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                >
                  <span className="block truncate font-medium">{lineChipLabel(line)}</span>
                </button>
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => onMoveLine(line.id, -1)}
                    disabled={lineIndex === 0}
                    className="inline-flex h-4 w-4 items-center justify-center rounded opacity-70 hover:opacity-100 disabled:opacity-30"
                    aria-label="Move line up"
                  >
                    <ChevronUp size={10} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveLine(line.id, 1)}
                    disabled={lineIndex === lines.length - 1}
                    className="inline-flex h-4 w-4 items-center justify-center rounded opacity-70 hover:opacity-100 disabled:opacity-30"
                    aria-label="Move line down"
                  >
                    <ChevronDown size={10} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mb-3 rounded-lg border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
          No lines yet.
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            const text = draft.trim();
            if (!text) return;
            onAddLine(text);
            setDraft('');
          }}
          className="min-w-0 flex-1 rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          placeholder={`Add a line for ${character.name}`}
        />
        <button
          type="button"
          onClick={() => {
            const text = draft.trim();
            if (!text) return;
            onAddLine(text);
            setDraft('');
          }}
          className="shrink-0 rounded px-3 py-2 text-sm hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: palette.fg, color: palette.bg }}
          disabled={!draft.trim()}
        >
          Add
        </button>
      </div>
    </section>
  );
}

export function MomentDialogModal({
  open,
  onOpenChange,
  momentId,
  storyId,
  onStartPlacement,
}: MomentDialogModalProps) {
  const [script, setScript] = useState<MomentDialogScript>({ characterOrder: [], lines: [] });
  const [sceneCharacters, setSceneCharacters] = useState<SceneCharacter[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedLineId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void loadStorySceneCharacters(storyId)
      .then(characters => {
        if (!cancelled) setSceneCharacters(characters);
      })
      .catch(error => {
        logger.error('Failed to load scene characters', error);
        if (!cancelled) setSceneCharacters([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, storyId]);

  useEffect(() => {
    if (!open || !momentId) return;
    let cancelled = false;
    setLoading(true);
    const fallbackOrder = sceneCharacters.map(character => character.id);
    void loadMomentDialogScript(momentId, storyId, fallbackOrder)
      .then(loaded => {
        if (!cancelled) {
          const next = ensureCharacterPositions(loaded, sceneCharacters);
          setScript(next);
          setSelectedLineId(prev =>
            prev && next.lines.some(line => line.id === prev) ? prev : next.lines[0]?.id ?? null,
          );
        }
      })
      .catch(error => {
        logger.error('Failed to load moment dialog', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, momentId, storyId, sceneCharacters]);

  const orderedCharacters = useMemo(
    () =>
      orderedCharactersFromScript(script, sceneCharacters).map(character => {
        const scene = sceneCharacters.find(entry => entry.id === character.id);
        return {
          id: character.id,
          name: character.name,
          role: scene?.role ?? 'npc',
          roleLabel: scene?.roleLabel ?? character.roleLabel ?? 'Character',
        } satisfies OrderedCharacter;
      }),
    [script, sceneCharacters],
  );

  const selectedLine = useMemo(
    () => script.lines.find(line => line.id === selectedLineId) ?? null,
    [script.lines, selectedLineId],
  );

  const selectedCharacter = useMemo(() => {
    if (!selectedLine) return null;
    return orderedCharacters.find(character => character.id === selectedLine.characterId) ?? null;
  }, [orderedCharacters, selectedLine]);

  const persistScript = useCallback(
    async (nextScript: MomentDialogScript) => {
      if (!momentId) return;
      setScript(nextScript);
      try {
        await saveMomentDialogScript(momentId, nextScript, storyId);
      } catch (error) {
        logger.error('Failed to save moment dialog', error);
      }
    },
    [momentId, storyId],
  );

  const moveCharacter = useCallback(
    (characterId: string, direction: -1 | 1) => {
      const currentOrder = orderedCharacters.map(character => character.id);
      const nextOrder = moveCharacterInOrder(currentOrder, characterId, direction);
      void persistScript({ ...script, characterOrder: nextOrder });
    },
    [orderedCharacters, persistScript, script],
  );

  const addLine = useCallback(
    (character: OrderedCharacter, text: string) => {
      const nextScript = addLineForCharacter(script, character, text);
      const added = nextScript.lines[nextScript.lines.length - 1];
      setSelectedLineId(added?.id ?? null);
      void persistScript(nextScript);
    },
    [persistScript, script],
  );

  const removeLine = useCallback(
    (lineId: string) => {
      const preview = scriptPreviewLines(script, orderedCharacters);
      const next = removeLineFromScript(script, lineId);
      void persistScript(next);
      setSelectedLineId(prev => {
        if (prev !== lineId) return prev;
        const remaining = preview.filter(line => line.id !== lineId);
        return remaining[0]?.id ?? null;
      });
    },
    [orderedCharacters, persistScript, script],
  );

  const updateLine = useCallback(
    (lineId: string, patch: Partial<MomentDialogLine>) => {
      if ('text' in patch && typeof patch.text === 'string') {
        void persistScript(updateLineTextInScript(script, lineId, patch.text));
        return;
      }
      void persistScript(updateLineInScript(script, lineId, patch));
    },
    [persistScript, script],
  );

  const moveLine = useCallback(
    (characterId: string, lineId: string, direction: -1 | 1) => {
      void persistScript(moveLineForCharacter(script, characterId, lineId, direction));
    },
    [persistScript, script],
  );

  const updateCharacterPosition = useCallback(
    (characterId: string, role: OrderedCharacter['role'], position: DialogSpeakerPosition) => {
      const validPosition =
        role === 'narrator'
          ? position === 'top' || position === 'bottom'
            ? position
            : 'bottom'
          : position === 'left' || position === 'right'
            ? position
            : 'left';
      void persistScript(updateCharacterPositionInScript(script, characterId, validPosition));
    },
    [persistScript, script],
  );

  const resetLayout = useCallback(() => {
    void persistScript(clearLinePositionsInScript(script));
  }, [persistScript, script]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[1300] max-w-2xl overflow-hidden p-0"
        aria-describedby="moment-dialog-description"
        onClick={event => event.stopPropagation()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Dialog</DialogTitle>
          <DialogDescription id="moment-dialog-description">
            Reorder participants, add lines, and edit one dialog at a time.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[85vh] min-h-0 flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
            <h3 className="text-sm font-medium">Dialog</h3>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-transparent text-foreground hover:bg-accent/20"
              aria-label="Close dialog editor"
            >
              ×
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="rounded border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                Loading dialog…
              </div>
            ) : orderedCharacters.length ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Set each speaker&apos;s scene position, add lines, then pick a chip to style one
                  dialog at a time — like the video dialog editor.
                </p>
                {orderedCharacters.map((character, index) => (
                  <ParticipantDialogCard
                    key={character.id}
                    character={character}
                    index={index}
                    total={orderedCharacters.length}
                    lines={script.lines.filter(line => line.characterId === character.id)}
                    position={resolveCharacterPosition(script, character.id, character.role)}
                    selectedLineId={selectedLineId}
                    onSelectLine={setSelectedLineId}
                    onPositionChange={position =>
                      updateCharacterPosition(character.id, character.role, position)
                    }
                    onMoveParticipant={direction => moveCharacter(character.id, direction)}
                    onAddLine={text => addLine(character, text)}
                    onMoveLine={(lineId, direction) => moveLine(character.id, lineId, direction)}
                  />
                ))}

              </div>
            ) : storyId ? (
              <p className="text-xs text-muted-foreground">
                Assign a player and AI character in story info to write scene dialog here.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Open this moment from a story to write character dialog.
              </p>
            )}
          </div>

          {script.lines.length > 0 ? (
            selectedLine && selectedCharacter ? (
              <div className="max-h-[min(42vh,420px)] shrink-0 overflow-y-auto border-t border-border/60 p-4">
                <SelectedMomentLineEditor
                  key={selectedLine.id}
                  line={selectedLine}
                  characterName={selectedCharacter.name}
                  onUpdate={patch => updateLine(selectedLine.id, patch)}
                  onRemove={() => removeLine(selectedLine.id)}
                />
              </div>
            ) : (
              <div className="shrink-0 border-t border-border/60 px-4 py-3">
                <p className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                  Select a dialog chip above to edit text and style.
                </p>
              </div>
            )
          ) : null}

          {script.lines.length > 0 ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border/60 px-4 py-3">
              <button
                type="button"
                onClick={() => resetLayout()}
                className="rounded px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/20"
              >
                Reset layout
              </button>
              {onStartPlacement ? (
                <button
                  type="button"
                  onClick={() => {
                    void onStartPlacement();
                  }}
                  className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90"
                >
                  Place on scene
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
