import "server-only";
import { env } from "@/lib/env";
import { PrismaCacheStore } from "@/database/cache-store";
import { GitHubClient } from "@/providers/github/client";
import { RestGitHubProvider } from "@/providers/github/rest-provider";
import { PublicRegistryProvider } from "@/providers/registry/registry-provider";
import type { GitHubProvider } from "@/types/github";
import type { RegistryProvider } from "@/providers/registry/registry-provider";

interface Container {
  client: GitHubClient;
  github: GitHubProvider;
  registry: RegistryProvider;
}

const globalForGitHub = globalThis as unknown as { __graveyardGitHub?: Container };

/** Server-side singletons. The token never leaves this module's process. */
export function getGitHub(): Container {
  if (globalForGitHub.__graveyardGitHub) return globalForGitHub.__graveyardGitHub;
  const e = env();
  const store = new PrismaCacheStore();
  const client = new GitHubClient({ token: e.GITHUB_TOKEN, store, ttlSeconds: e.GITHUB_CACHE_TTL_SECONDS });
  const container = { client, github: new RestGitHubProvider(client), registry: new PublicRegistryProvider(store) };
  globalForGitHub.__graveyardGitHub = container;
  return container;
}
