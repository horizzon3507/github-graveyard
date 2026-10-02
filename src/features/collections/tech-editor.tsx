"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TechEditor({ initial }: { initial: string[] }) {
  const router = useRouter();
  const [tech, setTech] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function save(next: string[]) {
    setError(null);
    const res = await fetch("/api/user/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ favoriteTech: next }) });
    if (!res.ok) {
      setError("Could not save your technologies.");
      return;
    }
    setTech(next);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-1.5">
        {tech.map((t) => (
          <li key={t}>
            <Badge variant="blue">
              {t}
              {editing && (
                <button type="button" aria-label={`Remove ${t}`} onClick={() => save(tech.filter((x) => x !== t))}><X /></button>
              )}
            </Badge>
          </li>
        ))}
        {tech.length === 0 && <li className="text-sm text-muted-foreground">Nothing yet.</li>}
      </ul>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const value = draft.trim();
            if (value && !tech.includes(value) && tech.length < 15) void save([...tech, value]);
            setDraft("");
          }}
          className="flex max-w-sm gap-2"
        >
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Rust, Lua, Elixir…" maxLength={30} aria-label="Add a technology" />
          <Button type="submit" variant="secondary">Add</Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Done</Button>
        </form>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}><Pencil /> Edit</Button>
      )}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </div>
  );
}
