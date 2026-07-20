import GameDetailClient from './game-detail-client';

export function generateStaticParams() {
  return [{ id: 'new' }];
}

export default function GameDetailPage() {
  return <GameDetailClient />;
}
