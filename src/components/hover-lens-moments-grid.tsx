'use client';

import MomentCard from '@/components/moment-card';

type Moment = {
  id: string;
  src: string;
  name?: string;
  selected?: boolean;
};

interface HoverLensMomentsGridProps {
  moments: Moment[];
  selectedIds?: string[];
  toggleSelect: (id: string) => void;
  onOpen?: (item: Moment) => void;
}

export default function HoverLensMomentsGrid({
  moments,
  selectedIds = [],
  toggleSelect,
  onOpen,
}: HoverLensMomentsGridProps) {
  if (!moments || moments.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {moments.map(moment => (
        <MomentCard
          key={moment.id}
          item={{ ...moment, selected: selectedIds.includes(moment.id) }}
          anySelected={selectedIds.length > 0}
          toggleSelect={toggleSelect}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
