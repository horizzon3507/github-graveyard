import { NextResponse } from "next/server";
import { assertSameOrigin, route } from "@/lib/api";
import { destroySession, sessionCookieName } from "@/services/auth-service";

export const dynamic = "force-dynamic";

export const POST = route(async (request) => {
  assertSameOrigin(request);
  const name = sessionCookieName();
  const token = request.headers.get("cookie")?.match(new RegExp(`${name}=([^;]+)`))?.[1];
  await destroySession(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(name);
  return response;
});
