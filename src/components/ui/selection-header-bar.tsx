import { ReactNode } from "react";
import { Circle, CheckCircle } from "lucide-react";

interface SelectionHeaderBarProps {
  selectedIds: string[];
  moments: { id: string }[];
  onSelectAll: () => void;
  onClearSelection: () => void;
  showSelectAll?: boolean;
  actions?: ReactNode;
  actionsClassName?: string;
}

export function SelectionHeaderBar({ selectedIds, moments, onSelectAll, onClearSelection, showSelectAll, actions, actionsClassName }: SelectionHeaderBarProps) {
  const shouldShowSelectAll = showSelectAll ?? (selectedIds.length > 0);
  return (
    <div className="flex items-center w-full justify-between">
      <div className="flex items-center gap-2 flex-grow">
        {shouldShowSelectAll && (
          <button
            onClick={() => {
              if (selectedIds.length === moments.length && moments.length > 0) {
                onClearSelection();
              } else {
                onSelectAll();
              }
            }}
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
        {selectedIds.length > 0 && (
          <span className="text-sm font-medium">{selectedIds.length} selected</span>
        )}
      </div>
      {actions && (
        <div className={`flex items-center gap-2 ${actionsClassName || 'justify-end'}`}>
          {actions}
        </div>
      )}
    </div>
  );
}
