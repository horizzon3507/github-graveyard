import { NextResponse } from "next/server";
import { assertSameOrigin, route } from "@/lib/api";
import { destroySession, SESSION_COOKIE } from "@/services/auth-service";

export const dynamic = "force-dynamic";

export const POST = route(async (request) => {
  assertSameOrigin(request);
  const token = request.headers.get("cookie")?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1];
  await destroySession(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
});
