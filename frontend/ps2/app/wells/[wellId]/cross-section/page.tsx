import { wells } from "@/lib/nwis-data";
import { WellCrossSectionPage } from "./cross-section.view";

export function generateStaticParams() {
  return wells.map((well) => ({ wellId: well.id }));
}

export default async function Page({ params }: { params: Promise<{ wellId: string }> }) {
  const { wellId } = await params;
  return <WellCrossSectionPage wellId={wellId} />;
}