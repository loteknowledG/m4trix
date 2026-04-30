import StoryDetailClient from './story-detail-client';

export function generateStaticParams() {
  return [{ id: 'new' }];
}

export default function StoryDetailPage() {
  return <StoryDetailClient />;
}
