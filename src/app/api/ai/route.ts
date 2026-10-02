import { NextResponse } from "next/server";
import { assertSameOrigin, json, route } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { AI_COOKIE, disconnect, findConnection, getAiStatus, getCookie } from "@/services/ai-connection-service";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  enforceRateLimit(request, "ai-status", 60);
  return json(await getAiStatus(getCookie(request, AI_COOKIE)));
});

export const DELETE = route(async (request) => {
  assertSameOrigin(request);
  enforceRateLimit(request, "ai-write", 20);
  const row = await findConnection(getCookie(request, AI_COOKIE));
  if (row) await disconnect(row);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(AI_COOKIE);
  return response;
});
