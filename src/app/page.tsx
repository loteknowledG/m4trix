'use client';

import AgentsPage from './(site)/agents/page';
import AdminPanelLayout from '@/components/admin-panel/admin-panel-layout';

export default function HomePage() {
  return (
    <AdminPanelLayout>
      <AgentsPage />
    </AdminPanelLayout>
  );
}
