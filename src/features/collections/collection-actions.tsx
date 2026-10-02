"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function CollectionActions({ id, isPublic, isDefault }: { id: string; isPublic: boolean; isDefault: boolean }) {
  const router = useRouter();
  const [publicState, setPublic] = useState(isPublic);
  const [error, setError] = useState<string | null>(null);

  async function togglePublic(next: boolean) {
    setPublic(next);
    const res = await fetch(`/api/collections/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPublic: next }) });
    if (!res.ok) {
      setPublic(!next);
      setError("Could not update visibility.");
    } else router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this collection? The repositories themselves are not affected.")) return;
    const res = await fetch(`/api/collections/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Could not delete the collection.");
      return;
    }
    router.push("/collections");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Switch checked={publicState} onCheckedChange={togglePublic} aria-label="Public collection" />
        {publicState ? "Public: visible on your profile" : "Private: only you"}
      </label>
      {!isDefault && (
        <Button variant="destructive" size="sm" onClick={remove}><Trash2 /> Delete</Button>
      )}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </div>
  );
}
