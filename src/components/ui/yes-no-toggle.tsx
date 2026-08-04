'use client';

import { cn } from '@/lib/utils';

type YesNoToggleProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  ariaLabel: string;
  className?: string;
};

export function YesNoToggle({ value, onChange, ariaLabel, className }: YesNoToggleProps) {
  return (
    <div
      className={cn('m4-experience-toggle m4-yes-no-toggle', className)}
      role="group"
      aria-label={ariaLabel}
    >
      <span
        className="m4-experience-toggle-thumb"
        data-mode={value ? 'yes' : 'no'}
        aria-hidden="true"
      />
      <button
        type="button"
        className="m4-experience-toggle-btn"
        data-active={value}
        aria-pressed={value}
        onClick={() => onChange(true)}
      >
        Yes
      </button>
      <button
        type="button"
        className="m4-experience-toggle-btn"
        data-active={!value}
        aria-pressed={!value}
        onClick={() => onChange(false)}
      >
        No
      </button>
    </div>
  );
}
