import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { AppError } from "@/lib/errors";
import { randomToken } from "@/lib/crypto";
import type { AIProvider, CompletionRequest } from "@/providers/ai/types";

/**
 * "Sign in with ChatGPT" for open-source and self-hosted apps:
 * https://developers.openai.com/siwc/token-sharing-open-source
 * The user authorizes this app to use their ChatGPT plan for Responses API requests.
 */
export const OPENAI_ISSUER = "https://auth.openai.com";
export const AUTHORIZE_URL = `${OPENAI_ISSUER}/api/accounts/authorize`;
export const TOKEN_URL = `${OPENAI_ISSUER}/api/accounts/oauth/token`;
export const RESOURCE = "https://api.openai.com/v1";
export const PLAN_SCOPE = "chatgpt.tokens.use.direct";
export const AGENT_NAME = "GitHub Graveyard";
export const CALLBACK_PATH = "/auth/callback";
export const REMOTE_CALLBACK_PORT = 1455;
export const FALLBACK_MODEL = "gpt-6.1-sol";

export interface ChatGPTCredentials {
  clientId: string;
  hostId: string;
  email: string | null;
  subject: string;
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: string[];
}

export interface PendingAuthorization {
  state: string;
  nonce: string;
  verifier: string;
  redirectUri: string;
  clientId: string | null;
  mode: "local" | "paste";
}

const base64url = (buf: Buffer) => buf.toString("base64url");

export function newPendingAuthorization(redirectUri: string, mode: PendingAuthorization["mode"], clientId: string | null): PendingAuthorization {
  return { state: randomToken(24), nonce: randomToken(24), verifier: randomToken(48), redirectUri, clientId, mode };
}

export function localRedirectUri(port: string | number) {
  return `http://127.0.0.1:${port}${CALLBACK_PATH}`;
}

export function buildAuthorizeUrl(
  pending: PendingAuthorization,
  hostId: string,
  returning?: { idToken?: string; email?: string | null },
): string {
  const params = new URLSearchParams({
    client_id: pending.clientId ?? "dynamic_agent_client",
    ext_agent_host_id: hostId,
    response_type: "code",
    redirect_uri: pending.redirectUri,
    scope: "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct",
    resource: RESOURCE,
    state: pending.state,
    nonce: pending.nonce,
    code_challenge_method: "S256",
    code_challenge: base64url(createHash("sha256").update(pending.verifier).digest()),
  });
  if (!pending.clientId) params.set("agent_name_hint", AGENT_NAME);
  if (returning?.idToken) params.set("id_token_hint", returning.idToken);
  if (returning?.email) params.set("login_hint", returning.email);
  return `${AUTHORIZE_URL}?${params}`;
}

export interface CallbackParams {
  code: string | null;
  state: string | null;
  clientId: string | null;
  error: string | null;
}

/** Accepts the full loopback callback URL pasted by the user. Only the exact loopback shape is valid. */
export function parseCallbackUrl(input: string, expectedRedirectUri: string): CallbackParams {
  let url: URL;
  try {
    const cleaned = input
      .trim()
      .replace(/^["'<]+|["'>]+$/g, "")
      .replace(/&amp;/gi, "&");
    url = new URL(cleaned);
  } catch {
    throw new AppError("invalid_input", "That doesn't look like a URL. Paste the full address from the browser's address bar.");
  }
  const expected = new URL(expectedRedirectUri);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.pathname !== CALLBACK_PATH || url.port !== expected.port) {
    throw new AppError("invalid_input", `Expected an address starting with ${expectedRedirectUri}.`);
  }
  return {
    code: url.searchParams.get("code"),
    state: url.searchParams.get("state"),
    clientId: url.searchParams.get("client_id"),
    error: url.searchParams.get("error"),
  };
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  scope?: string;
}

async function tokenRequest(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    const code = json.error ?? `http_${res.status}`;
    if (code === "invalid_grant") throw new AppError("unauthorized", "The ChatGPT authorization expired or was already used. Connect again.", { oauth: code });
    throw new AppError("unauthorized", `ChatGPT sign-in failed (${code}).`, { oauth: code });
  }
  return json;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

export async function verifyIdToken(idToken: string, clientId: string, nonce: string | null) {
  jwks ??= createRemoteJWKSet(new URL(`${OPENAI_ISSUER}/.well-known/jwks.json`));
  try {
    const { payload } = await jwtVerify(idToken, jwks, { issuer: OPENAI_ISSUER, audience: clientId });
    if (nonce !== null && payload.nonce !== nonce) throw new Error("nonce mismatch");
    return { subject: String(payload.sub), email: typeof payload.email === "string" ? payload.email : null };
  } catch (error) {
    throw new AppError("unauthorized", `Could not verify the ChatGPT identity (${error instanceof Error ? error.message : "invalid token"}).`);
  }
}

function toCredentials(data: TokenResponse, clientId: string, hostId: string, identity: { subject: string; email: string | null }): ChatGPTCredentials {
  const scopes = (data.scope ?? "").split(/\s+/).filter(Boolean);
  if (!scopes.includes(PLAN_SCOPE)) {
    throw new AppError("forbidden", "ChatGPT plan usage was not granted. Connect again and allow plan usage.");
  }
  if (!data.refresh_token || !data.id_token) throw new AppError("unauthorized", "ChatGPT did not return a refresh token. Connect again and allow plan usage.");
  return {
    clientId,
    hostId,
    email: identity.email,
    subject: identity.subject,
    idToken: data.id_token,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    scopes,
  };
}

export async function exchangeCode(pending: PendingAuthorization, params: CallbackParams, hostId: string, expectedSubject?: string): Promise<ChatGPTCredentials> {
  if (params.error) {
    throw new AppError(params.error === "access_denied" ? "forbidden" : "unauthorized", params.error === "access_denied" ? "You declined the ChatGPT authorization." : `ChatGPT returned an error (${params.error}).`);
  }
  if (!params.state || params.state !== pending.state) throw new AppError("unauthorized", "This sign-in attempt expired or does not match. Start again.");
  if (!params.code) throw new AppError("invalid_input", "The address has no authorization code.");
  const clientId = pending.clientId ?? params.clientId;
  if (!clientId || clientId === "dynamic_agent_client") throw new AppError("unauthorized", "Registration did not return a client id. Start again.");
  if (pending.clientId && params.clientId && params.clientId !== pending.clientId) throw new AppError("unauthorized", "Unexpected client id in the callback.");

  const data = await tokenRequest(
    new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, code: params.code, code_verifier: pending.verifier, redirect_uri: pending.redirectUri, resource: RESOURCE }),
  );
  if (!data.id_token) throw new AppError("unauthorized", "ChatGPT did not return an identity token.");
  const identity = await verifyIdToken(data.id_token, clientId, pending.nonce);
  if (expectedSubject && identity.subject !== expectedSubject) throw new AppError("forbidden", "That is a different ChatGPT account than the one already connected. Disconnect first.");
  return toCredentials(data, clientId, hostId, identity);
}

export async function refreshCredentials(creds: ChatGPTCredentials): Promise<ChatGPTCredentials> {
  const data = await tokenRequest(new URLSearchParams({ grant_type: "refresh_token", client_id: creds.clientId, refresh_token: creds.refreshToken, resource: RESOURCE }));
  return {
    ...creds,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? creds.refreshToken,
    idToken: data.id_token ?? creds.idToken,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    scopes: data.scope ? data.scope.split(/\s+/).filter(Boolean) : creds.scopes,
  };
}

export async function revokeRefreshToken(creds: ChatGPTCredentials): Promise<void> {
  try {
    const discovery = (await (await fetch(`${OPENAI_ISSUER}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(10_000) })).json()) as { revocation_endpoint?: string };
    if (!discovery.revocation_endpoint) return;
    await fetch(discovery.revocation_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: creds.refreshToken, token_type_hint: "refresh_token", client_id: creds.clientId }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // best effort: the user can also disconnect the app in ChatGPT settings
  }
}

export async function pickModel(accessToken: string): Promise<string> {
  try {
    const res = await fetch(`${RESOURCE}/models`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15_000), cache: "no-store" });
    if (!res.ok) return FALLBACK_MODEL;
    const json = (await res.json()) as { models?: { slug: string; visibility?: string }[] };
    return json.models?.find((m) => m.visibility === "list")?.slug ?? FALLBACK_MODEL;
  } catch {
    return FALLBACK_MODEL;
  }
}

/** Reads a Responses API event stream to completion and returns the generated text. */
export async function readResponsesStream(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let completed = false;

  const handle = (raw: string) => {
    const line = raw.split("\n").find((l) => l.startsWith("data:"));
    if (!line) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    let event: { type?: string; delta?: string; response?: { error?: { code?: string; message?: string }; incomplete_details?: { reason?: string } } };
    try {
      event = JSON.parse(payload);
    } catch {
      return;
    }
    if (event.type === "response.output_text.delta" && typeof event.delta === "string") text += event.delta;
    else if (event.type === "response.completed") completed = true;
    else if (event.type === "response.failed") {
      const code = event.response?.error?.code ?? "unknown_error";
      if (code.startsWith("subscription_sharing_usage")) {
        throw new AppError("rate_limited", "Your ChatGPT plan's usage limit for apps was reached. Try again later or raise the limit in ChatGPT Settings → Usage.");
      }
      throw new AppError("github_unavailable", `ChatGPT could not complete the request (${code}).`);
    } else if (event.type === "response.incomplete") {
      throw new AppError("github_unavailable", `The response was cut short (${event.response?.incomplete_details?.reason ?? "incomplete"}).`);
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    let index: number;
    while ((index = buffer.indexOf("\n\n")) >= 0) {
      handle(buffer.slice(0, index));
      buffer = buffer.slice(index + 2);
    }
    if (done) break;
  }
  if (buffer.trim()) handle(buffer);
  if (!completed) throw new AppError("github_unavailable", "The ChatGPT stream ended before completion.");
  return text.trim();
}

/** AIProvider backed by the user's ChatGPT plan. */
export class ChatGPTPlanProvider implements AIProvider {
  readonly name = "chatgpt";

  constructor(
    private readonly getAccessToken: () => Promise<string>,
    private readonly model: string,
  ) {}

  async complete({ system, prompt }: CompletionRequest): Promise<string> {
    const token = await this.getAccessToken();
    const res = await fetch(`${RESOURCE}/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, input: [{ role: "user", content: `${system}\n\n${prompt}` }], store: false, stream: true }),
      signal: AbortSignal.timeout(90_000),
      cache: "no-store",
    });
    if (res.status === 401) throw new AppError("unauthorized", "ChatGPT rejected the session. Disconnect and connect again.");
    if (res.status === 429) throw new AppError("rate_limited", "ChatGPT rate limit reached. Try again shortly.");
    if (!res.ok || !res.body) throw new AppError("github_unavailable", `ChatGPT responded with ${res.status}.`);
    return readResponsesStream(res.body);
  }
}
