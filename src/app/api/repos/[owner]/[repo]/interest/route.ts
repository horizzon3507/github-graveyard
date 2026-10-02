import { assertSameOrigin, json, readJson, route } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readRepoParams, type RepoParams } from "@/lib/repo-route";
import { requireUser } from "@/services/auth-service";
import { declareInterest, withdrawInterest } from "@/services/community-service";

export const dynamic = "force-dynamic";

export const POST = route<RepoParams>(async (request, context) => {
  assertSameOrigin(request);
  enforceRateLimit(request, "interest", 20);
  const user = await requireUser();
  const { owner, name } = await readRepoParams(context);
  const body = request.headers.get("content-length") === "0" ? {} : await readJson(request).catch(() => ({}));
  return json(await declareInterest(user, owner, name, body));
});

export const DELETE = route<RepoParams>(async (request, context) => {
  assertSameOrigin(request);
  enforceRateLimit(request, "interest", 20);
  const user = await requireUser();
  const { owner, name } = await readRepoParams(context);
  return json(await withdrawInterest(user, owner, name));
});
