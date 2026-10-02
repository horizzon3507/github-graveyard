import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

/** Job endpoints are disabled unless CRON_SECRET is set, and require it as a bearer token. */
export function assertCronAuthorized(request: Request) {
  const secret = env().CRON_SECRET;
  if (!secret) throw new AppError("forbidden", "Job endpoints are disabled: set CRON_SECRET to enable them.");
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new AppError("unauthorized", "Invalid job credentials.");
}
