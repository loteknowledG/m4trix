import PlaylistDetailClient from './playlist-detail-client';

export function generateStaticParams() {
  return [{ id: 'new' }];
}

export default function PlaylistDetailPage() {
  return <PlaylistDetailClient />;
}
