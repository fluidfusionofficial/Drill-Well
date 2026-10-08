import { wells } from "@/lib/nwis-data";
import { WellConstructionPage } from "./construction.view";

export function generateStaticParams() {
  return wells.map((well) => ({ wellId: well.id }));
}

export default async function Page({ params }: { params: Promise<{ wellId: string }> }) {
  const { wellId } = await params;
  return <WellConstructionPage wellId={wellId} />;
}