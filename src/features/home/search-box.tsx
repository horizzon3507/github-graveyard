"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { looksLikeGitHubUrl, parseRepoInput } from "@/lib/validation";
import { cn } from "@/lib/utils";

const ERROR_COPY: Record<string, string> = {
  not_found: "We couldn't find that repository. It may not exist, or it may be private.",
  private_repository: "That repository is private. GitHub Graveyard only analyzes public repositories.",
  rate_limited: "GitHub's API rate limit has been reached. Try again in a few minutes.",
  github_unavailable: "GitHub's API is unavailable right now. Try again shortly.",
  too_many_requests: "Slow down a little. Try again in a moment.",
  invalid_input: "That doesn't look like a GitHub repository URL.",
};

export function SearchBox({ size = "lg", autoFocus = false, className }: { size?: "lg" | "md"; autoFocus?: boolean; className?: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [analyzing, setAnalyzing] = useState(false);

  const isUrl = looksLikeGitHubUrl(value);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const query = value.trim();
    if (!isUrl) {
      startTransition(() => router.push(query ? `/explore?q=${encodeURIComponent(query)}` : "/explore"));
      return;
    }
    const ref = parseRepoInput(query);
    if (!ref) {
      setError(ERROR_COPY.invalid_input);
      return;
    }
    setAnalyzing(true);
    try {
      const response = await fetch("/api/repos/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: query }) });
      const body = await response.json();
      if (!response.ok) {
        setError(ERROR_COPY[body?.error?.code] ?? body?.error?.message ?? "Something went wrong.");
        return;
      }
      startTransition(() => router.push(body.path));
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  const busy = pending || analyzing;
  return (
    <form onSubmit={submit} className={cn("w-full", className)} role="search">
      <div className={cn("surface flex items-center gap-2 p-1.5 focus-within:border-grave-green/40 focus-within:ring-2 focus-within:ring-ring/30", size === "lg" ? "rounded-2xl" : "")}>
        <Search className="ml-3 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <label htmlFor={`search-${size}`} className="sr-only">
          Search abandoned repositories or paste a GitHub URL
        </label>
        <input
          id={`search-${size}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          maxLength={300}
          placeholder="Search abandoned repositories…"
          className={cn("min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/70", size === "lg" ? "h-12 text-base" : "h-10 text-sm")}
        />
        <Button type="submit" variant={isUrl ? "accent" : "default"} size={size === "lg" ? "lg" : "default"} disabled={busy} className="shrink-0">
          {busy ? <Loader2 className="animate-spin" /> : null}
          <span className="hidden sm:inline">{isUrl ? "Analyze Repository" : "Explore the Graveyard"}</span>
          <span className="sm:hidden">{isUrl ? "Analyze" : "Explore"}</span>
          {!busy && <ArrowRight />}
        </Button>
      </div>
      <p className="mt-3 min-h-5 text-center text-xs text-muted-foreground" aria-live="polite">
        {error ? <span className="text-destructive">{error}</span> : isUrl ? "Press enter to analyze this repository right now." : "Or paste a GitHub URL like github.com/owner/repository to analyze it instantly."}
      </p>
    </form>
  );
}
