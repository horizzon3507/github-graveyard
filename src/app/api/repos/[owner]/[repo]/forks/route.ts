import { json, route } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";
import { readRepoParams, type RepoParams } from "@/lib/repo-route";
import { db } from "@/database/client";
import { toSlug } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = route<RepoParams>(async (request, context) => {
  enforceRateLimit(request, "forks", 60);
  const { owner, name } = await readRepoParams(context);
  const repository = await db.repository.findUnique({
    where: { slug: toSlug(owner, name) },
    select: { defaultBranch: true, activeForkCount: true, forks: true, forkList: { orderBy: [{ isActive: "desc" }, { stars: "desc" }] } },
  });
  if (!repository) throw new AppError("not_found", "Repository not found. Analyze it first.");
  return json({
    totalForks: repository.forks,
    activeForks: repository.activeForkCount,
    forks: repository.forkList.map((f) => ({
      fullName: f.fullName,
      url: f.htmlUrl,
      description: f.description,
      stars: f.stars,
      isActive: f.isActive,
      aheadBy: f.aheadBy,
      behindBy: f.behindBy,
      recentCommits: f.recentCommits,
      contributors: f.contributors,
      lastCommitAt: f.lastCommitAt,
      compareUrl: `https://github.com/${owner}/${name}/compare/${repository.defaultBranch}...${f.fullName.split("/")[0]}:${f.defaultBranch}`,
    })),
  });
});
