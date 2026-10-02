import { after } from "next/server";
import { json, route } from "@/lib/api";
import { assertCronAuthorized } from "@/lib/cron";
import { refreshAnalyses } from "@/services/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = route(async (request) => {
  assertCronAuthorized(request);
  const limit = Math.min(25, Number(new URL(request.url).searchParams.get("limit")) || 5);
  after(async () => {
    const result = await refreshAnalyses(limit);
    console.log("[refresh]", result);
  });
  return json({ accepted: true, limit }, { status: 202 });
});
