"use client";

import HeapPage from "./(demo)/heap/page";
import AdminPanelLayout from "@/components/admin-panel/admin-panel-layout";

export default function HomePage() {
  return (
    <AdminPanelLayout>
      <HeapPage />
    </AdminPanelLayout>
  );
}
