"use client";



import { Compass } from "lucide-react";
import { WellWorkspaceShell, SourceUnavailable } from "@/components/well-workspace-shell";

export function WellLoggingPage({ wellId }: { wellId: string }) {
  return (
    <WellWorkspaceShell wellId={wellId}>
      <SourceUnavailable title="Logging runs — no source data" reason="No logging run source data supplied." icon={Compass} />
    </WellWorkspaceShell>
  );
}
