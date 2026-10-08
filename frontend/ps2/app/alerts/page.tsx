import { AppShell } from "@/components/layout-shell";
import { PageHeader } from "@/components/page-header";
import { AlertsPageClient } from "./AlertsPageClient";

export default function AlertsPage() {
  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          title="Historical context alerts"
          description="Recorded precedent alerts based on nearby offset wells, depth proximity, and formation intervals. Recorded precedents, not predictions."
        />
        <AlertsPageClient />
      </div>
    </AppShell>
  );
}
