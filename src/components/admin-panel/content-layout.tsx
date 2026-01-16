import { Navbar } from "@/components/admin-panel/navbar";

interface ContentLayoutProps {
  title: string;
  children: React.ReactNode;
  navLeft?: React.ReactNode;
  navRight?: React.ReactNode;
}

export function ContentLayout({ title, children, navLeft, navRight }: ContentLayoutProps) {
  return (
    <div>
      <Navbar title={title} leftSlot={navLeft} navRight={navRight} />
      <div className="container pt-8 pb-8 px-4 sm:px-8">{children}</div>
    </div>
  );
}
