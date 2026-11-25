import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, readJson, route } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parseOrThrow } from "@/lib/validation";
import { AI_COOKIE, aiCookieOptions, findConnection, getCookie, saveApiKey } from "@/services/ai-connection-service";

export const dynamic = "force-dynamic";

const body = z.object({ provider: z.string().min(2).max(20), apiKey: z.string().min(8).max(400), model: z.string().trim().max(80).optional() });

export const POST = route(async (request) => {
  assertSameOrigin(request);
  enforceRateLimit(request, "ai-key", 8);
  const input = parseOrThrow(body, await readJson(request));
  const existing = await findConnection(getCookie(request, AI_COOKIE));
  const { cookieValue } = await saveApiKey(existing, input);
  const response = NextResponse.json({ connected: true, provider: input.provider });
  if (cookieValue) response.cookies.set(AI_COOKIE, cookieValue, aiCookieOptions());
  return response;
});
