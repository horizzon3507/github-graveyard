import { assertSameOrigin, json, route } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readRepoParams, type RepoParams } from "@/lib/repo-route";
import { requireUser } from "@/services/auth-service";
import { addToCollection, ensureDefaultCollection, removeFromCollection } from "@/services/collection-service";

export const dynamic = "force-dynamic";

export const POST = route<RepoParams>(async (request, context) => {
  assertSameOrigin(request);
  enforceRateLimit(request, "save", 60);
  const user = await requireUser();
  const { owner, name } = await readRepoParams(context);
  const collection = await ensureDefaultCollection(user.id);
  await addToCollection(user.id, collection.id, `${owner}/${name}`);
  return json({ saved: true });
});

export const DELETE = route<RepoParams>(async (request, context) => {
  assertSameOrigin(request);
  enforceRateLimit(request, "save", 60);
  const user = await requireUser();
  const { owner, name } = await readRepoParams(context);
  const collection = await ensureDefaultCollection(user.id);
  await removeFromCollection(user.id, collection.id, `${owner}/${name}`);
  return json({ saved: false });
});
