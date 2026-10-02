import { afterEach, describe, expect, it, vi } from "vitest";
import { assertSameOrigin } from "@/lib/api";

afterEach(() => vi.unstubAllEnvs());

const req = (headers: Record<string, string>) => new Request("http://localhost:3000/api/x", { method: "POST", headers });

describe("assertSameOrigin", () => {
  it("allows requests without an Origin header and same-host requests", () => {
    expect(() => assertSameOrigin(req({}))).not.toThrow();
    expect(() => assertSameOrigin(req({ origin: "http://localhost:3000", host: "localhost:3000" }))).not.toThrow();
  });

  it("allows the public host behind a reverse proxy via x-forwarded-host or APP_URL", () => {
    expect(() => assertSameOrigin(req({ origin: "https://app.example.com", host: "localhost:3000", "x-forwarded-host": "app.example.com" }))).not.toThrow();
    vi.stubEnv("APP_URL", "https://app.example.com");
    expect(() => assertSameOrigin(req({ origin: "https://app.example.com", host: "internal:3000" }))).not.toThrow();
  });

  it("rejects other origins", () => {
    vi.stubEnv("APP_URL", "https://app.example.com");
    expect(() => assertSameOrigin(req({ origin: "https://evil.com", host: "internal:3000", "x-forwarded-host": "app.example.com" }))).toThrowError(/Cross-origin/);
    expect(() => assertSameOrigin(req({ origin: "not a url", host: "x" }))).toThrowError(/Invalid origin/);
  });
});
