'use client';

import { ContentLayout } from '@/components/admin-panel/content-layout';
import ErrorBoundary from '@/components/error-boundary';
import GamesCarousel from '@/components/games-carousel';

export default function GamesPage() {
  return (
    <ContentLayout title="">
      <ErrorBoundary>
        <div className="flex justify-center items-start flex-1 w-full overflow-hidden">
          <div className="w-full max-w-4xl px-6 flex justify-center items-start h-full">
            <GamesCarousel />
          </div>
        </div>
      </ErrorBoundary>
    </ContentLayout>
  );
}
