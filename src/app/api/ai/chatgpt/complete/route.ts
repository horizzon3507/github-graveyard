import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, readJson, route } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parseOrThrow } from "@/lib/validation";
import { AI_ATTEMPT_COOKIE, AI_COOKIE, aiCookieOptions, callbackFromPaste, completeChatGPT, findConnection, getCookie, readAttempt } from "@/services/ai-connection-service";

export const dynamic = "force-dynamic";

const body = z.object({ callbackUrl: z.string().trim().min(10).max(2000) });

/** Remote instances cannot receive the 127.0.0.1 callback, so the user pastes the address the browser ended on. */
export const POST = route(async (request) => {
  assertSameOrigin(request);
  enforceRateLimit(request, "ai-chatgpt-complete", 10);
  const { callbackUrl } = parseOrThrow(body, await readJson(request));
  const pending = readAttempt(getCookie(request, AI_ATTEMPT_COOKIE));
  const params = callbackFromPaste(pending, callbackUrl);
  const existing = await findConnection(getCookie(request, AI_COOKIE));
  const result = await completeChatGPT(existing, pending, params);
  const response = NextResponse.json({ connected: true, label: result.label, model: result.model });
  if (result.cookieValue) response.cookies.set(AI_COOKIE, result.cookieValue, aiCookieOptions());
  response.cookies.delete(AI_ATTEMPT_COOKIE);
  return response;
});
