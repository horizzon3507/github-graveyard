import { assertSameOrigin, json, readJson, route } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/services/auth-service";
import { updateProfile } from "@/services/community-service";

export const dynamic = "force-dynamic";

export const PATCH = route(async (request) => {
  assertSameOrigin(request);
  enforceRateLimit(request, "profile", 20);
  const user = await requireUser();
  return json(await updateProfile(user, await readJson(request)));
});
