'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2 } from '@/components/icons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  addStoryArcStage,
  createEmptyStoryArc,
  createStoryArcTodo,
  getStageTodos,
  removeStoryArcStage,
  updateStoryArcStage,
  type StoryArc,
  type StoryArcStage,
  type StoryArcTodoItem,
} from '@/lib/game/story-arc';
import { getStagePalette } from '@/lib/game/story-arc-palettes';
import { cn } from '@/lib/utils';

type StoryArcEditorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storyId: string;
  storyTitle: string;
  storyArc: StoryArc | null;
  onSave: (arc: StoryArc | null) => Promise<void>;
};

function cloneArc(arc: StoryArc | null, storyId: string, storyTitle: string): StoryArc {
  if (arc) {
    return JSON.parse(JSON.stringify(arc)) as StoryArc;
  }
  return createEmptyStoryArc(storyId, storyTitle);
}

export function StoryArcEditor({
  open,
  onOpenChange,
  storyId,
  storyTitle,
  storyArc,
  onSave,
}: StoryArcEditorProps) {
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<StoryArc>(() => cloneArc(storyArc, storyId, storyTitle));
  const [newTodoTextByStage, setNewTodoTextByStage] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(cloneArc(storyArc, storyId, storyTitle));
    setNewTodoTextByStage({});
    setError(null);
  }, [open, storyArc, storyId, storyTitle]);

  const sortedStages = useMemo(
    () => [...draft.stages].sort((a, b) => a.stageNumber - b.stageNumber),
    [draft.stages],
  );

  const persistDraft = async (next: StoryArc) => {
    setDraft(next);
    setSaving(true);
    setError(null);
    try {
      await onSave(next.stages.length ? next : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save story arc.');
    } finally {
      setSaving(false);
    }
  };

  const updateStage = (stageNumber: number, patch: Partial<StoryArcStage>) => {
    const stage = draft.stages.find((item) => item.stageNumber === stageNumber);
    if (!stage) return;
    const nextStage = { ...stage, ...patch };
    void persistDraft(updateStoryArcStage(draft, nextStage));
  };

  const addTodo = (stageNumber: number) => {
    const text = (newTodoTextByStage[stageNumber] || '').trim();
    if (!text) return;
    const stage = draft.stages.find((item) => item.stageNumber === stageNumber);
    if (!stage) return;
    const todos = [...getStageTodos(stage), createStoryArcTodo(text)];
    updateStage(stageNumber, { todos });
    setNewTodoTextByStage((prev) => ({ ...prev, [stageNumber]: '' }));
  };

  const removeTodo = (stageNumber: number, todoId: string) => {
    const stage = draft.stages.find((item) => item.stageNumber === stageNumber);
    if (!stage) return;
    const todos = getStageTodos(stage).filter((todo) => todo.id !== todoId);
    updateStage(stageNumber, { todos });
  };

  const updateTodoText = (stageNumber: number, todoId: string, text: string) => {
    const stage = draft.stages.find((item) => item.stageNumber === stageNumber);
    if (!stage) return;
    const todos = getStageTodos(stage).map((todo) =>
      todo.id === todoId ? { ...todo, text } : todo,
    );
    updateStage(stageNumber, { todos });
  };

  const totalTodos = sortedStages.reduce((sum, stage) => sum + getStageTodos(stage).length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl overflow-hidden p-0"
        aria-describedby="story-arc-editor-description"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Story arc</DialogTitle>
          <DialogDescription id="story-arc-editor-description">
            Build stages and todo goals for narrator tracking during play.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[85vh] min-h-0 flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
            <div>
              <h3 className="text-sm font-medium">Story arc</h3>
              <p className="text-[11px] text-muted-foreground">
                {sortedStages.length} stage{sortedStages.length === 1 ? '' : 's'} · {totalTodos}{' '}
                todo{totalTodos === 1 ? '' : 's'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent/20"
              aria-label="Close story arc editor"
            >
              ×
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {sortedStages.length === 0 ? (
              <div className="rounded border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                No stages yet. Add a stage and give it todo goals the narrator will track in play.
              </div>
            ) : (
              sortedStages.map((stage, index) => {
                const palette = getStagePalette(index);
                const todos = getStageTodos(stage);
                return (
                  <div
                    key={stage.stageNumber}
                    className="overflow-hidden rounded-lg border border-border/70"
                  >
                    <div
                      className="flex items-center justify-between gap-2 px-3 py-2"
                      style={{ backgroundColor: palette.bg, color: palette.fg }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-80">
                          Stage {stage.stageNumber}
                        </div>
                        <input
                          value={stage.stageName}
                          onChange={(e) =>
                            setDraft((prev) =>
                              updateStoryArcStage(prev, { ...stage, stageName: e.target.value }),
                            )
                          }
                          onBlur={() => updateStage(stage.stageNumber, { stageName: stage.stageName })}
                          placeholder={`Stage ${stage.stageNumber}`}
                          className="mt-0.5 w-full bg-transparent text-sm font-semibold outline-none placeholder:opacity-60"
                          style={{ color: palette.fg }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => void persistDraft(removeStoryArcStage(draft, stage.stageNumber))}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-black/10"
                        aria-label={`Remove stage ${stage.stageNumber}`}
                        style={{ color: palette.fg }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-3 bg-background p-3">
                      <textarea
                        value={stage.shortDescription}
                        onChange={(e) =>
                          setDraft((prev) =>
                            updateStoryArcStage(prev, {
                              ...stage,
                              shortDescription: e.target.value,
                            }),
                          )
                        }
                        onBlur={() =>
                          updateStage(stage.stageNumber, { shortDescription: stage.shortDescription })
                        }
                        rows={2}
                        placeholder="Optional stage summary for the narrator"
                        className="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                      />

                      <div className="space-y-2">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Todo goals
                        </div>
                        {todos.length === 0 ? (
                          <p className="text-xs italic text-muted-foreground">
                            Add todo items the narrator marks complete during play.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {todos.map((todo: StoryArcTodoItem) => (
                              <li key={todo.id} className="flex items-start gap-2">
                                <input
                                  value={todo.text}
                                  onChange={(e) =>
                                    setDraft((prev) => {
                                      const current = prev.stages.find(
                                        (item) => item.stageNumber === stage.stageNumber,
                                      );
                                      if (!current) return prev;
                                      const nextTodos = getStageTodos(current).map((item) =>
                                        item.id === todo.id
                                          ? { ...item, text: e.target.value }
                                          : item,
                                      );
                                      return updateStoryArcStage(prev, {
                                        ...current,
                                        todos: nextTodos,
                                      });
                                    })
                                  }
                                  onBlur={() => updateTodoText(stage.stageNumber, todo.id, todo.text)}
                                  className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeTodo(stage.stageNumber, todo.id)}
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded hover:bg-accent/30"
                                  aria-label="Remove todo"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="flex gap-2">
                          <input
                            value={newTodoTextByStage[stage.stageNumber] || ''}
                            onChange={(e) =>
                              setNewTodoTextByStage((prev) => ({
                                ...prev,
                                [stage.stageNumber]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addTodo(stage.stageNumber);
                              }
                            }}
                            placeholder="New todo goal"
                            className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                          />
                          <button
                            type="button"
                            onClick={() => addTodo(stage.stageNumber)}
                            className="rounded border border-border px-3 py-1.5 text-xs hover:bg-accent/30"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void persistDraft(addStoryArcStage(draft))}
                className="rounded border border-border px-3 py-1.5 text-xs hover:bg-accent/30"
              >
                Add stage
              </button>
              <input
                ref={uploadInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    try {
                      const parsed = JSON.parse(String(reader.result || '')) as StoryArc;
                      void persistDraft(parsed);
                    } catch {
                      setError('Invalid story arc JSON file.');
                    }
                  };
                  reader.readAsText(file);
                  e.currentTarget.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="rounded border border-border px-3 py-1.5 text-xs hover:bg-accent/30"
              >
                Import JSON
              </button>
              {draft.stages.length ? (
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(draft, null, 2)], {
                      type: 'application/json',
                    });
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = `${draft.id || 'story-arc'}.json`;
                    anchor.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="rounded border border-border px-3 py-1.5 text-xs hover:bg-accent/30"
                >
                  Export JSON
                </button>
              ) : null}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {saving ? 'Saving…' : 'Saved locally'}
            </div>
          </div>

          {error ? <div className="px-4 pb-3 text-xs text-destructive">{error}</div> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
