"use client";



import { Ruler } from "lucide-react";
import { WellWorkspaceShell, SourceUnavailable } from "@/components/well-workspace-shell";

export function WellConstructionPage({ wellId }: { wellId: string }) {
  return (
    <WellWorkspaceShell wellId={wellId}>
      <SourceUnavailable title="Casing & cementing — no source data" reason="No casing or cement source data supplied. Casing depths are never invented." icon={Ruler} />
    </WellWorkspaceShell>
  );
}
