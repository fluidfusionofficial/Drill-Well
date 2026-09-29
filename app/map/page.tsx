import { AppShell } from "@/components/layout-shell";
import { PageHeader } from "@/components/page-header";
import { WellMapExplorer } from "@/components/well-map-explorer";

export default function MapPage() {
  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          title="Nearby wells map"
          description="Spatial intelligence layer for active well context and offset correlation."
        />
        <WellMapExplorer />
      </div>
    </AppShell>
  );
}
