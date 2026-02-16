import AdminPanelLayout from '@/components/admin-panel/admin-panel-layout';

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full min-h-0 flex flex-col">
      <AdminPanelLayout>{children}</AdminPanelLayout>
    </div>
  );
}
