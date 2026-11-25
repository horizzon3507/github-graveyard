# Contributing to GitHub Graveyard

Thanks for helping abandoned projects find new maintainers.

## Setup

1. Node.js 20+ and pnpm (`corepack enable`).
2. `cp .env.example .env` and fill in `DATABASE_URL` (and ideally `GITHUB_TOKEN`).
3. `pnpm install`, `docker compose up -d db`, `pnpm db:deploy`, `pnpm dev`.

## Before opening a PR

- `pnpm typecheck`, `pnpm lint` and `pnpm test` must pass; CI runs them plus a
  production build.
- Analysis logic lives in `src/analysis/` and is pure: no I/O, no imports from
  `services/` or `providers/`. New scoring rules belong there and need tests.
- If you change how scores, statuses or difficulty are computed, bump
  `ALGORITHM_VERSION` in `src/config/graveyard.ts` so stored analyses are
  marked stale, and update the formulas section in the README.
- Keep the honesty contract: every number must come from the GitHub API or be
  labelled as an estimate. No invented data, no unlabelled demo content.

## Commits and PRs

- Conventional commits (`fix:`, `feat:`, `test:`, `docs:`, `ci:`, `chore:`).
- One logical change per commit; each commit should compile on its own.
- Fill in the PR template: what changed, why, and how you verified it.

## Reporting security issues

Please do not open public issues for vulnerabilities. See SECURITY.md.
