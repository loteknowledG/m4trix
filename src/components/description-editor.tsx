'use client';

import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { getImageFileFromPasteEvent } from '@/lib/clipboard-image';
import { toast } from 'sonner';

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
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const file = getImageFileFromPasteEvent(e);
      if (!file) return;

      e.preventDefault();

      const reader = new FileReader();
      reader.onload = event => {
        const dataUrl = event.target?.result as string;
        const imgTag = `\n<img src="${dataUrl}" alt="Pasted image" style="max-width:100%;border-radius:8px;" />\n`;
        const newValue = value + imgTag;
        onChange(newValue);
        toast.success('Image pasted into description.');
      };
      reader.readAsDataURL(file);
    },
    [value, onChange]
  );

  return (
    <textarea
      value={value}
      onChange={event => onChange(event.target.value)}
      onBlur={onBlur}
      onPaste={handlePaste}
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
