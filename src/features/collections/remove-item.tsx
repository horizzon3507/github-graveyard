"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { X } from "lucide-react";

export function RemoveItem({ collectionId, repo }: { collectionId: string; repo: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={`Remove ${repo} from this collection`}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/collections/${collectionId}/repos`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repo }) });
        router.refresh();
      }}
      className="absolute top-3 right-3 z-10 rounded-md border border-border bg-background/80 p-1.5 text-muted-foreground opacity-0 backdrop-blur transition group-hover/item:opacity-100 hover:text-foreground focus-visible:opacity-100"
    >
      <X className="size-3.5" />
    </button>
  );
}
