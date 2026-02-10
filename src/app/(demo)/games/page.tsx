'use client';

import { ContentLayout } from '@/components/admin-panel/content-layout';
import ErrorBoundary from '@/components/error-boundary';
import GamesCarousel from '@/components/games-carousel';

export default function GamesPage() {
  return (
    <ContentLayout title="">
      <ErrorBoundary>
        <div className="flex justify-center items-center h-full w-full">
          <div className="w-full max-w-4xl px-6">
            <GamesCarousel />
          </div>
        </div>
      </ErrorBoundary>
    </ContentLayout>
  );
}
