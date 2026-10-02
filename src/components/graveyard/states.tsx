import Link from "next/link";
import { AlertTriangle, Clock, FileQuestion, Hourglass, Lock, ServerCrash, Skull } from "lucide-react";
import { Button } from "@/components/ui/button";

type Kind = "empty" | "not-found" | "private" | "rate-limit" | "unavailable" | "error" | "pending";

const ICONS = { empty: Skull, "not-found": FileQuestion, private: Lock, "rate-limit": Clock, unavailable: ServerCrash, error: AlertTriangle, pending: Hourglass } as const;

export function StateMessage({ kind, title, children, action }: { kind: Kind; title: string; children?: React.ReactNode; action?: { href: string; label: string } }) {
  const Icon = ICONS[kind];
  return (
    <div role={kind === "error" || kind === "unavailable" ? "alert" : "status"} className="surface mx-auto flex max-w-xl flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-full border border-border bg-secondary text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
      {action && (
        <Button asChild variant="secondary" size="sm" className="mt-2">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}

export function formatReset(resetAt: string | Date | null | undefined): string {
  if (!resetAt) return "in a few minutes";
  const date = new Date(resetAt);
  const minutes = Math.max(1, Math.ceil((date.getTime() - Date.now()) / 60_000));
  return minutes < 60 ? `in about ${minutes} min` : `at ${new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(date)}`;
}
