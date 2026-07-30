import { Navbar } from '@/components/admin-panel/navbar';
import type { ReactNode } from 'react';

interface ContentLayoutProps {
  title: ReactNode;
  titleMarquee?: boolean;
  children: ReactNode;
  navLeft?: ReactNode;
  navRight?: ReactNode;
  /** Drop container padding so content can fill the viewport (e.g. story view mode). */
  fullBleed?: boolean;
}

export function ContentLayout({
  title,
  titleMarquee,
  children,
  navLeft,
  navRight,
  fullBleed = false,
}: ContentLayoutProps) {
  return (
    <div className="flex flex-col min-h-0 h-full w-full">
      <Navbar title={title} titleMarquee={titleMarquee} leftSlot={navLeft} navRight={navRight} />
      <div
        className={
          fullBleed
            ? 'flex flex-1 min-h-0 h-full w-full flex-col'
            : 'container flex-1 min-h-0 h-full pt-8 pb-8 px-4 sm:px-8 flex flex-col'
        }
      >
        {children}
      </div>
    </div>
  );
}
