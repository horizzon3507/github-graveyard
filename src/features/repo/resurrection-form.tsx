"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function ResurrectionForm({ owner, name }: { owner: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [repo, setRepo] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/repos/${owner}/${name}/resurrection`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revivalRepo: repo, note: note || undefined }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Something went wrong.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">Register a Resurrection</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register a Resurrection</DialogTitle>
          <DialogDescription>
            Link your fork of {owner}/{name} as its continuation. The fork must descend from this repository and belong to you (or to an organization you publicly belong to).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <label className="grid gap-1.5 text-sm">
            Your fork
            <Input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="https://github.com/you/project" required maxLength={300} autoFocus />
          </label>
          <label className="grid gap-1.5 text-sm">
            What are you changing? <span className="text-xs text-muted-foreground">(optional)</span>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Porting to TypeScript, fixing the build…" maxLength={280} />
          </label>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" disabled={busy || repo.trim().length < 3}>
            {busy && <Loader2 className="animate-spin" />} Register fork
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
