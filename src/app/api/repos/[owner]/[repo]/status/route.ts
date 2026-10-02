import { json, route } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";
import { readRepoParams, type RepoParams } from "@/lib/repo-route";
import { db } from "@/database/client";
import { toSlug } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = route<RepoParams>(async (request, context) => {
  enforceRateLimit(request, "status", 120);
  const { owner, name } = await readRepoParams(context);
  const repository = await db.repository.findUnique({ where: { slug: toSlug(owner, name) }, select: { analysis: { select: { status: true, depth: true, error: true, lastAnalyzedAt: true } } } });
  if (!repository?.analysis) throw new AppError("not_found", "Repository not found.");
  return json(repository.analysis);
});
