import "server-only";
import type { ExploreFilters } from "@/features/explore/filters";
import { thresholds } from "@/config/graveyard";
import { getGitHub } from "@/services/github";
import { upsertRepository } from "@/services/repository-service";
import { hasCode, isAppError, rateLimitReset } from "@/lib/errors";

const DAY = 86_400_000;
const isoDay = (now: Date, daysAgo: number) => new Date(now.getTime() - daysAgo * DAY).toISOString().slice(0, 10);

export type LiveSearchStatus = "ok" | "skipped" | "rate_limited" | "unavailable";

export interface LiveSearchResult {
  status: LiveSearchStatus;
  imported: number;
  resetAt?: string | null;
}

/** Turns Explore filters into a GitHub repository search query (abandoned, non-fork, public). */
export function buildGitHubQuery(filters: Partial<ExploreFilters>, now: Date): string | null {
  const terms: string[] = [];
  if (filters.q) {
    const q = filters.q.replace(/[^\p{L}\p{N}\s._/-]/gu, " ").trim();
    const slashed = q.match(/^([\w.-]+)\/([\w.-]+)$/);
    if (slashed) terms.push(`${slashed[2]} user:${slashed[1]}`);
    else if (q) terms.push(q.split(/\s+/).slice(0, 6).join(" "));
  }
  if (filters.owner && !terms.some((t) => t.includes("user:"))) terms.push(`user:${filters.owner}`);
  if (terms.length === 0 && !filters.language && !filters.topic) return null;
  if (terms.length > 0 && !terms[0].includes("user:")) terms[0] = `${terms[0]} in:name,description,topics`;
  if (filters.language) terms.push(`language:"${filters.language.replace(/"/g, "")}"`);
  if (filters.topic) terms.push(`topic:${filters.topic.replace(/[^\w-]/g, "")}`);
  terms.push(`stars:>=${filters.minStars ?? 25}`, "fork:false");
  if (filters.archived === "only") terms.push("archived:true");
  else {
    if (filters.archived === "exclude") terms.push("archived:false");
    if (!filters.includeActive) terms.push(`pushed:<${isoDay(now, thresholds.recentlyAbandonedDays)}`);
  }
  return terms.join(" ");
}

const recentSearches = new Map<string, number>();

/**
 * Pulls matching abandoned repositories from GitHub into the database as quick scans, so Explore
 * works for any query and not only for what was ingested up front.
 */
export async function discoverFromGitHub(filters: Partial<ExploreFilters>, now = new Date()): Promise<LiveSearchResult> {
  const query = buildGitHubQuery(filters, now);
  if (!query) return { status: "skipped", imported: 0 };
  const last = recentSearches.get(query);
  if (last && Date.now() - last < 6 * 3600_000) return { status: "skipped", imported: 0 };

  try {
    const page = await getGitHub().github.searchRepositories(query, { sort: "stars", perPage: 50 });
    for (const meta of page.items) await upsertRepository(meta, "SEARCH", now);
    recentSearches.set(query, Date.now());
    if (recentSearches.size > 500) recentSearches.clear();
    return { status: "ok", imported: page.items.length };
  } catch (error) {
    if (hasCode(error, "rate_limited")) return { status: "rate_limited", imported: 0, resetAt: rateLimitReset(error)?.toISOString() ?? null };
    if (isAppError(error) && error.code === "invalid_input") return { status: "skipped", imported: 0 };
    console.error("[discovery] live search failed", error);
    return { status: "unavailable", imported: 0 };
  }
}

export interface IngestQuery {
  label: string;
  q: string;
  pages: number;
}

const TOPICS = ["game", "linux", "machine-learning", "android", "ios", "cli", "react", "framework", "compiler", "editor", "emulator", "database", "web-framework", "devtools"];
const LANGUAGES = ["JavaScript", "TypeScript", "Python", "Go", "Rust", "Ruby", "PHP", "Java", "C++", "C", "Swift", "Kotlin", "C#", "Shell"];

export function buildIngestPlan(now = new Date()): IngestQuery[] {
  const d = (days: number) => isoDay(now, days);
  const plan: IngestQuery[] = [
    { label: "legendary", q: `stars:>8000 pushed:<${d(540)} fork:false`, pages: 2 },
    { label: "archived", q: `stars:>1500 archived:true fork:false`, pages: 2 },
    { label: "buried popular", q: `stars:>1000 pushed:<${d(1825)} fork:false`, pages: 2 },
    { label: "fading popular", q: `stars:>2000 pushed:${d(1825)}..${d(365)} fork:false`, pages: 2 },
    { label: "recently abandoned", q: `stars:300..3000 pushed:${d(730)}..${d(210)} fork:false`, pages: 2 },
    { label: "hidden gems", q: `stars:100..1500 pushed:${d(2200)}..${d(730)} fork:false`, pages: 2 },
  ];
  for (const topic of TOPICS) plan.push({ label: `topic:${topic}`, q: `topic:${topic} stars:>400 pushed:<${d(365)} fork:false`, pages: 1 });
  for (const language of LANGUAGES) plan.push({ label: `language:${language}`, q: `language:"${language}" stars:>500 pushed:<${d(730)} fork:false`, pages: 1 });
  return plan;
}

export interface IngestOptions {
  maxQueries?: number;
  throttleMs?: number;
  onProgress?: (message: string) => void;
}

export async function runIngest(options: IngestOptions = {}): Promise<{ queries: number; imported: number; stoppedBy?: string }> {
  const { github, client } = getGitHub();
  const throttle = options.throttleMs ?? (client.authenticated ? 2200 : 6500);
  const plan = buildIngestPlan().slice(0, options.maxQueries ?? Infinity);
  let imported = 0;
  let queries = 0;
  for (const item of plan) {
    for (let page = 1; page <= item.pages; page++) {
      try {
        const result = await github.searchRepositories(item.q, { sort: "stars", perPage: 100, page });
        for (const meta of result.items) await upsertRepository(meta, "INGEST");
        imported += result.items.length;
        queries++;
        options.onProgress?.(`${item.label} p${page}: ${result.items.length} repositories (${imported} total)`);
        if (result.items.length < 100) break;
      } catch (error) {
        if (hasCode(error, "rate_limited")) return { queries, imported, stoppedBy: `GitHub rate limit (resets ${rateLimitReset(error)?.toISOString() ?? "soon"})` };
        options.onProgress?.(`${item.label}: skipped (${isAppError(error) ? error.message : "error"})`);
        break;
      }
      await new Promise((r) => setTimeout(r, throttle));
    }
  }
  return { queries, imported };
}
