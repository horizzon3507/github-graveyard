import { z } from "zod";
import { assertSameOrigin, json, readJson, route } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readRepoParams, type RepoParams } from "@/lib/repo-route";
import { parseOrThrow } from "@/lib/validation";
import { requireUser } from "@/services/auth-service";
import { registerResurrection, removeResurrection } from "@/services/community-service";

export const dynamic = "force-dynamic";

export const POST = route<RepoParams>(async (request, context) => {
  assertSameOrigin(request);
  enforceRateLimit(request, "resurrection", 10);
  const user = await requireUser();
  const { owner, name } = await readRepoParams(context);
  return json(await registerResurrection(user, owner, name, await readJson(request)), { status: 201 });
});

export const DELETE = route<RepoParams>(async (request, context) => {
  assertSameOrigin(request);
  enforceRateLimit(request, "resurrection", 10);
  const user = await requireUser();
  await readRepoParams(context);
  const { id } = parseOrThrow(z.object({ id: z.string().min(1).max(40) }), await readJson(request));
  await removeResurrection(user, id);
  return json({ ok: true });
});
