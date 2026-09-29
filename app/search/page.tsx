import { AppShell } from "@/components/layout-shell";
import { PageHeader } from "@/components/page-header";
import { SearchClient } from "./SearchClient";

export default function SearchPage() {
  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          title="Institutional knowledge search"
          description="Faceted search across structured historical incident reports, WCRs, and daily drilling records."
        />
        <SearchClient />
      </div>
    </AppShell>
  );
}
