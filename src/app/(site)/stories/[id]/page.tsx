import StoryDetailClient from './story-detail-client';

export function generateStaticParams() {
  return [{ id: 'edit' }];
}

export default function StoryDetailPage() {
  return <StoryDetailClient />;
}
