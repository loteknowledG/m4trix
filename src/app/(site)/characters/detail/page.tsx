import { Suspense } from 'react';
import CharacterDetailClient from './character-detail-client';

export default function CharacterDetailPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading character…</p>}>
      <CharacterDetailClient />
    </Suspense>
  );
}
