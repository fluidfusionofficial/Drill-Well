"use client";



import { Layers3 } from "lucide-react";
import { WellWorkspaceShell, SourceUnavailable } from "@/components/well-workspace-shell";

export function WellCrossSectionPage({ wellId }: { wellId: string }) {
  return (
    <WellWorkspaceShell wellId={wellId}>
      <SourceUnavailable title="Cross section — no source data" reason="Cross-section correlation requires survey-derived TVD. Only MD is available, so correlation is shown in MD and labelled as such." icon={Layers3} />
    </WellWorkspaceShell>
  );
}
