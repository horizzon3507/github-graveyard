"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Polls the lightweight status endpoint while the background analysis runs, then refreshes the page. */
export function AnalysisPoller({ owner, name }: { owner: string; name: string }) {
  const router = useRouter();

  useEffect(() => {
    let stopped = false;
    const started = Date.now();
    const tick = async () => {
      if (stopped) return;
      try {
        const res = await fetch(`/api/repos/${owner}/${name}/status`, { cache: "no-store" });
        if (res.ok) {
          const body = (await res.json()) as { status: string };
          if (body.status === "COMPLETE" || body.status === "FAILED") {
            stopped = true;
            router.refresh();
            return;
          }
        }
      } catch {
        // keep polling
      }
      if (Date.now() - started > 4 * 60_000) {
        stopped = true;
        router.refresh();
      }
    };
    const id = setInterval(tick, 4000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [owner, name, router]);

  return null;
}
