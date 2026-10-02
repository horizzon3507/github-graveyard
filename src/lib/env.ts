import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  AI_PROVIDER: z.enum(["none", "openai", "anthropic", "gemini", "local"]).default("none"),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  AI_BASE_URL: z.string().url().optional(),
  ANALYSIS_FORK_DEPTH: z.coerce.number().int().min(0).max(15).default(5),
  ANALYSIS_STALE_DAYS: z.coerce.number().int().min(1).default(14),
  ANALYSIS_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  GITHUB_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(6 * 3600),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

function clean(value: string | undefined) {
  return value === undefined || value.trim() === "" ? undefined : value.trim();
}

export function env(): Env {
  if (cached) return cached;
  const raw = Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, clean(v)]));
  cached = schema.parse(raw);
  return cached;
}

export const isGitHubOAuthConfigured = () => Boolean(env().GITHUB_CLIENT_ID && env().GITHUB_CLIENT_SECRET);
export const isGitHubTokenConfigured = () => Boolean(env().GITHUB_TOKEN);
