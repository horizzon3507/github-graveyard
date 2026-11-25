import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { after } from "next/server";
import { cookies } from "next/headers";
import { StateMessage, formatReset } from "@/components/graveyard/states";
import { db } from "@/database/client";
import { getRepositoryDetail } from "@/database/repository-detail";
import { buildActivityReport, buildTimeline } from "@/analysis/activity";
import { statusFor } from "@/components/graveyard/status-badge";
import { hasCode, rateLimitReset } from "@/lib/errors";
import { isValidRepoRef, toSlug } from "@/lib/validation";
import { getCurrentUser } from "@/services/auth-service";
import { requestDeepAnalysis } from "@/services/analysis-service";
import { collectionsContaining, listCollections } from "@/services/collection-service";
import { ensureRepository } from "@/services/repository-service";
import { AnalysisPoller } from "@/features/repo/analysis-poller";
import { ActivityChart } from "@/features/repo/activity-chart";
import { readAnalysis } from "@/features/repo/analysis-data";
import { ClaimSection } from "@/features/repo/claim";
import { CommunityAlive, WhyAbandoned } from "@/features/repo/community";
import { ActiveForks } from "@/features/repo/forks";
import { RepoHeader } from "@/features/repo/header";
import { IssuesWorth } from "@/features/repo/issues";
import { RevivalAnalysis, TechnologyArchaeology } from "@/features/repo/revival";
import { RevivalRoadmap } from "@/features/repo/roadmap";
import { ScoresSection } from "@/features/repo/scores";
import { Section } from "@/features/repo/section";
import { AnalysisBanner, StatusBanner } from "@/features/repo/status-banner";
import { Timeline } from "@/features/repo/timeline";
import { SaveButton } from "@/features/collections/save-button";
import { InsightPanel } from "@/features/ai/insight-panel";
import { AI_COOKIE, getAiStatus } from "@/services/ai-connection-service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ owner: string; repo: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { owner, repo } = await params;
  if (!isValidRepoRef(owner, repo)) return { title: "Repository not found" };
  const row = await db.repository.findUnique({ where: { slug: toSlug(owner, repo) }, select: { owner: true, name: true, description: true } }).catch(() => null);
  if (!row) return { title: `${owner}/${repo}` };
  return { title: `${row.owner}/${row.name}`, description: row.description ?? `Abandonment and revival analysis for ${row.owner}/${row.name}.` };
}

const NAV = [
  ["scores", "Scores"],
  ["insight", "AI insight"],
  ["timeline", "Timeline"],
  ["activity", "Activity"],
  ["why", "Why abandoned"],
  ["community", "Community"],
  ["forks", "Active forks"],
  ["revival", "Revival analysis"],
  ["archaeology", "Archaeology"],
  ["issues", "Issues"],
  ["roadmap", "Roadmap"],
  ["claim", "Revive it"],
] as const;

export default async function RepoPage({ params }: Params) {
  const { owner, repo: name } = await params;
  if (!isValidRepoRef(owner, name)) notFound();

  const [user, loaded] = await Promise.all([
    getCurrentUser().catch(() => null),
    ensureRepository(owner, name).then(
      (repository) => ({ repository, error: null }),
      (error: unknown) => ({ repository: null, error }),
    ),
  ]);

  if (!loaded.repository) {
    const error = loaded.error;
    if (hasCode(error, "not_found")) notFound();
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        {hasCode(error, "private_repository") ? (
          <StateMessage kind="private" title="This repository is private" action={{ href: "/explore", label: "Explore the graveyard" }}>
            GitHub Graveyard only analyzes public repositories.
          </StateMessage>
        ) : hasCode(error, "rate_limited") ? (
          <StateMessage kind="rate-limit" title="GitHub rate limit reached" action={{ href: "/explore", label: "Browse analyzed graves" }}>
            We can&apos;t fetch new repositories right now. Try again {formatReset(rateLimitReset(error))}, or browse repositories that are already analyzed.
          </StateMessage>
        ) : hasCode(error, "github_unavailable") ? (
          <StateMessage kind="unavailable" title="GitHub is unavailable" action={{ href: `/repo/${owner}/${name}`, label: "Try again" }}>
            We couldn&apos;t reach the GitHub API. This is usually temporary.
          </StateMessage>
        ) : (
          <StateMessage kind="error" title="Something went wrong" action={{ href: "/explore", label: "Back to the graveyard" }}>
            We couldn&apos;t load this repository. Check that PostgreSQL is running and try again.
          </StateMessage>
        )}
      </div>
    );
  }

  const repository = loaded.repository;
  if (repository.owner !== owner || repository.name !== name) permanentRedirect(`/repo/${repository.owner}/${repository.name}`);

  await requestDeepAnalysis(repository, { schedule: (task) => after(task) }).catch((e) => console.error("[repo] analysis request failed", e));

  const detail = await getRepositoryDetail(repository.owner, repository.name, user?.id);
  if (!detail) notFound();
  const analysis = readAnalysis(detail);
  const data = detail.snapshotData;
  const deep = analysis?.depth === "DEEP";
  const pending = analysis?.status === "RUNNING" || analysis?.status === "PENDING";
  const status = statusFor(detail.lastActivityAt, detail.archived);

  const report = buildActivityReport(data?.commitActivity?.monthly ?? null, new Date());
  const timeline = deep
    ? buildTimeline({
        createdAt: detail.ghCreatedAt.toISOString(),
        releases: data?.releases ?? [],
        report,
        lastCommitAt: detail.lastCommitAt?.toISOString() ?? null,
        lastReleaseAt: detail.lastReleaseAt?.toISOString() ?? null,
        archived: detail.archived,
        pushedAt: detail.pushedAt.toISOString(),
      })
    : [];

  const aiStatus = await getAiStatus((await cookies()).get(AI_COOKIE)?.value).catch(() => null);
  const [collections, memberOf] = user ? await Promise.all([listCollections(user.id), collectionsContaining(user.id, detail.id)]) : [[], []];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {pending && <AnalysisPoller owner={detail.owner} name={detail.name} />}
      <div className="grid gap-10 lg:grid-cols-[10rem_minmax(0,1fr)]">
        <nav aria-label="On this page" className="hidden lg:block">
          <ul className="sticky top-24 grid gap-0.5 text-sm">
            {NAV.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="block rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:text-foreground">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-12">
          <div className="space-y-6">
            <RepoHeader
              repo={detail}
              data={data}
              actions={<SaveButton owner={detail.owner} name={detail.name} signedIn={Boolean(user)} collections={collections.map((c) => ({ id: c.id, name: c.name, isDefault: c.isDefault }))} initial={memberOf} />}
            />
            <StatusBanner repo={detail} />
            <AnalysisBanner analysis={analysis} />
            {detail.resurrectionsAsRevival[0] && (
              <p className="surface px-5 py-3 text-sm text-muted-foreground">
                This repository is registered as a resurrection of{" "}
                <a className="text-grave-green hover:underline" href={`/repo/${detail.resurrectionsAsRevival[0].original.owner}/${detail.resurrectionsAsRevival[0].original.name}`}>
                  {detail.resurrectionsAsRevival[0].original.owner}/{detail.resurrectionsAsRevival[0].original.name}
                </a>
                .
              </p>
            )}
          </div>

          {analysis && (
            <>
              {analysis.summary && (
                <section aria-label="What this project does" className="max-w-3xl space-y-1.5">
                  <h2 className="text-sm font-medium text-muted-foreground">What it did</h2>
                  <p className="text-lg leading-relaxed">{analysis.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {analysis.summarySource === "readme" || analysis.summarySource === "description" ? "Taken from the README." : analysis.summarySource ? `Summarized by ${analysis.summarySource} from the README.` : ""}
                  </p>
                </section>
              )}

              <Section id="scores" title="Scores" automatic>
                <ScoresSection analysis={analysis} />
              </Section>

              <Section id="insight" title="AI insight" description="Optional. Uses your own ChatGPT plan or API key.">
                <InsightPanel repo={`${detail.owner}/${detail.name}`} connected={Boolean(aiStatus?.connection)} label={aiStatus?.connection?.label ?? null} />
              </Section>

              <Section id="timeline" title="Timeline" description="From the first commit to the last sign of life." automatic>
                {deep && timeline.length > 0 ? <Timeline events={timeline} /> : <p className="surface p-5 text-sm text-muted-foreground">{pending ? "The timeline appears once the analysis finishes." : "No timeline available yet."}</p>}
              </Section>

              <Section id="activity" title="Activity graph" description="Commits per month over the project's life. The shaded band marks when it started to die." automatic>
                {report && data ? (
                  <div className="surface p-5">
                    <ActivityChart
                      series={report.series}
                      releases={data.releases.map((r) => ({ tag: r.tag, publishedAt: r.publishedAt, prerelease: r.prerelease }))}
                      issues={data.recentItemsByMonth.issues}
                      pullRequests={data.recentItemsByMonth.pullRequests}
                      peak={report.peak}
                      declineStart={report.declineStart}
                      lastActiveMonth={report.lastActiveMonth}
                    />
                    <p className="mt-3 text-xs text-muted-foreground">
                      Commit counts come from GitHub&apos;s contributor statistics for the default branch. Issues and pull requests are drawn from the {data.issueSample.length} most recent items, so older months are not covered.
                    </p>
                  </div>
                ) : (
                  <p className="surface p-5 text-sm text-muted-foreground">
                    {pending ? "The activity graph appears once the analysis finishes." : data ? "GitHub had not finished computing commit statistics for this repository. Re-run the analysis in a few minutes." : "No commit history yet."}
                  </p>
                )}
              </Section>

              {status !== "active" && (
                <Section id="why" title="Why it appears abandoned" automatic>
                  <WhyAbandoned analysis={analysis} />
                </Section>
              )}

              <Section id="community" title="Is the community still alive?" automatic>
                {deep ? <CommunityAlive analysis={analysis} /> : <p className="surface p-5 text-sm text-muted-foreground">Demand signals are measured by the full analysis.</p>}
              </Section>

              <Section id="forks" title="Active forks" description="Descendants that kept receiving commits after the original went quiet." automatic>
                <ActiveForks repo={detail} failed={Boolean(analysis.failed.includes("forks"))} />
              </Section>

              <Section id="revival" title="Revival analysis" automatic>
                <RevivalAnalysis analysis={analysis} />
              </Section>

              <Section id="archaeology" title="Technology archaeology" description="Old technology we dug up, and what people use today." automatic>
                <TechnologyArchaeology analysis={analysis} />
              </Section>

              <Section id="issues" title="Issues worth solving" automatic>
                <IssuesWorth issues={analysis.issues} deep={deep} />
              </Section>

              <Section id="roadmap" title="Revival roadmap" automatic>
                <RevivalRoadmap phases={analysis.roadmap} />
              </Section>
            </>
          )}

          <Section id="claim" title="Bring it back">
            <ClaimSection repo={detail} user={user} />
          </Section>

          {analysis && analysis.notes.length > 0 && (
            <aside className="text-xs text-muted-foreground">
              <p className="mb-1 font-medium">Analysis notes</p>
              <ul className="grid gap-0.5">
                {analysis.notes.slice(0, 6).map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
