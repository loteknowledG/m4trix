import CharacterDetailClient from './character-detail-client';

/** Required for `output: "export"` — client-only routes still need a build-time param. */
export function generateStaticParams() {
  return [{ id: 'new' }];
}

export default function CharacterDetailPage() {
  return <CharacterDetailClient />;
}
