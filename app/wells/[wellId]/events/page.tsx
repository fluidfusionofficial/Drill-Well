import { wells } from "@/lib/nwis-data";
import { WellEventsPage } from "./events.view";

export function generateStaticParams() {
  return wells.map((well) => ({ wellId: well.id }));
}

export default async function Page({ params }: { params: Promise<{ wellId: string }> }) {
  const { wellId } = await params;
  return <WellEventsPage wellId={wellId} />;
}