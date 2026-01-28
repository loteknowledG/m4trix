"use client";

import AdminPanelLayout from "@/components/admin-panel/admin-panel-layout";

export default function SkunkworxLayout({ children }: { children: React.ReactNode }) {
  return <AdminPanelLayout>{children}</AdminPanelLayout>;
}
