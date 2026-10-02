import "server-only";
import type { AiConnection } from "@/generated/prisma/client";
import { db } from "@/database/client";
import { decrypt, deriveHostId, encrypt, randomToken, sha256 } from "@/lib/crypto";
import { env, isChatGPTPlanEnabled, isEncryptionConfigured } from "@/lib/env";
import { AppError } from "@/lib/errors";
import type { AIProvider } from "@/providers/ai/types";
import {
  ChatGPTPlanProvider,
  buildAuthorizeUrl,
  exchangeCode,
  localRedirectUri,
  newPendingAuthorization,
  parseCallbackUrl,
  pickModel,
  refreshCredentials,
  revokeRefreshToken,
  REMOTE_CALLBACK_PORT,
  type CallbackParams,
  type ChatGPTCredentials,
  type PendingAuthorization,
} from "@/providers/ai/chatgpt";
import { createByokProvider, isByokProvider } from "@/providers/ai/byok";

export const AI_COOKIE = "gg_ai";
export const AI_ATTEMPT_COOKIE = "gg_ai_oauth";
const COOKIE_DAYS = 90;
const REFRESH_MARGIN_MS = 120_000;

type Stored = { kind: "CHATGPT"; creds: ChatGPTCredentials } | { kind: "API_KEY"; apiKey: string };

export interface AiStatus {
  chatgptAvailable: boolean;
  keysAvailable: boolean;
  connection: { kind: "CHATGPT" | "API_KEY"; provider: string; label: string | null; model: string | null } | null;
}

export function getCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return undefined;
}

export const aiCookieOptions = () => ({ httpOnly: true, sameSite: "lax" as const, secure: env().APP_URL.startsWith("https://"), path: "/", maxAge: COOKIE_DAYS * 86_400 });
export const attemptCookieOptions = () => ({ ...aiCookieOptions(), maxAge: 600 });

export async function findConnection(cookieValue: string | undefined): Promise<AiConnection | null> {
  if (!cookieValue || cookieValue.length > 200) return null;
  const [id, secret] = cookieValue.split(".");
  if (!id || !secret) return null;
  const row = await db.aiConnection.findUnique({ where: { id } });
  return row && row.secretHash === sha256(secret) ? row : null;
}

export async function getAiStatus(cookieValue: string | undefined): Promise<AiStatus> {
  const row = isEncryptionConfigured() ? await findConnection(cookieValue).catch(() => null) : null;
  return {
    chatgptAvailable: isChatGPTPlanEnabled(),
    keysAvailable: isEncryptionConfigured(),
    connection: row ? { kind: row.kind as "CHATGPT" | "API_KEY", provider: row.provider, label: row.label, model: row.model } : null,
  };
}

function readStored(row: AiConnection): Stored {
  return JSON.parse(decrypt(row.data, env().ENCRYPTION_KEY)) as Stored;
}

/** Creates or updates the visitor's connection. Returns a cookie value only when a new one is minted. */
async function persist(existing: AiConnection | null, fields: { kind: string; provider: string; label: string | null; model: string | null; stored: Stored; expiresAt: Date | null }) {
  const data = encrypt(JSON.stringify(fields.stored), env().ENCRYPTION_KEY);
  const base = { kind: fields.kind, provider: fields.provider, label: fields.label, model: fields.model, data, expiresAt: fields.expiresAt };
  if (existing) {
    await db.aiConnection.update({ where: { id: existing.id }, data: base });
    return { cookieValue: null as string | null };
  }
  const secret = randomToken(32);
  const created = await db.aiConnection.create({ data: { ...base, secretHash: sha256(secret) } });
  return { cookieValue: `${created.id}.${secret}` };
}

function requireEncryption() {
  if (!isEncryptionConfigured()) throw new AppError("forbidden", "AI connections are disabled: set ENCRYPTION_KEY to enable them.");
}

export async function saveApiKey(existing: AiConnection | null, input: { provider: string; apiKey: string; model?: string }) {
  requireEncryption();
  if (!isByokProvider(input.provider)) throw new AppError("invalid_input", "Unsupported AI provider.");
  const apiKey = input.apiKey.trim();
  if (apiKey.length < 8 || apiKey.length > 400 || /\s/.test(apiKey)) throw new AppError("invalid_input", "That doesn't look like an API key.");
  const provider = createByokProvider(input.provider, apiKey, input.model);
  try {
    await provider.complete({ system: "Reply with the single word OK.", prompt: "ping", maxTokens: 8 });
  } catch (error) {
    throw new AppError("unauthorized", `The provider rejected this key or model${error instanceof Error ? ` (${error.message})` : ""}.`);
  }
  const model = input.model?.trim() || null;
  return persist(existing, { kind: "API_KEY", provider: input.provider, label: `${input.provider} key ending ${apiKey.slice(-4)}`, model, stored: { kind: "API_KEY", apiKey }, expiresAt: null });
}

export function startChatGPT(request: Request, existing: AiConnection | null) {
  if (!isChatGPTPlanEnabled()) throw new AppError("forbidden", "ChatGPT plan sign-in is disabled on this instance.");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const local = /^127\.0\.0\.1:(\d{2,5})$/.exec(host);
  const mode = local ? "local" : "paste";
  const redirectUri = localRedirectUri(local ? local[1] : REMOTE_CALLBACK_PORT);

  let creds: ChatGPTCredentials | null = null;
  if (existing?.kind === "CHATGPT") creds = (readStored(existing) as Extract<Stored, { kind: "CHATGPT" }>).creds;
  const pending = newPendingAuthorization(redirectUri, mode, creds?.clientId ?? null);
  const hostId = deriveHostId(env().ENCRYPTION_KEY);
  const authorizeUrl = buildAuthorizeUrl(pending, hostId, creds ? { idToken: creds.idToken, email: creds.email } : undefined);
  return { authorizeUrl, mode, redirectUri, attemptCookie: encrypt(JSON.stringify(pending), env().ENCRYPTION_KEY) };
}

export function readAttempt(cookieValue: string | undefined): PendingAuthorization {
  if (!cookieValue) throw new AppError("unauthorized", "This sign-in attempt expired. Start again.");
  try {
    return JSON.parse(decrypt(cookieValue, env().ENCRYPTION_KEY)) as PendingAuthorization;
  } catch {
    throw new AppError("unauthorized", "This sign-in attempt expired. Start again.");
  }
}

export function callbackFromPaste(pending: PendingAuthorization, pasted: string): CallbackParams {
  return parseCallbackUrl(pasted, pending.redirectUri);
}

export async function completeChatGPT(existing: AiConnection | null, pending: PendingAuthorization, params: CallbackParams) {
  if (!isChatGPTPlanEnabled()) throw new AppError("forbidden", "ChatGPT plan sign-in is disabled on this instance.");
  const hostId = deriveHostId(env().ENCRYPTION_KEY);
  const previous = existing?.kind === "CHATGPT" ? (readStored(existing) as Extract<Stored, { kind: "CHATGPT" }>).creds : null;
  const creds = await exchangeCode(pending, params, hostId, previous?.subject);
  const model = await pickModel(creds.accessToken);
  const saved = await persist(existing, { kind: "CHATGPT", provider: "chatgpt", label: creds.email ?? "ChatGPT account", model, stored: { kind: "CHATGPT", creds }, expiresAt: new Date(creds.expiresAt) });
  return { ...saved, label: creds.email, model };
}

async function chatgptAccessToken(row: AiConnection): Promise<string> {
  const stored = readStored(row);
  if (stored.kind !== "CHATGPT") throw new AppError("internal", "Not a ChatGPT connection.");
  if (stored.creds.expiresAt - Date.now() > REFRESH_MARGIN_MS) return stored.creds.accessToken;

  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${row.id}))`;
      const fresh = await tx.aiConnection.findUnique({ where: { id: row.id } });
      if (!fresh) throw new AppError("unauthorized", "The AI connection was removed.");
      const current = (readStored(fresh) as Extract<Stored, { kind: "CHATGPT" }>).creds;
      if (current.expiresAt - Date.now() > REFRESH_MARGIN_MS) return current.accessToken;
      let refreshed: ChatGPTCredentials;
      try {
        refreshed = await refreshCredentials(current);
      } catch (error) {
        if (error instanceof AppError && error.details?.oauth === "invalid_grant") {
          await tx.aiConnection.delete({ where: { id: row.id } });
          throw new AppError("unauthorized", "Your ChatGPT session expired. Connect ChatGPT again.");
        }
        throw error;
      }
      await tx.aiConnection.update({ where: { id: row.id }, data: { data: encrypt(JSON.stringify({ kind: "CHATGPT", creds: refreshed } satisfies Stored), env().ENCRYPTION_KEY), expiresAt: new Date(refreshed.expiresAt) } });
      return refreshed.accessToken;
    },
    { timeout: 30_000 },
  );
}

export function providerFor(row: AiConnection): AIProvider {
  requireEncryption();
  if (row.kind === "CHATGPT") return new ChatGPTPlanProvider(() => chatgptAccessToken(row), row.model ?? "gpt-6.1-sol");
  const stored = readStored(row);
  if (stored.kind !== "API_KEY") throw new AppError("internal", "Unexpected connection type.");
  return createByokProvider(row.provider, stored.apiKey, row.model ?? undefined);
}

export async function touch(row: AiConnection) {
  await db.aiConnection.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
}

export async function disconnect(row: AiConnection) {
  if (row.kind === "CHATGPT") {
    const stored = readStored(row);
    if (stored.kind === "CHATGPT") await revokeRefreshToken(stored.creds);
  }
  await db.aiConnection.delete({ where: { id: row.id } });
}
