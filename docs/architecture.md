# Architecture notes

## Request flow

1. **Page or API request** → `ensureRepository(owner, name)` returns the stored repository, refreshing metadata from GitHub when it is older than 6 hours (one API call, cached).
2. **New repositories** get a *quick scan* (`analysis` with `depth = QUICK`) computed from metadata only, so something useful renders immediately.
3. `requestDeepAnalysis` claims the analysis atomically (`UPDATE ... WHERE status <> 'RUNNING' OR startedAt < now() - 10 min`) and schedules `runDeepAnalysis` with `after()`. The page shows *analysis pending* and polls `/status`.
4. `collectRepositoryData` (services/collector.ts) fetches everything through `GitHubProvider`, `RegistryProvider` and an optional `AIProvider`, records which requests failed, and returns plain data.
5. `analyzeRepository` (analysis/analyze.ts) is pure: it turns collected data into scores, signals, technology findings, issue highlights, suggestions and the roadmap.
6. One transaction stores the snapshot, the analysis, the analyzed forks and the denormalized columns on `Repository` used by filters and sorting.

## Principles

- **No vendor lock-in**: GitHub, package registries and AI are behind interfaces (`src/types/github.ts`, `providers/registry`, `providers/ai`). The REST provider can be swapped for GraphQL without touching `analysis/`.
- **Explainable scores**: factors, weights, values and confidence are persisted (`graveFactors`, `revivalFactors`) and shown in the UI.
- **Partial results beat failures**: each GitHub call is isolated; failures are listed in `SnapshotData.failed`, shown to the user, and trigger a faster retry.
- **Cheap reads**: filters hit denormalized indexed columns; status bands are evaluated as `lastActivityAt` ranges in SQL, so changing the thresholds needs no migration.

## Extension points for post-MVP features

| Feature | Where it plugs in |
| --- | --- |
| **Graveyard Radar** (popular projects slowing down) | `RepositorySnapshot` keeps point-in-time metrics, and `SnapshotData.commitActivity.monthly` already holds the trend. Add a job that compares `commitDecline` between snapshots for repositories with many stars and `status = active`, and a `/radar` page reading from it. |
| **Resurrection Feed** | `ResurrectionProject.createdAt`, `RepositoryFork.isActive/lastCommitAt` and `RevivalInterest.createdAt` are the events. A `/feed` page can union them ordered by time; `profile` already builds a small version of this. |
| **Repository comparison** | `RepositoryFork` stores `aheadBy`, `behindBy`, `recentCommits` and `defaultBranch`. `GitHubProvider.inspectFork` is the place to add a richer compare; the "Compare Fork" button currently links to GitHub's compare view. |
| **Maintainer Wanted** | Add a `maintainerWanted` flag plus `claimedBy` on `Repository` (or a small table), set through a route like `interest`, and surface it as a filter in `exploreFiltersSchema` and `buildWhere`. |
| **Organization Graveyard** `/org/[name]` | `Repository.owner` is indexed and `/explore?owner=` already works. The page is `searchRepositories({ owner, includeActive })` plus an org header from `GitHubProvider`. |
| **Developer Recommendations** | `User.favoriteTech` plus languages of interests and saved repositories (computed on the profile page today). Query `Repository.language` / `topics` with `revivalScore` and `hiddenGemScore`. |
| **Graveyard Wrapped** | `Repository.lastActivityAt`, `ResurrectionProject` and `analysis.technologies` aggregate by year in plain SQL. |

## Operational notes

- The analysis concurrency cap and the rate limiter are in-process. For multi-instance deployments move the limiter to Redis and rely on the database claim for analysis (already atomic).
- Bumping `ALGORITHM_VERSION` marks deep analyses stale (they refresh on next view or via `jobs:refresh`) and `pnpm jobs:recompute` rebuilds quick scans from stored metadata.
- Prisma 7 requires a driver adapter; `src/database/client.ts` uses `@prisma/adapter-pg`.
