import { Navbar } from "@/components/admin-panel/navbar";

interface ContentLayoutProps {
  title: string;
  children: React.ReactNode;
  navLeft?: React.ReactNode;
}

export function ContentLayout({ title, children, navLeft }: ContentLayoutProps) {
  return (
    <div>
      <Navbar title={title} leftSlot={navLeft} />
      <div className="container pt-8 pb-8 px-4 sm:px-8">{children}</div>
    </div>
  );
}
