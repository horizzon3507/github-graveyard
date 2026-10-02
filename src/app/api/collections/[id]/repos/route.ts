import { z } from "zod";
import { assertSameOrigin, json, readJson, route } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parseOrThrow } from "@/lib/validation";
import { requireUser } from "@/services/auth-service";
import { addToCollection, removeFromCollection } from "@/services/collection-service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const body = z.object({ repo: z.string().trim().min(3).max(300), note: z.string().trim().max(280).optional() });

export const POST = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  enforceRateLimit(request, "collections-write", 60);
  const user = await requireUser();
  const { id } = await params;
  const { repo, note } = parseOrThrow(body, await readJson(request));
  const repository = await addToCollection(user.id, id, repo, note);
  return json({ added: `${repository.owner}/${repository.name}` }, { status: 201 });
});

export const DELETE = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  enforceRateLimit(request, "collections-write", 60);
  const user = await requireUser();
  const { id } = await params;
  const { repo } = parseOrThrow(body, await readJson(request));
  await removeFromCollection(user.id, id, repo);
  return json({ ok: true });
});
