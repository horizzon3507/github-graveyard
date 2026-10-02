import { NextResponse } from "next/server";
import { buildAuthorizeUrl, newOAuthState, OAUTH_COOKIE, oauthCookieOptions } from "@/services/auth-service";
import { isGitHubOAuthConfigured } from "@/lib/env";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const base = env().APP_URL;
  if (!isGitHubOAuthConfigured()) return NextResponse.redirect(new URL("/login?error=not_configured", base));
  const next = new URL(request.url).searchParams.get("next");
  const { state, cookie } = newOAuthState(next);
  const response = NextResponse.redirect(buildAuthorizeUrl(state));
  response.cookies.set(OAUTH_COOKIE, cookie, oauthCookieOptions());
  return response;
}
