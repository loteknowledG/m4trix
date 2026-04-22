'use client';

import { cn } from '@/lib/utils';

type DescriptionEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
};

export function DescriptionEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  className,
}: DescriptionEditorProps) {
  return (
    <textarea
      value={value}
      onChange={event => onChange(event.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      aria-label="Description"
      rows={6}
      className={cn(
        'w-full min-h-[120px] resize-y rounded border border-zinc-700 bg-transparent px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-zinc-500 focus:border-primary',
        className
      )}
    />
  );
}
