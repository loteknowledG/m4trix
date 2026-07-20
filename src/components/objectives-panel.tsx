'use client';

import type { CheckpointObjective } from '@/lib/game/objectives';
import { cn } from '@/lib/utils';

interface ObjectivesPanelProps {
  objectives: CheckpointObjective[];
  className?: string;
}

export function ObjectivesPanel({ objectives, className }: ObjectivesPanelProps) {
  const completedCount = objectives.filter((o) => o.completed).length;
  const totalCount = objectives.length;

  return (
    <div className={cn('flex flex-col gap-2 p-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide">Objectives</h3>
        <span className="text-xs text-muted-foreground">
          {completedCount}/{totalCount}
        </span>
      </div>

      {objectives.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No objectives for this stage.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {objectives.map((objective) => (
            <li
              key={objective.id}
              className={cn(
                'flex items-start gap-2 rounded p-2 text-xs transition-colors',
                objective.completed
                  ? 'bg-green-500/20 text-green-700 dark:text-green-400'
                  : 'bg-accent/50',
              )}
            >
              <span className="mt-0.5 text-primary">
                {objective.completed ? (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                )}
              </span>
              <span className={cn(objective.completed && 'line-through opacity-70')}>
                {objective.description}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface ObjectiveToastProps {
  message: string;
  visible: boolean;
}

export function ObjectiveToast({ message, visible }: ObjectiveToastProps) {
  return (
    <div
      className={cn(
        'pointer-events-none fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-all duration-300',
        visible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-4 opacity-0',
      )}
    >
      {message}
    </div>
  );
}