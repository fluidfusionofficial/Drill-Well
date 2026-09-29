import { AppShell } from "@/components/layout-shell";
import { wells, currentWell } from "@/lib/nwis-data";
import { WellDetailClient } from "./WellDetailClient";

export function generateStaticParams() {
  return wells.map((well) => ({ wellId: well.id }));
}

export default async function WellPage({ params }: { params: Promise<{ wellId: string }> }) {
  const { wellId } = await params;
  const well = wells.find((item) => item.id === wellId) ?? currentWell;

  return (
    <AppShell>
      <WellDetailClient well={well} />
    </AppShell>
  );
}
