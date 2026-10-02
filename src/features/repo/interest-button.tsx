"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InterestButton({ owner, name, signedIn, interested, count }: { owner: string; name: string; signedIn: boolean; interested: boolean; count: number }) {
  const router = useRouter();
  const [active, setActive] = useState(interested);
  const [total, setTotal] = useState(count);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <Button asChild variant="accent" size="lg">
        <Link href={`/api/auth/github?next=${encodeURIComponent(`/repo/${owner}/${name}`)}`} prefetch={false}>
          <Sprout /> I Want to Revive This
        </Link>
      </Button>
    );
  }

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/repos/${owner}/${name}/interest`, { method: active ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: active ? undefined : "{}" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Something went wrong.");
      setActive(!active);
      setTotal(body.count);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant={active ? "secondary" : "accent"} size="lg" onClick={toggle} disabled={busy} aria-pressed={active}>
        {busy ? <Loader2 className="animate-spin" /> : <Sprout />}
        {active ? "You want to revive this" : "I Want to Revive This"}
      </Button>
      {active && <p className="text-xs text-muted-foreground">Click again to withdraw your interest. {total} total.</p>}
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}
