import { AppShell } from "@/components/layout-shell";
import { PageHeader } from "@/components/page-header";
import { SimilarWellsClient } from "./SimilarWellsClient";

export default function SimilarWellsPage() {
  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          title="Similar wells engine"
          description="Explainable offset similarity ranking computed from spatial proximity, formation overlap, depth, and operational incident profile."
        />
        <SimilarWellsClient />
      </div>
    </AppShell>
  );
}
