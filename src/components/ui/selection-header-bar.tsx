import { ReactNode } from "react";
import { Circle, CheckCircle, X } from "lucide-react";

interface SelectionHeaderBarProps {
  selectedIds: string[];
  moments: { id: string }[];
  onSelectAll: () => void;
  onClearSelection: () => void;
  showSelectAll?: boolean;
}

export function SelectionHeaderBar({ selectedIds, moments, onSelectAll, onClearSelection, showSelectAll }: SelectionHeaderBarProps) {
  const shouldShowSelectAll = showSelectAll ?? true;
  return (
    <div className="flex items-center gap-2 justify-start">
      <button
        onClick={onClearSelection}
        className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
        aria-label="Clear selection"
        disabled={selectedIds.length === 0}
      >
        <X size={16} />
      </button>
      {shouldShowSelectAll && (
        <button
          onClick={onSelectAll}
          className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
          aria-label="Select all"
          disabled={moments.length === 0}
        >
          <span className="relative w-7 h-7 flex items-center justify-center">
            {selectedIds.length === moments.length && moments.length > 0 ? (
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground">
                <CheckCircle size={14} />
              </span>
            ) : (
              <Circle size={18} className="text-white/70" />
            )}
          </span>
        </button>
      )}
      <span className="text-sm font-medium">{selectedIds.length} selected</span>
    </div>
  );
}
