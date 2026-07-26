import { redirect } from 'next/navigation';

/** Required for `output: "export"` — client-only routes still need a build-time param. */
export function generateStaticParams() {
  return [{ id: 'new' }];
}

type PageProps = {
  params: Promise<{ id: string }>;
};

/** Legacy `/characters/:id` bookmarks → static-export-safe detail route. */
export default async function LegacyCharacterDetailPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/characters/detail?id=${encodeURIComponent(id)}`);
}
