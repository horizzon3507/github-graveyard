# GitHub Graveyard

Discover abandoned open-source projects worth bringing back to life.

GitHub Graveyard finds repositories that stopped receiving maintenance but still have stars, forks, open issues and a good idea inside, then answers the questions a would-be maintainer actually has: why does it look abandoned, is anyone still interested, is there already an active fork, what is obsolete, how hard would a revival be, and what should the first steps be.

Every number comes from the GitHub API. Nothing is invented: when data is missing, the interface says so (and demo content is labelled **Demo data** / **Example repository**).

## Features

- **Explore** (`/explore`): paginated grid with 20+ filters (language, stars, forks, license, years abandoned, last commit/release dates, size, open issues, active forks, archived, Grave Score, Revival Score, difficulty, category, topic, owner) and 8 sort orders. Filters live in the URL.
- **Search by name, description, topic, language or owner**, backed by trigram indexes. Queries the database first and tops it up from GitHub's search API on demand.
- **Analyze by URL**: paste `https://github.com/owner/repo` anywhere to analyze it right away.
- **Repository page** (`/repo/[owner]/[repo]`): status banner, Grave Score and Revival Score with every factor shown, timeline, activity graph that marks where the project started dying, "why it appears abandoned", community signals, **active forks** with a compare link, revival analysis (difficulty, effort, challenges, modernization suggestions, license, build and dependency hints), **Technology Archaeology**, **Issues Worth Solving**, and a generated **Revival Roadmap**.
- **Hidden Gems** (`/hidden-gems`), **Legendary Graves** (`/legendary`), **Random Grave** (`/random`).
- **GitHub sign-in**: collections ("Saved" plus your own), "I Want to Revive This", Resurrection projects (original → fork), public profiles at `/user/[username]`.
- **Honest scoring**: every score exposes its factors, weights and confidence, and is labelled as an automatic estimate. See [How scores work](#scoring-formulas).
- Dark, minimal, responsive UI (desktop first, tablet and mobile supported).

## Stack

Next.js 16 (App Router, Server Components), React 19, TypeScript, Tailwind CSS 4, shadcn/ui-style components on Radix primitives, PostgreSQL 16, Prisma 7 (`@prisma/adapter-pg`), Zod, Vitest.

## Quick start

Requirements: Node.js 20+ (developed on 24), pnpm, Docker (or any PostgreSQL 14+).

```bash
pnpm install                   # also runs `prisma generate`
cp .env.example .env           # then edit it (see below)
docker compose up -d db        # PostgreSQL on localhost:5432
pnpm db:deploy                 # apply migrations
pnpm ingest                    # seed the graveyard with real repositories from GitHub
pnpm dev                       # http://localhost:3000
```

`pnpm ingest` runs the search plan in `src/services/discovery.ts` (legendary, archived, buried, hidden-gem and per-topic/language queries) and stores a **quick scan** for each result. Pass a number to limit the queries, for example `pnpm ingest 8`. Without `GITHUB_TOKEN` it is throttled to GitHub's 10 searches per minute.

Quick scans use repository metadata only. Opening a repository (or running `pnpm jobs:refresh`) upgrades it to a **full analysis**.

### Configure GitHub access

**1. API token (recommended).** Unauthenticated requests are limited to 60 per hour, enough for a couple of full analyses. Create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new) with **no extra permissions** (public repositories only) and set `GITHUB_TOKEN`. That lifts the limit to 5,000 requests per hour. The token is read only on the server (`src/lib/env.ts`, `src/services/github.ts`) and is never sent to the browser.

**2. GitHub OAuth App (for sign-in).** This is what makes the **Sign in** button work (collections, "I Want to Revive This", profiles). It takes about two minutes:

1. Decide the public address of your app, exactly as people will type it. Locally that is `http://localhost:3000`; on a server it is something like `https://graveyard.example.com`. Call it `APP_URL`.
2. Go to <https://github.com/settings/developers> → **OAuth Apps** → **New OAuth App** and fill in:

   | Field | Value |
   | --- | --- |
   | Application name | GitHub Graveyard (anything) |
   | Homepage URL | your `APP_URL` |
   | Application description | optional |
   | **Authorization callback URL** | `APP_URL` + `/api/auth/callback/github`, for example `http://localhost:3000/api/auth/callback/github` |
   | Enable Device Flow | leave unchecked |

3. Click **Register application**. On the next page copy the **Client ID**, then click **Generate a new client secret** and copy it right away (GitHub shows it once).
4. Put the three values in `.env` and restart the server:

   ```bash
   APP_URL="http://localhost:3000"
   GITHUB_CLIENT_ID="Iv1.0123456789abcdef"
   GITHUB_CLIENT_SECRET="0123456789abcdef0123456789abcdef01234567"
   ```

5. Open `APP_URL`, click **Sign in**, then **Continue with GitHub**. GitHub asks you to authorize the app once and sends you back, signed in.

Only the `read:user` scope is requested (public profile). The OAuth access token is used once to read your profile and is **not stored**. Sessions are random 256-bit tokens in an `HttpOnly`, `SameSite=Lax` cookie; only a SHA-256 hash is stored in the database. Without OAuth credentials the app works fully in read-only mode and `/login` tells you what is missing.

**If sign-in fails**

| Symptom | Cause and fix |
| --- | --- |
| GitHub shows "The redirect_uri is not associated with this application" | The callback URL in the OAuth App doesn't exactly match `APP_URL` + `/api/auth/callback/github` (scheme, host, port and path). Edit the OAuth App or `APP_URL`. |
| Back on `/login?error=invalid_state` | The sign-in cookie was lost: you started on one host and returned on another (`localhost` vs `127.0.0.1`, or `http` vs `https`). Always use the exact `APP_URL` host. |
| `/login?error=not_configured` | `GITHUB_CLIENT_ID` or `GITHUB_CLIENT_SECRET` is empty, or the server wasn't restarted after editing `.env`. |
| `/login?error=login_failed` | Wrong client secret, or the code expired. Generate a new secret and try again. |
| Signed in but redirected to `localhost` | `APP_URL` still points at localhost while you serve the app from another address. Set it to the public URL. |
| Behind a reverse proxy, buttons say "Cross-origin requests are not allowed" | Forward the original `Host` (or set `X-Forwarded-Host`) and set `APP_URL` to the public origin. |

Use one OAuth App per environment (local, staging, production): GitHub allows only one callback URL per app.

**3. ChatGPT sign-in for AI (optional, separate from the login above).** "Continue with ChatGPT" on `/settings/ai` does not log you into the site; it lets you use your own ChatGPT plan for AI insights. Set `ENCRYPTION_KEY` (`openssl rand -base64 32`) and `CHATGPT_PLAN_ENABLED=true`, restart, and see [Your AI](#your-ai-chatgpt-plan-or-your-own-key).

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `APP_URL` | yes | Public origin, used for OAuth redirects and absolute URLs |
| `GITHUB_TOKEN` | recommended | Server-side GitHub API token (5,000 req/h) |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | for sign-in | GitHub OAuth App credentials |
| `CRON_SECRET` | for job endpoints | Bearer secret for `/api/jobs/*`. Endpoints are disabled when empty |
| `GRAVEYARD_STATUS_THRESHOLDS` | no | Status bands in days, default `recently_abandoned=180,fading=365,buried=730,ancient=1825` |
| `LEGENDARY_MIN_STARS` | no | Minimum stars for `/legendary` (default 5000) |
| `ANALYSIS_FORK_DEPTH` | no | Forks inspected per analysis (default 5, capped at 3 without a token) |
| `ANALYSIS_STALE_DAYS` | no | Re-analysis interval (default 14) |
| `ANALYSIS_MAX_CONCURRENCY` | no | Concurrent analyses per process (default 2) |
| `GITHUB_CACHE_TTL_SECONDS` | no | Default response cache TTL (default 21600) |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL` | no | Optional instance-wide AI for README summaries, see [AI providers](#ai-providers) |
| `ENCRYPTION_KEY` | for "Your AI" | Long random string (`openssl rand -base64 32`) used to encrypt visitors' AI credentials and derive the host id. Keep it stable |
| `CHATGPT_PLAN_ENABLED` | no | `true` enables "Continue with ChatGPT" (needs `ENCRYPTION_KEY`). Off by default, see [Your AI](#your-ai-chatgpt-plan-or-your-own-key) |

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js development, production build, production server |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | ESLint, TypeScript, Vitest |
| `pnpm db:migrate` | Create and apply a migration in development |
| `pnpm db:deploy` | Apply migrations (production, CI) |
| `pnpm ingest [maxQueries]` | Seed repositories from GitHub search (quick scans) |
| `pnpm analyze owner/repo [...]` | Run a full analysis from the command line |
| `pnpm jobs:refresh [limit]` | Deep-analyze the most popular quick-scan repositories, then re-analyze stale ones |
| `pnpm jobs:recompute` | Recompute quick scans after an algorithm change (no GitHub calls) |

### Background jobs

Expensive work never runs on page views. A repository page schedules the analysis with Next.js `after()`, shows **analysis pending** and updates itself when the result lands (a small poller hits `/api/repos/[owner]/[repo]/status`). Claims are atomic in PostgreSQL, so concurrent visitors start one run. Failures are stored with a reason (for example a rate limit with its reset time) and retried after 15 minutes; partial analyses retry after an hour.

For production, call these from a scheduler (cron, GitHub Actions, Vercel Cron). Both return `202` and work after the response:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/jobs/ingest?maxQueries=10"
curl -X POST -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/jobs/refresh?limit=10"
```

## Scoring formulas

All scores are **estimates computed by GitHub Graveyard from public data**, not absolute truth. Each score is a weighted average of factors valued 0 to 1. Factors that could not be measured are dropped and the remaining weights are rescaled; the share of weight that had data is reported as the score's **confidence**. The code lives in `src/analysis/` and the live explanation is at `/methodology` (generated from the same constants).

```
score = round(100 × Σ(weight × value) ÷ Σ(weight of available factors))
```

### Status bands

Based on days since the last commit (configurable): **Active** < 180, **Recently Abandoned** 180 to 365, **Fading** 1 to 2 years, **Buried** 2 to 5 years, **Ancient** 5+ years. Archived repositories are at least Recently Abandoned. A registered resurrection adds **Resurrected**.

### Grave Score (0 to 100, higher is more abandoned)

| Factor | Weight | Value |
| --- | ---: | --- |
| Time since last commit | 30 | `ln(1 + d/90) / ln(1 + 1825/90)`, 0 when fresh and 1 at five years |
| Time since last release | 12 | same curve; 0.5 when the project never released |
| Open issues with no response | 12 | 50% share of sampled open issues with zero comments + 50% volume (`min(1, n/50)`) |
| Abandoned pull requests | 8 | share of open PRs untouched for a year × `min(1, open/10)` |
| Drop in commit frequency | 12 | `1 − (commits in last 12 months ÷ commits in busiest 12 months)` |
| Maintainer activity | 8 | top contributor's public GitHub events in the last 90 days (`0.9` when none) |
| README mentions abandonment | 8 | 1 for "no longer maintained", "deprecated", "unmaintained" and similar; 0.6 for "looking for maintainers", "moved to", "superseded by" |
| Repository archived | 5 | 1 or 0, and the whole score has a floor of 50 when archived |
| Active contributors (12 months) | 5 | 0 → 1, 1 → 0.6, 2 → 0.3, 3 to 4 → 0.1, 5+ → 0 |

### Revival Score (0 to 100, higher is more promising)

| Factor | Weight | Value |
| --- | ---: | --- |
| Stars | 14 | `log10(stars+1) / log10(20001)` |
| Forks | 8 | `log10(forks+1) / log10(3001)` |
| Downloads | 4 | npm downloads last month, `log10(d+1) / log10(1,000,001)`; unavailable without an npm package |
| Recent issues | 7 | issues opened in the last 12 months, `min(1, n/30)` |
| People asking for updates | 6 | open issues asking if it is alive or maintained, `min(1, n/5)` |
| Recent pull requests | 4 | PRs opened in the last 12 months, `min(1, n/10)` |
| Documentation | 8 | README length, install and usage sections, docs folder, contributing/changelog |
| Tests and CI | 7 | 0.6 for test files + 0.4 for CI config |
| License | 10 | permissive 1, weak copyleft 0.75, copyleft 0.6, unrecognised 0.25, none 0.05 |
| Code size | 6 | 1 at 50 KB, 0 at about 20 MB (log scale) |
| Complexity | 4 | `1 − 0.2 × (languages − 1)`, minus 0.3 above 3,000 files |
| Technology debt | 8 | `1 − debtPoints/12` (each obsolete technology is 1 to 3 points) |
| Ease of updating dependencies | 6 | share of checked npm/PyPI dependencies that are current and not deprecated |
| Community | 8 | 50% contributors (log scale, 100 = 1) + 50% active forks (`min(1, n/5)`) |

A quick scan only knows stars, forks, license and size. Below 60% confidence the score is pulled toward 50 in proportion to the missing data, so a famous repository is not mistaken for an easy one.

### Difficulty and effort

Points: technology debt (1 to 3 per finding), deprecated dependencies (up to 3), dependencies two or more majors behind (up to 3), no tests (2), no CI (1), code size over 0.5 / 2 / 10 MB (1 / 2 / 3), more than three languages (1), more than five years of silence (1). **Easy** 0 to 3, **Moderate** 4 to 7, **Hard** 8 to 12, **Extreme** 13+. **Effort** is Small, Medium or Large from code size and difficulty.

### Hidden Gem score

```
100 × (0.30 × revival + 0.20 × abandonment fit + 0.20 × stars fit + 0.15 × no active fork + 0.15 × compact code)
```

`/hidden-gems` only lists repositories quiet for over a year, with 50+ stars, a license, at most 2 active forks and no registered resurrection.

### Community score

Deep analysis: 30% issues in the last 12 months, 15% pull requests, 25% active forks, 15% maintenance requests, 15% share of open issues updated in the last 6 months. Quick scan: a damped estimate from forks and open issues.

## How data is collected

- **GitHub REST API** through the `GitHubProvider` interface (`src/types/github.ts`) and its REST implementation (`src/providers/github/`). It covers repository metadata, commits, releases, issues, pull requests, contributors, forks, languages, topics, the file tree, workflow runs and search.
- **File contents** (README, manifests) come from `raw.githubusercontent.com`, which does not count against API limits.
- **Package registries**: npm and PyPI (latest versions, deprecation flags, npm downloads).
- **Commit history** comes from `/stats/contributors` (monthly commits, per-author activity). If GitHub is still computing it, the analysis retries briefly and otherwise reports it as unavailable.
- **Samples, not totals**: the newest 200 issues and pull requests, the 100 most discussed open issues and up to 100 open PRs. Pages say when a number is a lower bound.
- **Active forks** are searched among the top 30 forks by stars that were pushed after the original went quiet; each candidate is inspected with the compare, commits and contributors endpoints.
- **We never compile code.** "Does it still build?" is answered with the last CI run and dependency health, labelled as hints.

### Caching and rate limits

Every GitHub response is cached in PostgreSQL (`CacheEntry`) with per-endpoint TTLs, revalidated with `ETag`/`If-None-Match` (304s are free against the rate limit), de-duplicated while in flight, and served **stale** when GitHub is rate limited or down. The client tracks `x-ratelimit-*` per resource (core, search) and stops calling GitHub once the budget is spent. The UI has distinct states for loading, empty results, errors, rate limit (with reset time), repository not found, private repository, GitHub unavailable and analysis pending/partial.

Public endpoints have per-IP sliding-window limits (`src/lib/rate-limit.ts`, in-memory: swap it for Redis if you run several instances).

## API

All JSON, all under `/api`. Public reads are rate limited per IP.

| Endpoint | Description |
| --- | --- |
| `GET /api/repos/search` | Search and filter. Same query parameters as `/explore` (`q`, `language`, `minStars`, `status`, `sort`, `page`, ...). `live=0` disables the GitHub top-up |
| `POST /api/repos/analyze` | `{ "url": "https://github.com/owner/repo" }` validates, stores a quick scan and starts the full analysis |
| `GET /api/repos/[owner]/[repo]` | Repository summary, status and scores (also schedules analysis when needed) |
| `GET /api/repos/[owner]/[repo]/forks` | Analyzed forks with ahead/behind counts and compare links |
| `GET /api/repos/[owner]/[repo]/activity` | Monthly activity, peak, decline start, releases, timeline |
| `GET /api/repos/[owner]/[repo]/revival` | Scores with factors, difficulty, challenges, suggestions, technologies, roadmap, issues |
| `GET /api/repos/[owner]/[repo]/status` | Analysis state (used by the pending-page poller) |
| `POST/DELETE /api/repos/[owner]/[repo]/interest` | Declare or withdraw "I want to revive this" (signed in) |
| `POST/DELETE /api/repos/[owner]/[repo]/resurrection` | Register a fork as a Resurrection (must be a real fork you own) |
| `POST/DELETE /api/repos/[owner]/[repo]/save` | Toggle the default "Saved" collection |
| `GET/POST /api/collections`, `PATCH/DELETE /api/collections/[id]`, `POST/DELETE /api/collections/[id]/repos` | Collections |
| `PATCH /api/user/profile` | Favorite technologies |
| `POST /api/jobs/ingest`, `POST /api/jobs/refresh` | Background jobs (`CRON_SECRET`) |
| `GET /api/health` | Database liveness |

## Project structure

```
prisma/                 schema and migrations (includes trigram search indexes)
scripts/                ingest, analyze, refresh, recompute (tsx)
src/
  app/                  routes: pages, route handlers (api/*)
  components/           ui/ (shadcn-style primitives), layout/, graveyard/ (domain), brand/
  features/             explore/, home/, repo/, collections/ (UI + feature logic)
  analysis/             pure, tested logic: scores, status, technology rules, issues, activity, roadmap
  providers/            github/ (REST provider, cache-aware client), registry/, ai/ (provider abstraction)
  services/             orchestration: collector, analysis, discovery/ingest, auth, collections, community
  database/             Prisma client, cache store, queries
  config/               status thresholds and limits
  lib/                  env, errors, validation, rate limiting, API helpers
  types/                shared GitHub and analysis types
tests/                  Vitest suites (analysis, GitHub client, validation, filters)
docs/architecture.md    design notes and extension points
```

The `analysis/` layer has no I/O: `analyzeRepository(input)` takes collected data and returns scores and sections, which is why it is easy to test and to re-run when the algorithm changes (bump `ALGORITHM_VERSION`).

### Database

`User`, `Session`, `Repository` (denormalized scores for filtering and sorting), `RepositorySnapshot` (point-in-time metrics and the collected data, last 3 kept), `RepositoryAnalysis`, `RepositoryFork`, `Collection`, `CollectionRepository`, `RevivalInterest`, `ResurrectionProject`, `CacheEntry`. Indexes cover every filter and sort, GIN indexes cover topics and categories, and trigram indexes cover name, owner and description search.

### AI providers

AI is optional and off by default; the scores and findings never use it. `AIProvider` (`src/providers/ai/types.ts`) is a one-method interface, so the app is not tied to any vendor. Included: an OpenAI-compatible provider (OpenAI, Groq, OpenRouter, Ollama, LM Studio, vLLM, llama.cpp), Anthropic, Gemini, and a ChatGPT-plan provider.

- **Instance-wide (operator)**: set `AI_PROVIDER` (`openai`, `anthropic`, `gemini`, `local`) with `AI_API_KEY` to have the README summary rewritten by a model. Without it, the first meaningful README paragraph is used.
- **Per visitor** (below): each person connects their own AI and uses it for their own requests.

### Your AI: ChatGPT plan or your own key

`/settings/ai` lets any visitor connect an AI that **runs on their own account, never the site's**, and unlocks **Generate AI insight** on repository pages: a short verdict (worth reviving? for whom? first three steps) written from the analysis facts only.

1. **Continue with ChatGPT**: [Sign in with ChatGPT](https://developers.openai.com/siwc/token-sharing-open-source) for open-source apps. The user authorizes this app to use their ChatGPT plan for Responses API requests (no API key, no access to conversations). The server registers a client with `client_id=dynamic_agent_client`, a stable host id, PKCE and a verified ID token, stores the tokens **encrypted** (AES-256-GCM, `ENCRYPTION_KEY`), refreshes them under a database lock, revokes them on disconnect, and streams `POST https://api.openai.com/v1/responses` with `store: false`.
   - *Running locally*: open the app at `http://127.0.0.1:3000` (not `localhost`). The browser comes back to `/auth/callback` and finishes by itself.
   - *Running on a remote server*: the required `127.0.0.1` callback cannot reach the server, so after approving in ChatGPT you paste the address the browser ended on and the server finishes the exchange.
2. **Bring your own API key**: OpenAI, Anthropic, Gemini, Groq (free tier) or OpenRouter (free models). Endpoints are fixed presets (no arbitrary base URLs, which would be an SSRF vector). The key is verified with a tiny request, then stored encrypted.

Connections are tied to an `HttpOnly` cookie holding a random secret (only its hash is stored), not to a GitHub account, so they work without signing in.

> **ChatGPT plan usage is gated behind `CHATGPT_PLAN_ENABLED=true`, off by default.** OpenAI documents this sign-in for open-source and locally hosted apps, and asks teams that want to offer it from a paid or remotely hosted app to apply through its interest form. If you run a public multi-user instance, check that you are covered before enabling it. API-key mode has no such restriction. Anthropic and Gemini adapters are thin `fetch` wrappers that have not been run against the live APIs; the ChatGPT flow was verified up to OpenAI's login page (authorization parameters accepted) but a full sign-in needs a real ChatGPT account.

## Security

- The GitHub token, OAuth secret, cron secret and visitors' AI credentials exist only in server code (AI credentials are encrypted at rest). The production bundle was scanned for them (sentinel values never appear in `.next/static` or in rendered HTML).
- URL and input validation with strict patterns (`src/lib/validation.ts`), Zod schemas on every body, query filters parsed defensively.
- State-changing routes check `Origin` and use `SameSite=Lax` cookies; OAuth uses a random `state` and only same-site `next` paths.
- Per-IP rate limits on public endpoints, atomic analysis claims, and a hard cap on concurrent analyses.
- Private repositories are never stored: if GitHub reports `private: true` the request is refused.

## Testing

```bash
pnpm test        # unit tests: scoring, status, activity, technology rules, GitHub client, validation, filters
pnpm typecheck
pnpm lint
```

## Deploying

Any Node host with PostgreSQL works. Build with `pnpm build`, run `pnpm db:deploy` on release, start with `pnpm start`, and schedule the two job endpoints. Set `APP_URL` to the public origin (HTTPS makes session cookies `Secure`).

## Limitations

- Scores are heuristics. A finished project can look dead; a busy one can still be in trouble.
- Unauthenticated GitHub access is slow to fill the graveyard (60 requests per hour). Use `GITHUB_TOKEN`.
- Technology archaeology reads manifests at the repository root; monorepos can hide things.
- The in-memory rate limiter and analysis concurrency cap are per process.

## Roadmap

The schema and services already carry the data for the next features; see [docs/architecture.md](docs/architecture.md) for where each one plugs in: Graveyard Radar, Resurrection Feed, repository comparison, Maintainer Wanted, organization graveyards (`/org/[name]`), developer recommendations and Graveyard Wrapped.

## License

MIT, see [LICENSE](LICENSE). Not affiliated with GitHub.
