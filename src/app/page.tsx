"use client";

import HeapPage from "./(site)/heap/page";
import AdminPanelLayout from "@/components/admin-panel/admin-panel-layout";

export default function HomePage() {
  return (
    <AdminPanelLayout>
      <HeapPage />
    </AdminPanelLayout>
  );
}
