import dynamic from 'next/dynamic';

const GameDetailClient = dynamic(() => import('./game-detail-client'), {
  loading: () => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950 text-zinc-300">
      <div className="text-sm">Loading game…</div>
    </div>
  ),
});

export function generateStaticParams() {
  return [{ id: 'new' }];
}

export default function GameDetailPage() {
  return <GameDetailClient />;
}
