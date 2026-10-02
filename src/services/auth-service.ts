import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import type { User } from "@/generated/prisma/client";
import { db } from "@/database/client";
import { env, isGitHubOAuthConfigured } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { safeRelativePath } from "@/lib/validation";

export const SESSION_COOKIE = "gg_session";
export const OAUTH_COOKIE = "gg_oauth";
const SESSION_DAYS = 30;

export type SessionUser = Omit<User, "githubId">;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const secure = () => env().APP_URL.startsWith("https://");

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 128) return null;
  const session = await db.session.findUnique({ where: { tokenHash: hash(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { githubId, ...user } = session.user;
  return user;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("unauthorized", "Sign in with GitHub to do this.");
  return user;
}

export function buildAuthorizeUrl(state: string): string {
  const e = env();
  const params = new URLSearchParams({
    client_id: e.GITHUB_CLIENT_ID ?? "",
    redirect_uri: `${e.APP_URL.replace(/\/$/, "")}/api/auth/callback/github`,
    state,
    scope: "read:user",
    allow_signup: "true",
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export function newOAuthState(next: string | null) {
  const state = randomBytes(24).toString("hex");
  const value = Buffer.from(JSON.stringify({ state, next: safeRelativePath(next) })).toString("base64url");
  return { state, cookie: value };
}

export function readOAuthCookie(value: string | undefined): { state: string; next: string } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { state?: string; next?: string };
    if (typeof parsed.state !== "string") return null;
    return { state: parsed.state, next: safeRelativePath(parsed.next) };
  } catch {
    return null;
  }
}

export const oauthCookieOptions = () => ({ httpOnly: true, sameSite: "lax" as const, secure: secure(), path: "/", maxAge: 600 });

export const sessionCookieOptions = () => ({ httpOnly: true, sameSite: "lax" as const, secure: secure(), path: "/", maxAge: SESSION_DAYS * 86_400 });

interface GitHubUserResponse {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
}

/** Exchanges the OAuth code, upserts the user and returns a fresh session token. */
export async function completeLogin(code: string): Promise<string> {
  if (!isGitHubOAuthConfigured()) throw new AppError("internal", "GitHub OAuth is not configured.");
  const e = env();
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: e.GITHUB_CLIENT_ID, client_secret: e.GITHUB_CLIENT_SECRET, code, redirect_uri: `${e.APP_URL.replace(/\/$/, "")}/api/auth/callback/github` }),
    signal: AbortSignal.timeout(15_000),
  });
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenRes.ok || !tokenJson.access_token) throw new AppError("unauthorized", "GitHub did not accept the sign-in code.");

  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "github-graveyard" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!userRes.ok) throw new AppError("unauthorized", "Could not read your GitHub profile.");
  const profile = (await userRes.json()) as GitHubUserResponse;

  const data = { login: profile.login, loginLower: profile.login.toLowerCase(), name: profile.name, avatarUrl: profile.avatar_url, htmlUrl: profile.html_url, bio: profile.bio };
  const user = await db.user.upsert({ where: { githubId: BigInt(profile.id) }, create: { githubId: BigInt(profile.id), ...data }, update: data });

  const token = randomBytes(32).toString("base64url");
  await db.session.create({ data: { tokenHash: hash(token), userId: user.id, expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000) } });
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return token;
}

export async function destroySession(token: string | undefined) {
  if (!token) return;
  await db.session.deleteMany({ where: { tokenHash: hash(token) } });
}

/** Creates a session for an existing user. Used by tests and local tooling only. */
export async function createSessionForUser(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.session.create({ data: { tokenHash: hash(token), userId, expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000) } });
  return token;
}
