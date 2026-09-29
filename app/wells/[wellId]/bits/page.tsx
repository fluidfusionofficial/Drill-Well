import { wells } from "@/lib/nwis-data";
import { WellBitsPage } from "./bits.view";

export function generateStaticParams() {
  return wells.map((well) => ({ wellId: well.id }));
}

export default async function Page({ params }: { params: Promise<{ wellId: string }> }) {
  const { wellId } = await params;
  return <WellBitsPage wellId={wellId} />;
}