'use client';

import React from 'react';
import { ContentLayout } from '@/components/admin-panel/content-layout';
import ErrorBoundary from '@/components/error-boundary';
import GamesCarousel from '@/components/games-carousel';

export default function GamesPage() {
  const [title, setTitle] = React.useState('Games');

  return (
    <ContentLayout title={title} titleMarquee>
      <ErrorBoundary>
        <div className="flex justify-center items-start flex-1 w-full overflow-hidden">
          <div className="w-full max-w-4xl px-6 flex justify-center items-start h-full">
            <GamesCarousel onTitleChange={setTitle} />
          </div>
        </div>
      </ErrorBoundary>
    </ContentLayout>
  );
}
