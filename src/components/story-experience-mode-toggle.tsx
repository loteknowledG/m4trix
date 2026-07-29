'use client';

import { cn } from '@/lib/utils';

export type StoryExperienceMode = 'view' | 'edit';

type StoryExperienceModeToggleProps = {
  mode: StoryExperienceMode;
  onModeChange: (mode: StoryExperienceMode) => void;
  className?: string;
};

export default function StoryExperienceModeToggle({
  mode,
  onModeChange,
  className,
}: StoryExperienceModeToggleProps) {
  const isEditMode = mode === 'edit';

  return (
    <div
      className={cn('m4-experience-toggle', className)}
      role="group"
      aria-label="Story experience mode"
    >
      <span
        className="m4-experience-toggle-thumb"
        data-mode={mode}
        aria-hidden="true"
      />
      <button
        type="button"
        className="m4-experience-toggle-btn"
        data-active={!isEditMode}
        aria-pressed={!isEditMode}
        onClick={() => onModeChange('view')}
      >
        View
      </button>
      <button
        type="button"
        className="m4-experience-toggle-btn"
        data-active={isEditMode}
        aria-pressed={isEditMode}
        onClick={() => onModeChange('edit')}
      >
        Edit
      </button>
    </div>
  );
}
