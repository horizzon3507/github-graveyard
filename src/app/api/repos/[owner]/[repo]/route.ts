import { after } from "next/server";
import { json, route } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";
import { readRepoParams, type RepoParams } from "@/lib/repo-route";
import { ensureRepository } from "@/services/repository-service";
import { requestDeepAnalysis } from "@/services/analysis-service";
import { getRepositoryDetail } from "@/database/repository-detail";
import { toRepositoryDto } from "@/services/repository-dto";

export const dynamic = "force-dynamic";

export const GET = route<RepoParams>(async (request, context) => {
  enforceRateLimit(request, "repo", 60);
  const { owner, name } = await readRepoParams(context);
  const repository = await ensureRepository(owner, name);
  await requestDeepAnalysis(repository, { schedule: (task) => after(task) });
  const detail = await getRepositoryDetail(repository.owner, repository.name);
  if (!detail) throw new AppError("not_found", "Repository not found.");
  return json(toRepositoryDto(detail));
});
