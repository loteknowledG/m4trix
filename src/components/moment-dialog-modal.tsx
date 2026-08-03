'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CueTimeField } from '@/components/cue-time-field';
import VideoCueTimeline from '@/components/video-cue-timeline';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { DialogLineStyleEditor } from '@/components/dialog-line-style-editor';
import { VideoCueTextEffectView } from '@/components/text/video-cue-text-effect-view';
import { videoCueTextEffectsKey } from '@/lib/video-cue-text-effects';
import {
  buildCueTextShadow,
  commitCueEndTime,
  commitCueStartTime,
  formatCueTime,
  resolveVideoCueFontFamily,
} from '@/lib/video-timed-cues';
import { logger } from '@/lib/logger';
import {
  addLineForCharacter,
  clearLinePositionsInScript,
  computeMomentDialogDuration,
  dispatchMomentDialogUpdated,
  ensureCharacterPositions,
  ensureTimedDialogScript,
  loadMomentDialogScript,
  momentLinesToTimelineCues,
  orderedCharactersFromScript,
  removeLineFromScript,
  resolveCharacterPosition,
  resolveMomentDialogLineStyle,
  resolveMomentDialogSpeakerName,
  resolveMomentLineTiming,
  saveMomentDialogScript,
  updateCharacterPositionInScript,
  updateLineInScript,
  updateLineTimingInScript,
  type DialogSpeakerPosition,
  type MomentDialogLine,
  type MomentDialogScript,
} from '@/lib/moment-dialog';
import { loadStorySceneCharacters, type SceneCharacter } from '@/lib/scene-characters';
import { normalizePlayerMode, type PlayerMode } from '@/lib/player-mode';
import { cn } from '@/lib/utils';

type MomentDialogModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  momentId: string | null;
  storyId?: string | null;
  currentTime?: number;
  onCurrentTimeChange?: (time: number) => void;
  isPlaying?: boolean;
  onIsPlayingChange?: (playing: boolean) => void;
  editLineId?: string | null;
  onEditLineIdChange?: (lineId: string | null) => void;
  onStartPlacement?: () => void | Promise<void>;
};

type OrderedCharacter = SceneCharacter & { roleLabel: string };

function momentLineSummaryLabel(
  line: MomentDialogLine,
  characterName: string,
  index: number,
  sceneCharacters: SceneCharacter[] = [],
) {
  const speakerLabel =
    sceneCharacters.length > 0
      ? resolveMomentDialogSpeakerName(line, sceneCharacters)
      : characterName.trim();
  if (speakerLabel) return speakerLabel;
  const text = line.text.trim();
  if (text) return text.length > 28 ? `${text.slice(0, 28)}…` : text;
  return `Dialog ${index + 1}`;
}

function AddDialogBar({
  characters,
  onAdd,
  className,
}: {
  characters: OrderedCharacter[];
  onAdd: (character: OrderedCharacter) => void;
  className?: string;
}) {
  const [speakerId, setSpeakerId] = useState(characters[0]?.id ?? '');

  useEffect(() => {
    if (characters.some(character => character.id === speakerId)) return;
    setSpeakerId(characters[0]?.id ?? '');
  }, [characters, speakerId]);

  const handleAdd = () => {
    const character = characters.find(entry => entry.id === speakerId);
    if (character) onAdd(character);
  };

  if (!characters.length) return null;

  return (
    <div className={cn('flex items-end gap-2', className)}>
      <label className="grid min-w-0 flex-1 gap-1">
        <span className="text-[11px] text-muted-foreground">Speaker</span>
        <select
          value={speakerId}
          onChange={event => setSpeakerId(event.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Speaker for new dialog"
        >
          {characters.map(character => (
            <option key={character.id} value={character.id}>
              {character.name}
            </option>
          ))}
        </select>
      </label>
      <Button type="button" size="sm" variant="secondary" className="h-8 shrink-0" onClick={handleAdd}>
        Add
      </Button>
    </div>
  );
}

function SelectedMomentLineEditor({
  line,
  character,
  characters,
  speakerPosition,
  currentTime,
  lineIndex,
  onUpdate,
  onUpdateTiming,
  onSpeakerChange,
  onPlayerModeChange,
  onPositionChange,
  onRemove,
}: {
  line: MomentDialogLine;
  character: OrderedCharacter;
  characters: OrderedCharacter[];
  speakerPosition: DialogSpeakerPosition;
  currentTime?: number;
  lineIndex: number;
  onUpdate: (patch: Partial<MomentDialogLine>) => void;
  onUpdateTiming: (patch: { start?: number; end?: number }) => void;
  onSpeakerChange: (character: OrderedCharacter) => void;
  onPlayerModeChange: (mode: PlayerMode) => void;
  onPositionChange: (position: DialogSpeakerPosition) => void;
  onRemove: () => void;
}) {
  const style = resolveMomentDialogLineStyle(line);
  const timing = resolveMomentLineTiming(line);

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3 ring-1 ring-primary/20">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">
            {momentLineSummaryLabel(line, character.name, lineIndex, characters)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {character.roleLabel} ·{' '}
            <span className="font-mono tabular-nums">
              {formatCueTime(timing.start)} – {formatCueTime(timing.end)}
            </span>
          </div>
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

      <label className="grid gap-1">
        <span className="text-[11px] text-muted-foreground">Speaker</span>
        <select
          value={line.characterId}
          onChange={event => {
            const next = characters.find(entry => entry.id === event.target.value);
            if (next) onSpeakerChange(next);
          }}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Dialog speaker"
        >
          {characters.map(entry => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      </label>

      {character.role === 'player' || character.role === 'npc' ? (
        <label className="grid gap-1">
          <span className="text-[11px] text-muted-foreground">
            {character.role === 'player' ? 'Player type' : 'AI type'}
          </span>
          <select
            value={line.playerMode ?? 'say'}
            onChange={event => onPlayerModeChange(normalizePlayerMode(event.target.value))}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            aria-label={
              character.role === 'player' ? 'Player dialog type' : 'AI dialog type'
            }
          >
            <option value="say">Say</option>
            <option value="do">Do</option>
            <option value="think">Think</option>
          </select>
        </label>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <CueTimeField
          fieldId={`${line.id}-start`}
          label="Start"
          value={timing.start}
          currentTime={currentTime}
          onCommit={start => {
            onUpdateTiming(commitCueStartTime(start, timing.end));
          }}
        />
        <CueTimeField
          fieldId={`${line.id}-end`}
          label="End"
          value={timing.end}
          currentTime={currentTime}
          onCommit={end => {
            onUpdateTiming(commitCueEndTime(timing.start, end));
          }}
        />
      </div>

      <label className="grid gap-1">
        <span className="text-[11px] text-muted-foreground">Scene position</span>
        <select
          value={speakerPosition}
          onChange={event =>
            onPositionChange(event.target.value as DialogSpeakerPosition)
          }
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
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

      <Textarea
        value={line.text}
        onChange={event => onUpdate({ text: event.target.value })}
        placeholder="Dialog text"
        rows={3}
        className="resize-y text-xs"
      />

      <DialogLineStyleEditor
        values={{
          textEffects: style.textEffects,
          font: style.font,
          fontScale: style.fontScale,
          color: style.color,
          shadowColor: style.shadowColor,
          speakerColor: style.speakerColor,
        }}
        onChange={onUpdate}
      />

      {line.text.trim() ? (
        <div
          className="rounded-lg px-3 py-2 text-sm whitespace-pre-wrap"
          style={{
            color: style.color,
            textShadow: buildCueTextShadow(style.shadowColor),
            fontFamily: resolveVideoCueFontFamily(style.font),
            fontSize: `${Math.max(0.75, style.fontScale * 18)}rem`,
          }}
        >
          <VideoCueTextEffectView
            text={line.text}
            effects={style.textEffects}
            color={style.color}
            shadowColor={style.shadowColor}
            lineKey={line.id}
            replayKey={`${line.id}-${videoCueTextEffectsKey(style.textEffects)}-preview`}
            className="text-inherit"
          />
        </div>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        Drag the highlighted dialog on the moment to move it · use the corner handle to resize.
      </p>
    </div>
  );
}

export function MomentDialogModal({
  open,
  onOpenChange,
  momentId,
  storyId,
  currentTime = 0,
  onCurrentTimeChange,
  isPlaying = false,
  onIsPlayingChange,
  editLineId = null,
  onEditLineIdChange,
  onStartPlacement,
}: MomentDialogModalProps) {
  const [script, setScript] = useState<MomentDialogScript>({ characterOrder: [], lines: [] });
  const [sceneCharacters, setSceneCharacters] = useState<SceneCharacter[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const initialLoadDoneRef = useRef(false);
  const lastSeekLineRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      initialLoadDoneRef.current = false;
      setSelectedLineId(null);
      onEditLineIdChange?.(null);
      onIsPlayingChange?.(false);
    }
  }, [open, onEditLineIdChange, onIsPlayingChange]);

  useEffect(() => {
    onEditLineIdChange?.(selectedLineId);
  }, [onEditLineIdChange, selectedLineId]);

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
    initialLoadDoneRef.current = false;
  }, [momentId]);

  useEffect(() => {
    if (!open || !momentId) return;
    if (storyId && sceneCharacters.length === 0) return;
    if (initialLoadDoneRef.current) return;

    initialLoadDoneRef.current = true;
    let cancelled = false;
    setLoading(true);
    const fallbackOrder = sceneCharacters.map(character => character.id);
    void loadMomentDialogScript(momentId, storyId, fallbackOrder)
      .then(loaded => {
        if (!cancelled) {
          const next = ensureTimedDialogScript(
            ensureCharacterPositions(loaded, sceneCharacters),
            sceneCharacters,
          );
          setScript(next);
          setSelectedLineId(prev => {
            if (prev && next.lines.some(line => line.id === prev)) return prev;
            const first = [...next.lines].sort(
              (a, b) => resolveMomentLineTiming(a).start - resolveMomentLineTiming(b).start,
            )[0];
            return first?.id ?? null;
          });
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

  const characterById = useMemo(
    () => new Map(orderedCharacters.map(character => [character.id, character])),
    [orderedCharacters],
  );

  const sortedLines = useMemo(
    () =>
      [...script.lines].sort(
        (a, b) => resolveMomentLineTiming(a).start - resolveMomentLineTiming(b).start,
      ),
    [script.lines],
  );

  const selectedLine = useMemo(
    () => script.lines.find(line => line.id === selectedLineId) ?? null,
    [script.lines, selectedLineId],
  );

  const selectedCharacter = useMemo(() => {
    if (!selectedLine) return null;
    return characterById.get(selectedLine.characterId) ?? null;
  }, [characterById, selectedLine]);

  const selectedLineIndex = selectedLine
    ? sortedLines.findIndex(line => line.id === selectedLine.id)
    : -1;

  const persistScript = useCallback(
    (
      updater:
        | MomentDialogScript
        | ((current: MomentDialogScript) => MomentDialogScript),
    ) => {
      if (!momentId) return;
      setScript(current => {
        const nextScript = typeof updater === 'function' ? updater(current) : updater;
        void queueMicrotask(() => {
          dispatchMomentDialogUpdated({ momentId, storyId, script: nextScript });
        });
        void saveMomentDialogScript(momentId, nextScript, storyId).catch(error => {
          logger.error('Failed to save moment dialog', error);
        });
        return nextScript;
      });
    },
    [momentId, storyId],
  );

  const addLine = useCallback(
    (character: OrderedCharacter) => {
      persistScript(current => {
        const nextScript = addLineForCharacter(current, character);
        const added = nextScript.lines[nextScript.lines.length - 1];
        if (added?.id) {
          lastSeekLineRef.current = null;
          setSelectedLineId(added.id);
        }
        return nextScript;
      });
    },
    [persistScript],
  );

  const removeLine = useCallback(
    (lineId: string) => {
      persistScript(current => removeLineFromScript(current, lineId));
      setSelectedLineId(prev => {
        if (prev !== lineId) return prev;
        const remaining = sortedLines.filter(line => line.id !== lineId);
        return remaining[0]?.id ?? null;
      });
    },
    [persistScript, sortedLines],
  );

  const updateLine = useCallback(
    (lineId: string, patch: Partial<MomentDialogLine>) => {
      persistScript(current => updateLineInScript(current, lineId, patch));
    },
    [persistScript],
  );

  const updateLineTiming = useCallback(
    (lineId: string, patch: { start?: number; end?: number }) => {
      persistScript(current => updateLineTimingInScript(current, lineId, patch));
    },
    [persistScript],
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
      persistScript(current =>
        updateCharacterPositionInScript(current, characterId, validPosition),
      );
    },
    [persistScript],
  );

  const changeLineSpeaker = useCallback(
    (lineId: string, character: OrderedCharacter) => {
      persistScript(current => {
        const patch: Partial<MomentDialogLine> = {
          characterId: character.id,
          speaker: character.name,
        };
        if (character.role === 'player' || character.role === 'npc') {
          patch.playerMode =
            current.lines.find(entry => entry.id === lineId)?.playerMode ?? 'say';
        } else {
          patch.playerMode = undefined;
        }
        return updateLineInScript(current, lineId, patch);
      });
    },
    [persistScript],
  );

  const changeLinePlayerMode = useCallback(
    (lineId: string, playerMode: PlayerMode) => {
      persistScript(current => updateLineInScript(current, lineId, { playerMode }));
    },
    [persistScript],
  );

  const timelineCues = useMemo(
    () => momentLinesToTimelineCues(script, orderedCharacters),
    [orderedCharacters, script],
  );

  const sceneDuration = useMemo(() => computeMomentDialogDuration(script), [script]);

  const handleTimelineSeek = useCallback(
    (time: number) => {
      onCurrentTimeChange?.(time);
      onIsPlayingChange?.(false);
    },
    [onCurrentTimeChange, onIsPlayingChange],
  );

  const handleCueTimingChange = useCallback(
    (lineId: string, patch: { start?: number; end?: number }) => {
      updateLineTiming(lineId, patch);
    },
    [updateLineTiming],
  );

  const resetLayout = useCallback(() => {
    persistScript(current => clearLinePositionsInScript(current));
  }, [persistScript]);

  const selectLine = useCallback(
    (lineId: string | null) => {
      if (lineId) lastSeekLineRef.current = null;
      setSelectedLineId(lineId);
      if (!lineId) return;
      const line = script.lines.find(entry => entry.id === lineId);
      if (!line) return;
      lastSeekLineRef.current = lineId;
      onCurrentTimeChange?.(resolveMomentLineTiming(line).start);
      onIsPlayingChange?.(false);
    },
    [onCurrentTimeChange, onIsPlayingChange, script.lines],
  );

  useEffect(() => {
    if (!open) {
      lastSeekLineRef.current = null;
      return;
    }
    if (!selectedLineId || lastSeekLineRef.current === selectedLineId) return;
    lastSeekLineRef.current = selectedLineId;
    const line = script.lines.find(entry => entry.id === selectedLineId);
    if (!line) return;
    onCurrentTimeChange?.(resolveMomentLineTiming(line).start);
    onIsPlayingChange?.(false);
  }, [open, onCurrentTimeChange, onIsPlayingChange, script.lines, selectedLineId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-y-0 right-0 z-[1300] flex w-[min(100vw,26rem)] max-w-full flex-col border-l border-border/60 bg-background shadow-2xl"
      role="dialog"
      aria-labelledby="moment-dialog-title"
      aria-describedby="moment-dialog-description"
      onClick={event => event.stopPropagation()}
      onPointerDown={event => event.stopPropagation()}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <h3 id="moment-dialog-title" className="text-sm font-medium">
              Dialog
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-transparent text-foreground hover:bg-accent/20"
            aria-label="Close dialog editor"
          >
            ×
          </button>
        </div>
        <p id="moment-dialog-description" className="sr-only">
          Add dialogs by speaker, edit one at a time on the timeline, then drag the highlighted
          bubble on the moment to reposition it.
        </p>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="rounded border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                Loading dialog…
              </div>
            ) : orderedCharacters.length ? (
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium">Timed dialogs</div>
                  <div className="text-xs text-muted-foreground">
                    Pick a speaker and click Add, then select a block on the timeline to edit
                  </div>
                </div>

                <AddDialogBar characters={orderedCharacters} onAdd={addLine} />

                {sortedLines.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No dialogs yet. Choose Player, AI character, or Narrator above, then click Add.
                  </p>
                ) : (
                  <>
                    <ul className="flex flex-wrap gap-1.5">
                      {sortedLines.map((line, index) => {
                        const character = characterById.get(line.characterId);
                        const characterName = character?.name ?? line.speaker;
                        const selected = selectedLineId === line.id;
                        const timing = resolveMomentLineTiming(line);
                        return (
                          <li key={line.id}>
                            <button
                              type="button"
                              onClick={() => selectLine(line.id)}
                              className={cn(
                                'max-w-full rounded-md border px-2 py-1 text-left text-[11px] transition-colors',
                                selected
                                  ? 'border-primary bg-primary/15 text-foreground ring-1 ring-primary/30'
                                  : 'border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                              )}
                              title={`${momentLineSummaryLabel(line, characterName, index, orderedCharacters)} (${formatCueTime(timing.start)}–${formatCueTime(timing.end)})`}
                            >
                              <span className="block truncate font-medium">
                                {momentLineSummaryLabel(line, characterName, index, orderedCharacters)}
                              </span>
                              <span className="block font-mono tabular-nums opacity-80">
                                {formatCueTime(timing.start)}–{formatCueTime(timing.end)}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>

                    {selectedLine && selectedCharacter ? (
                      <SelectedMomentLineEditor
                        key={selectedLine.id}
                        line={selectedLine}
                        character={selectedCharacter}
                        characters={orderedCharacters}
                        speakerPosition={resolveCharacterPosition(
                          script,
                          selectedCharacter.id,
                          selectedCharacter.role,
                        )}
                        lineIndex={selectedLineIndex}
                        currentTime={currentTime}
                        onUpdate={patch => updateLine(selectedLine.id, patch)}
                        onUpdateTiming={patch => updateLineTiming(selectedLine.id, patch)}
                        onSpeakerChange={character =>
                          changeLineSpeaker(selectedLine.id, character)
                        }
                        onPlayerModeChange={mode =>
                          changeLinePlayerMode(selectedLine.id, mode)
                        }
                        onPositionChange={position =>
                          updateCharacterPosition(
                            selectedCharacter.id,
                            selectedCharacter.role,
                            position,
                          )
                        }
                        onRemove={() => removeLine(selectedLine.id)}
                      />
                    ) : (
                      <p className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                        Select a dialog on the timeline or pick a chip above to edit its settings.
                      </p>
                    )}
                  </>
                )}
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

          {orderedCharacters.length > 0 ? (
            <div className="shrink-0 space-y-2 border-t border-border/60 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  Timeline · {Math.floor(currentTime)}s / {sceneDuration}s
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      onCurrentTimeChange?.(0);
                      onIsPlayingChange?.(false);
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={isPlaying ? 'secondary' : 'default'}
                    className="h-7 px-2 text-xs"
                    onClick={() => onIsPlayingChange?.(!isPlaying)}
                  >
                    {isPlaying ? 'Pause' : 'Play'}
                  </Button>
                </div>
              </div>
              <VideoCueTimeline
                cues={timelineCues}
                selectedCueId={selectedLineId}
                currentTime={currentTime}
                videoDuration={sceneDuration}
                onSelectCue={lineId => selectLine(lineId)}
                onCueTimingChange={handleCueTimingChange}
                onSeek={handleTimelineSeek}
                onScrubStart={() => onIsPlayingChange?.(false)}
                groupBySpeaker
              />
              {sortedLines.length === 0 ? (
                <p className="text-center text-[11px] text-muted-foreground">
                  New dialogs appear here after you click Add.
                </p>
              ) : null}
            </div>
          ) : null}

          {sortedLines.length > 0 ? (
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
                  className="rounded px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/20"
                >
                  Seed positions
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
