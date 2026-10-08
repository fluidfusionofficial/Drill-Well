import Link from "next/link";
import { ArrowUpRight, Drill, MapPin } from "lucide-react";
import type { Well } from "@/lib/nwis-data";
import { Badge } from "@/components/ui/Badge";

export function WellCard({ well }: { well: Well }) {
  return (
    <Link
      href={`/wells/${well.id}`}
      className="block rounded-[6px] border border-line bg-surface p-4 transition hover:border-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-ink-3">{well.location}</div>
          <h3 className="mt-1 text-lg font-semibold text-ink">{well.id}</h3>
        </div>
        <Badge
          variant={
            well.status === "Active"
              ? "accent"
              : well.status === "Drilling Complete" || well.status === "Completed"
              ? "ok"
              : "neutral"
          }
        >
          {well.status}
        </Badge>
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-ink-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-ink-3" />
          <span>{well.profile}</span>
        </div>
        <div className="flex items-center gap-2">
          <Drill className="h-3.5 w-3.5 text-ink-3" />
          <span>
            Target {well.targetDepth} m / Actual {well.actualDepth} m
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-xs">
        <span className="text-ink-3">Formation</span>
        <span className="font-medium text-ink truncate max-w-[140px]">{well.formation}</span>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-xs font-medium text-accent">
        <span>Open well profile</span>
        <ArrowUpRight className="h-3.5 w-3.5" />
      </div>
    </Link>
  );
}
