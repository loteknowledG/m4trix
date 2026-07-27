"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "@/components/icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getStagePalette } from "@/lib/game/story-arc-palettes";
import { logger } from "@/lib/logger";
import {
  addLineForCharacter,
  clearLinePositionsInScript,
  loadMomentDialogScript,
  moveCharacterInOrder,
  moveLineForCharacter,
  orderedCharactersFromScript,
  removeLineFromScript,
  saveMomentDialogScript,
  updateLineEffectInScript,
  updateLineTextInScript,
  type MomentDialogScript,
} from "@/lib/moment-dialog";
import {
  DIALOG_TEXT_EFFECTS,
  normalizeDialogTextEffect,
  type DialogTextEffect,
} from "@/lib/dialog-text-effects";
import { loadStorySceneCharacters, type SceneCharacter } from "@/lib/scene-characters";
import { DialogTextEffectView } from "@/components/text/dialog-text-effect-view";

type MomentDialogModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  momentId: string | null;
  storyId?: string | null;
  onStartPlacement?: () => void | Promise<void>;
};

type OrderedCharacter = SceneCharacter & { roleLabel: string };

function DialogLineEditor({
  line,
  palette,
  lineIndex,
  totalLines,
  onMoveLine,
  onRemoveLine,
  onUpdateLine,
  onUpdateEffect,
}: {
  line: { id: string; text: string; textEffect?: DialogTextEffect };
  palette: { bg: string; fg: string };
  lineIndex: number;
  totalLines: number;
  onMoveLine: (direction: -1 | 1) => void;
  onRemoveLine: () => void;
  onUpdateLine: (text: string) => void;
  onUpdateEffect: (effect: DialogTextEffect) => void;
}) {
  const [draft, setDraft] = useState(line.text);
  const effect = normalizeDialogTextEffect(line.textEffect);

  useEffect(() => {
    setDraft(line.text);
  }, [line.id, line.text]);

  return (
    <div
      className="flex items-start gap-2 rounded-lg border px-3 py-2"
      style={{ backgroundColor: palette.bg, color: palette.fg }}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            const trimmed = draft.trim();
            if (!trimmed) {
              onRemoveLine();
              return;
            }
            if (trimmed !== line.text) {
              onUpdateLine(trimmed);
            } else {
              setDraft(trimmed);
            }
          }}
          rows={Math.min(6, Math.max(1, draft.split("\n").length))}
          className="w-full resize-y bg-transparent text-sm outline-none placeholder:opacity-60"
          aria-label="Edit dialog line"
        />
        <label className="flex items-center gap-2 text-[11px] opacity-80">
          <span className="shrink-0">Text effect</span>
          <select
            value={effect}
            onChange={(event) =>
              onUpdateEffect(normalizeDialogTextEffect(event.target.value))
            }
            className="min-w-0 flex-1 rounded border border-current/20 bg-black/10 px-2 py-1 text-[11px] outline-none"
            aria-label="Dialog text effect"
          >
            {DIALOG_TEXT_EFFECTS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        {draft.trim() && effect !== "none" ? (
          <div className="rounded border border-current/15 bg-black/10 px-2 py-1.5 text-sm">
            <DialogTextEffectView
              text={draft.trim()}
              effect={effect}
              lineKey={line.id}
              replayKey={`${line.id}-${effect}-preview`}
              className="text-inherit"
            />
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <button
          type="button"
          onClick={() => onMoveLine(-1)}
          disabled={lineIndex === 0}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full opacity-80 hover:opacity-100 disabled:opacity-30"
          aria-label="Move line up"
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          onClick={() => onMoveLine(1)}
          disabled={lineIndex === totalLines - 1}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full opacity-80 hover:opacity-100 disabled:opacity-30"
          aria-label="Move line down"
        >
          <ChevronDown size={14} />
        </button>
        <button
          type="button"
          onClick={onRemoveLine}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full opacity-80 hover:opacity-100"
          aria-label="Remove line"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function ParticipantDialogCard({
  character,
  index,
  total,
  lines,
  onMoveParticipant,
  onAddLine,
  onMoveLine,
  onRemoveLine,
  onUpdateLine,
  onUpdateEffect,
}: {
  character: OrderedCharacter;
  index: number;
  total: number;
  lines: Array<{ id: string; text: string; textEffect?: DialogTextEffect }>;
  onMoveParticipant: (direction: -1 | 1) => void;
  onAddLine: (text: string) => void;
  onMoveLine: (lineId: string, direction: -1 | 1) => void;
  onRemoveLine: (lineId: string) => void;
  onUpdateLine: (lineId: string, text: string) => void;
  onUpdateEffect: (lineId: string, effect: DialogTextEffect) => void;
}) {
  const [draft, setDraft] = useState("");
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
        <div className="mb-3 space-y-2">
          {lines.map((line, lineIndex) => (
            <DialogLineEditor
              key={line.id}
              line={line}
              palette={palette}
              lineIndex={lineIndex}
              totalLines={lines.length}
              onMoveLine={(direction) => onMoveLine(line.id, direction)}
              onRemoveLine={() => onRemoveLine(line.id)}
              onUpdateLine={(text) => onUpdateLine(line.id, text)}
              onUpdateEffect={(effect) => onUpdateEffect(line.id, effect)}
            />
          ))}
        </div>
      ) : (
        <div className="mb-3 rounded-lg border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
          No lines yet.
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            const text = draft.trim();
            if (!text) return;
            onAddLine(text);
            setDraft("");
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
            setDraft("");
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

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void loadStorySceneCharacters(storyId)
      .then((characters) => {
        if (!cancelled) setSceneCharacters(characters);
      })
      .catch((error) => {
        logger.error("Failed to load scene characters", error);
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
    const fallbackOrder = sceneCharacters.map((character) => character.id);
    void loadMomentDialogScript(momentId, storyId, fallbackOrder)
      .then((loaded) => {
        if (!cancelled) setScript(loaded);
      })
      .catch((error) => {
        logger.error("Failed to load moment dialog", error);
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
      orderedCharactersFromScript(script, sceneCharacters).map((character) => {
        const scene = sceneCharacters.find((entry) => entry.id === character.id);
        return {
          id: character.id,
          name: character.name,
          role: scene?.role ?? "npc",
          roleLabel: scene?.roleLabel ?? character.roleLabel ?? "Character",
        } satisfies OrderedCharacter;
      }),
    [script, sceneCharacters],
  );

  const persistScript = useCallback(
    async (nextScript: MomentDialogScript) => {
      if (!momentId) return;
      setScript(nextScript);
      try {
        await saveMomentDialogScript(momentId, nextScript, storyId);
      } catch (error) {
        logger.error("Failed to save moment dialog", error);
      }
    },
    [momentId, storyId],
  );

  const moveCharacter = useCallback(
    (characterId: string, direction: -1 | 1) => {
      const currentOrder = orderedCharacters.map((character) => character.id);
      const nextOrder = moveCharacterInOrder(currentOrder, characterId, direction);
      void persistScript({ ...script, characterOrder: nextOrder });
    },
    [orderedCharacters, persistScript, script],
  );

  const addLine = useCallback(
    (character: OrderedCharacter, text: string) => {
      void persistScript(addLineForCharacter(script, character, text));
    },
    [persistScript, script],
  );

  const removeLine = useCallback(
    (lineId: string) => {
      void persistScript(removeLineFromScript(script, lineId));
    },
    [persistScript, script],
  );

  const updateLine = useCallback(
    (lineId: string, text: string) => {
      void persistScript(updateLineTextInScript(script, lineId, text));
    },
    [persistScript, script],
  );

  const updateLineEffect = useCallback(
    (lineId: string, textEffect: DialogTextEffect) => {
      void persistScript(updateLineEffectInScript(script, lineId, textEffect));
    },
    [persistScript, script],
  );

  const moveLine = useCallback(
    (characterId: string, lineId: string, direction: -1 | 1) => {
      void persistScript(moveLineForCharacter(script, characterId, lineId, direction));
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
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Dialog</DialogTitle>
          <DialogDescription id="moment-dialog-description">
            Reorder participants, add lines, and reorder lines in one place.
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
                  Top to bottom is speak order. Pick a text effect per line, then place bubbles on the scene.
                </p>
                {orderedCharacters.map((character, index) => (
                  <ParticipantDialogCard
                    key={character.id}
                    character={character}
                    index={index}
                    total={orderedCharacters.length}
                    lines={script.lines.filter((line) => line.characterId === character.id)}
                    onMoveParticipant={(direction) => moveCharacter(character.id, direction)}
                    onAddLine={(text) => addLine(character, text)}
                    onMoveLine={(lineId, direction) => moveLine(character.id, lineId, direction)}
                    onRemoveLine={removeLine}
                    onUpdateLine={updateLine}
                    onUpdateEffect={updateLineEffect}
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
