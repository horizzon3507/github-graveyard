import { json, route } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";
import { readRepoParams, type RepoParams } from "@/lib/repo-route";
import { getRepositoryDetail } from "@/database/repository-detail";
import { buildActivityReport, buildTimeline } from "@/analysis/activity";

export const dynamic = "force-dynamic";

export const GET = route<RepoParams>(async (request, context) => {
  enforceRateLimit(request, "activity", 60);
  const { owner, name } = await readRepoParams(context);
  const detail = await getRepositoryDetail(owner, name);
  if (!detail) throw new AppError("not_found", "Repository not found. Analyze it first.");
  const data = detail.snapshotData;
  if (!data) return json({ available: false, reason: "Full analysis has not completed yet." }, { status: 202 });

  const report = buildActivityReport(data.commitActivity?.monthly ?? null, new Date());
  return json({
    available: Boolean(report),
    report,
    releases: data.releases.map((r) => ({ tag: r.tag, publishedAt: r.publishedAt, prerelease: r.prerelease })),
    issuesByMonth: data.recentItemsByMonth.issues,
    pullRequestsByMonth: data.recentItemsByMonth.pullRequests,
    sampled: { issuesAndPullRequests: data.issueSample.length },
    timeline: buildTimeline({
      createdAt: detail.ghCreatedAt.toISOString(),
      releases: data.releases,
      report,
      lastCommitAt: detail.lastCommitAt?.toISOString() ?? null,
      lastReleaseAt: detail.lastReleaseAt?.toISOString() ?? null,
      archived: detail.archived,
      pushedAt: detail.pushedAt.toISOString(),
    }),
  });
});
