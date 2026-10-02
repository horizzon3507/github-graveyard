import { after } from "next/server";
import { z } from "zod";
import { assertSameOrigin, json, readJson, route } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";
import { parseOrThrow, parseRepoInput } from "@/lib/validation";
import { ensureRepository } from "@/services/repository-service";
import { requestDeepAnalysis } from "@/services/analysis-service";
import { db } from "@/database/client";

export const dynamic = "force-dynamic";

const body = z.object({ url: z.string().trim().min(3).max(300), refresh: z.boolean().optional() });

export const POST = route(async (request) => {
  assertSameOrigin(request);
  enforceRateLimit(request, "analyze", 12);
  const { url, refresh } = parseOrThrow(body, await readJson(request));
  const ref = parseRepoInput(url);
  if (!ref) throw new AppError("invalid_input", "Paste a repository URL like https://github.com/owner/repository.");

  const repository = await ensureRepository(ref.owner, ref.name, "ANALYZE");
  const analysis = await db.repositoryAnalysis.findUnique({ where: { repositoryId: repository.id }, select: { lastAnalyzedAt: true } });
  const forced = Boolean(refresh) && (!analysis?.lastAnalyzedAt || Date.now() - analysis.lastAnalyzedAt.getTime() > 3600_000);
  const outcome = await requestDeepAnalysis(repository, { force: forced, schedule: (task) => after(task) });
  return json({ owner: repository.owner, name: repository.name, path: `/repo/${repository.owner}/${repository.name}`, analysis: outcome }, { status: 202 });
});
