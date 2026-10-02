import { assertSameOrigin, json, readJson, route } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/services/auth-service";
import { deleteCollection, updateCollection } from "@/services/collection-service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  enforceRateLimit(request, "collections-write", 30);
  const user = await requireUser();
  const { id } = await params;
  const collection = await updateCollection(user.id, id, await readJson(request));
  return json({ id: collection.id, name: collection.name, description: collection.description, isPublic: collection.isPublic });
});

export const DELETE = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  enforceRateLimit(request, "collections-write", 30);
  const user = await requireUser();
  const { id } = await params;
  await deleteCollection(user.id, id);
  return json({ ok: true });
});
