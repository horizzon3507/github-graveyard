import { NextResponse } from "next/server";
import { assertSameOrigin, route } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { AI_ATTEMPT_COOKIE, AI_COOKIE, attemptCookieOptions, findConnection, getCookie, startChatGPT } from "@/services/ai-connection-service";

export const dynamic = "force-dynamic";

export const POST = route(async (request) => {
  assertSameOrigin(request);
  enforceRateLimit(request, "ai-chatgpt-start", 10);
  const existing = await findConnection(getCookie(request, AI_COOKIE));
  const { authorizeUrl, mode, redirectUri, attemptCookie } = startChatGPT(request, existing);
  const response = NextResponse.json({ authorizeUrl, mode, redirectUri });
  response.cookies.set(AI_ATTEMPT_COOKIE, attemptCookie, attemptCookieOptions());
  return response;
});
