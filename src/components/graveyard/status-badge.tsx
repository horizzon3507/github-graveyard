import { Archive, Sprout } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { thresholds } from "@/config/graveyard";
import { getGraveStatus, STATUS_META } from "@/analysis/status";
import type { GraveStatusKey } from "@/types/analysis";

const VARIANT: Record<GraveStatusKey, "green" | "blue" | "purple" | "muted" | "amber"> = {
  active: "green",
  recently_abandoned: "blue",
  fading: "purple",
  buried: "muted",
  ancient: "amber",
};

export function statusFor(lastActivityAt: Date, archived: boolean, now = new Date()): GraveStatusKey {
  return getGraveStatus(lastActivityAt, now, thresholds, archived);
}

export function StatusBadge({ lastActivityAt, archived = false, resurrected = false, className }: { lastActivityAt: Date; archived?: boolean; resurrected?: boolean; className?: string }) {
  const status = statusFor(lastActivityAt, archived);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {resurrected && (
        <Badge variant="green" className={className}>
          <Sprout /> Resurrected
        </Badge>
      )}
      <Badge variant={VARIANT[status]} className={className} title={STATUS_META[status].description(thresholds)}>
        {STATUS_META[status].label}
      </Badge>
      {archived && (
        <Badge variant="outline" className={className}>
          <Archive /> Archived
        </Badge>
      )}
    </span>
  );
}
