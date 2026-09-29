"use client";



import { Wrench } from "lucide-react";
import { WellWorkspaceShell, SourceUnavailable } from "@/components/well-workspace-shell";

export function WellBitsPage({ wellId }: { wellId: string }) {
  return (
    <WellWorkspaceShell wellId={wellId}>
      <SourceUnavailable title="Bit runs — no source data" reason="No bit-run schedule source supplied." icon={Wrench} />
    </WellWorkspaceShell>
  );
}
