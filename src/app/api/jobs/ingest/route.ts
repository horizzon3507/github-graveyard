import { after } from "next/server";
import { json, route } from "@/lib/api";
import { assertCronAuthorized } from "@/lib/cron";
import { runIngest } from "@/services/discovery";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = route(async (request) => {
  assertCronAuthorized(request);
  const maxQueries = Number(new URL(request.url).searchParams.get("maxQueries")) || 10;
  after(async () => {
    const result = await runIngest({ maxQueries });
    console.log("[ingest]", result);
  });
  return json({ accepted: true, maxQueries }, { status: 202 });
});
