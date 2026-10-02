"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InsightPanel({ repo, connected, label }: { repo: string; connected: boolean; label: string | null }) {
  const [text, setText] = useState<string | null>(null);
  const [meta, setMeta] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/insight", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repo }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Something went wrong.");
      setText(json.text);
      setMeta(`${json.provider}${json.model ? ` · ${json.model}` : ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surface space-y-4 p-5">
      {text ? (
        <>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
          <p className="text-xs text-muted-foreground">Written by {meta} from the analysis on this page, using your own AI connection. AI can be wrong: check the facts before you commit time.</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {connected ? `A plain-language verdict and first steps, written by your connected AI (${label}) from this analysis.` : "Connect your ChatGPT plan or your own API key to get a plain-language verdict and first steps for this project. The scores never need AI."}
        </p>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        {connected ? (
          <Button variant="secondary" onClick={generate} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} {text ? "Regenerate" : "Generate AI insight"}
          </Button>
        ) : (
          <Button asChild variant="secondary">
            <Link href="/settings/ai">Connect your AI</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
