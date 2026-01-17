"use client";

import { ContentLayout } from "@/components/admin-panel/content-layout";

export default function TrashPage() {
  return (
    <ContentLayout title="Trash" navLeft={null}>
      <div className="py-4">
        <div className="text-center py-12 text-muted-foreground">No items in Trash.</div>
      </div>
    </ContentLayout>
  );
}
