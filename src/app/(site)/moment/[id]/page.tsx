import MomentDetailClient from './moment-detail-client';

export function generateStaticParams() {
  return [{ id: 'new' }];
}

export default function MomentDetailPage() {
  return <MomentDetailClient />;
}
