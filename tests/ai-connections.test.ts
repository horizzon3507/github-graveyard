import { describe, expect, it } from "vitest";
import { decrypt, deriveHostId, encrypt, sha256 } from "@/lib/crypto";
import { buildAuthorizeUrl, exchangeCode, newPendingAuthorization, parseCallbackUrl, readResponsesStream, localRedirectUri } from "@/providers/ai/chatgpt";
import { BYOK_PRESETS, createByokProvider, isByokProvider } from "@/providers/ai/byok";
import { buildInsightPrompt } from "@/analysis/insight-prompt";

const SECRET = "test-secret-with-enough-length";

describe("crypto", () => {
  it("round-trips and refuses tampering or a different key", () => {
    const sealed = encrypt('{"apiKey":"sk-123"}', SECRET);
    expect(sealed).not.toContain("sk-123");
    expect(decrypt(sealed, SECRET)).toBe('{"apiKey":"sk-123"}');
    expect(() => decrypt(sealed, "another-secret-value-here")).toThrow();
    const [iv, tag, body] = sealed.split(".");
    expect(() => decrypt([iv, tag, body.slice(0, -2) + "AA"].join("."), SECRET)).toThrow();
    expect(encrypt("x", SECRET)).not.toBe(encrypt("x", SECRET));
  });

  it("derives a stable UUID-shaped host id and hashes secrets", () => {
    expect(deriveHostId(SECRET)).toMatch(/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(deriveHostId(SECRET)).toBe(deriveHostId(SECRET));
    expect(deriveHostId(SECRET)).not.toBe(deriveHostId("different-secret-value-xx"));
    expect(sha256("a")).toHaveLength(64);
  });
});

describe("ChatGPT sign-in", () => {
  const hostId = deriveHostId(SECRET);

  it("builds the dynamic-registration authorize URL", () => {
    const pending = newPendingAuthorization(localRedirectUri(1455), "paste", null);
    const url = new URL(buildAuthorizeUrl(pending, hostId));
    const p = url.searchParams;
    expect(`${url.origin}${url.pathname}`).toBe("https://auth.openai.com/api/accounts/authorize");
    expect(p.get("client_id")).toBe("dynamic_agent_client");
    expect(p.get("agent_name_hint")).toBe("GitHub Graveyard");
    expect(p.get("ext_agent_host_id")).toBe(hostId);
    expect(p.get("redirect_uri")).toBe("http://127.0.0.1:1455/auth/callback");
    expect(p.get("scope")).toBe("openid profile email offline_access resource.invoke chatgpt.tokens.use.direct");
    expect(p.get("resource")).toBe("https://api.openai.com/v1");
    expect(p.get("code_challenge_method")).toBe("S256");
    expect(p.get("state")).toBe(pending.state);
    expect(p.get("nonce")).toBe(pending.nonce);
  });

  it("reuses the issued client id and omits the agent name when returning", () => {
    const pending = newPendingAuthorization(localRedirectUri(3000), "local", "oaiapp_abc");
    const p = new URL(buildAuthorizeUrl(pending, hostId, { idToken: "tok", email: "a@b.com" })).searchParams;
    expect(p.get("client_id")).toBe("oaiapp_abc");
    expect(p.has("agent_name_hint")).toBe(false);
    expect(p.get("id_token_hint")).toBe("tok");
    expect(p.get("login_hint")).toBe("a@b.com");
  });

  it("only accepts the exact loopback callback shape", () => {
    const expected = localRedirectUri(1455);
    expect(parseCallbackUrl(`${expected}?code=c&state=s&client_id=oaiapp_1`, expected)).toEqual({ code: "c", state: "s", clientId: "oaiapp_1", error: null });
    expect(parseCallbackUrl(`  "${expected}?code=c&amp;scope=a+b&amp;state=s&amp;client_id=oaiapp_1"  `, expected)).toEqual({ code: "c", state: "s", clientId: "oaiapp_1", error: null });
    expect(() => parseCallbackUrl("https://evil.com/auth/callback?code=c", expected)).toThrow();
    expect(() => parseCallbackUrl("http://localhost:1455/auth/callback?code=c", expected)).toThrow();
    expect(() => parseCallbackUrl("http://127.0.0.1:1455/callback?code=c", expected)).toThrow();
    expect(() => parseCallbackUrl("http://127.0.0.1:9999/auth/callback?code=c", expected)).toThrow();
    expect(() => parseCallbackUrl("not a url", expected)).toThrow();
  });

  it("rejects bad callbacks before talking to OpenAI", async () => {
    const pending = newPendingAuthorization(localRedirectUri(1455), "paste", null);
    await expect(exchangeCode(pending, { code: "c", state: "wrong", clientId: "oaiapp_1", error: null }, "h")).rejects.toThrow(/expired or does not match/);
    await expect(exchangeCode(pending, { code: null, state: pending.state, clientId: "oaiapp_1", error: "access_denied" }, "h")).rejects.toThrow(/declined/);
    await expect(exchangeCode(pending, { code: null, state: pending.state, clientId: "oaiapp_1", error: null }, "h")).rejects.toThrow(/no authorization code/);
    await expect(exchangeCode(pending, { code: "c", state: pending.state, clientId: null, error: null }, "h")).rejects.toThrow(/client id/);
    await expect(exchangeCode(pending, { code: "c", state: pending.state, clientId: "dynamic_agent_client", error: null }, "h")).rejects.toThrow(/client id/);
    const returning = newPendingAuthorization(localRedirectUri(1455), "paste", "oaiapp_1");
    await expect(exchangeCode(returning, { code: "c", state: returning.state, clientId: "oaiapp_other", error: null }, "h")).rejects.toThrow(/Unexpected client id/);
  });
});

function sse(events: unknown[], split = false) {
  const text = events.map((e) => `event: x\ndata: ${JSON.stringify(e)}\n\n`).join("");
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (split) {
        const mid = Math.floor(bytes.length / 2);
        controller.enqueue(bytes.slice(0, mid));
        controller.enqueue(bytes.slice(mid));
      } else controller.enqueue(bytes);
      controller.close();
    },
  });
}

describe("Responses stream", () => {
  it("concatenates text deltas until response.completed, even across chunk boundaries", async () => {
    const events = [{ type: "response.output_text.delta", delta: "Hel" }, { type: "response.output_text.delta", delta: "lo" }, { type: "response.completed" }];
    expect(await readResponsesStream(sse(events))).toBe("Hello");
    expect(await readResponsesStream(sse(events, true))).toBe("Hello");
  });

  it("maps plan usage limits to a rate-limit error and rejects incomplete streams", async () => {
    await expect(readResponsesStream(sse([{ type: "response.failed", response: { error: { code: "subscription_sharing_usage_limit_exceeded" } } }]))).rejects.toMatchObject({ code: "rate_limited" });
    await expect(readResponsesStream(sse([{ type: "response.output_text.delta", delta: "partial" }]))).rejects.toThrow(/before completion/);
    await expect(readResponsesStream(sse([{ type: "response.incomplete", response: { incomplete_details: { reason: "max_output_tokens" } } }]))).rejects.toThrow(/cut short/);
  });
});

describe("BYOK and prompts", () => {
  it("only allows presets with fixed endpoints", () => {
    expect(BYOK_PRESETS.map((p) => p.id)).toEqual(["openai", "anthropic", "gemini", "groq", "openrouter"]);
    expect(isByokProvider("groq")).toBe(true);
    expect(isByokProvider("http://169.254.169.254")).toBe(false);
    expect(() => createByokProvider("custom", "key-123456")).toThrow();
    expect(createByokProvider("groq", "key-123456").name).toBe("groq");
    expect(createByokProvider("anthropic", "key-123456").name).toBe("anthropic");
  });

  it("builds an insight prompt only from provided facts", () => {
    const prompt = buildInsightPrompt({
      fullName: "o/r", description: "d", summary: null, daysSinceCommit: 900, archived: true, stars: 10, forks: 2, license: "MIT",
      graveScore: 80, revivalScore: 60, difficulty: "EASY", abandonmentSignals: ["No commits for 2.5 years"], communitySignals: [], technologies: ["jQuery -> native DOM"],
      challenges: [], activeForks: [], topIssues: ["#1 Crash"], readmeExcerpt: null,
    });
    expect(prompt).toContain("o/r (archived)");
    expect(prompt).toContain("- No commits for 2.5 years");
    expect(prompt).toContain("#1 Crash");
    expect(prompt).not.toContain("Community signals");
    expect(prompt).toContain("at most 180 words");
  });
});
