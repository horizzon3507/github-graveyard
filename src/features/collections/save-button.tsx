"use client";

import Link from "next/link";
import { useState } from "react";
import { Bookmark, BookmarkCheck, Check, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface CollectionOption {
  id: string;
  name: string;
  isDefault: boolean;
}

const SUGGESTIONS = ["Projects I want to revive", "Old Linux tools", "Interesting abandoned games", "Possible SaaS ideas", "Libraries worth modernizing"];

export function SaveButton({ owner, name, signedIn, collections, initial }: { owner: string; name: string; signedIn: boolean; collections: CollectionOption[]; initial: string[] }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState(collections);
  const [member, setMember] = useState(new Set(initial));
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const repo = `${owner}/${name}`;

  if (!signedIn) {
    return (
      <Button asChild variant="secondary">
        <Link href={`/api/auth/github?next=${encodeURIComponent(`/repo/${owner}/${name}`)}`} prefetch={false}>
          <Bookmark /> Save
        </Link>
      </Button>
    );
  }

  async function call(url: string, method: string, body?: unknown) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error?.message ?? "Something went wrong.");
    return json;
  }

  async function toggle(id: string) {
    setBusy(id);
    setError(null);
    try {
      const has = member.has(id);
      await call(`/api/collections/${id}/repos`, has ? "DELETE" : "POST", { repo });
      setMember((prev) => {
        const next = new Set(prev);
        if (has) next.delete(id);
        else next.add(id);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function create(title: string) {
    setBusy("new");
    setError(null);
    try {
      const created = await call("/api/collections", "POST", { name: title });
      await call(`/api/collections/${created.id}/repos`, "POST", { repo });
      setOptions((o) => [...o, { id: created.id, name: created.name, isDefault: false }]);
      setMember((m) => new Set(m).add(created.id));
      setNewName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const saved = member.size > 0;
  const unused = SUGGESTIONS.filter((s) => !options.some((o) => o.name === s));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" aria-pressed={saved}>
          {saved ? <BookmarkCheck className="text-grave-green" /> : <Bookmark />} {saved ? "Saved" : "Save"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save to collection</DialogTitle>
          <DialogDescription>{repo}</DialogDescription>
        </DialogHeader>
        <ul className="grid max-h-64 gap-1 overflow-y-auto">
          {options.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => toggle(c.id)} disabled={busy !== null} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" aria-pressed={member.has(c.id)}>
                {c.name}
                {busy === c.id ? <Loader2 className="size-4 animate-spin" /> : member.has(c.id) ? <Check className="size-4 text-grave-green" /> : null}
              </button>
            </li>
          ))}
        </ul>
        {unused.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {unused.slice(0, 3).map((s) => (
              <button key={s} type="button" onClick={() => create(s)} disabled={busy !== null} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
                <Plus className="size-3" /> {s}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) void create(newName.trim());
          }}
          className="flex gap-2"
        >
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New collection" maxLength={60} aria-label="New collection name" />
          <Button type="submit" variant="secondary" disabled={busy !== null || !newName.trim()}>
            Create
          </Button>
        </form>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
