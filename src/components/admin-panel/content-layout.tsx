import { Navbar } from '@/components/admin-panel/navbar';

interface ContentLayoutProps {
  title: string;
  children: React.ReactNode;
  navLeft?: React.ReactNode;
  navRight?: React.ReactNode;
}

export function ContentLayout({ title, children, navLeft, navRight }: ContentLayoutProps) {
  return (
    <div className="flex flex-col min-h-0 h-full w-full">
      <Navbar title={title} leftSlot={navLeft} navRight={navRight} />
      <div className="container flex-1 min-h-0 h-full pt-8 pb-8 px-4 sm:px-8 flex flex-col">
        {children}
      </div>
    </div>
  );
}
