import { assertSameOrigin, json, readJson, route } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/services/auth-service";
import { createCollection, listCollections } from "@/services/collection-service";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  enforceRateLimit(request, "collections", 60);
  const user = await requireUser();
  const collections = await listCollections(user.id);
  return json({ collections: collections.map((c) => ({ id: c.id, name: c.name, description: c.description, isPublic: c.isPublic, isDefault: c.isDefault, count: c._count.items })) });
});

export const POST = route(async (request) => {
  assertSameOrigin(request);
  enforceRateLimit(request, "collections-write", 30);
  const user = await requireUser();
  const collection = await createCollection(user.id, await readJson(request));
  return json({ id: collection.id, name: collection.name }, { status: 201 });
});
