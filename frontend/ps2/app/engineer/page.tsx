import { AppShell } from "@/components/layout-shell";
import { PageHeader } from "@/components/page-header";
import { EngineerClient } from "./EngineerClient";

export default function EngineerPage() {
  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          title="Engineer knowledge workspace"
          description="Capture operational observations, lessons learned, and validation reviews linked to well and depth context."
        />
        <EngineerClient />
      </div>
    </AppShell>
  );
}
