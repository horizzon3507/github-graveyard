import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAICompatibleProvider } from "@/providers/ai/providers";
import { summarizeProject, summarizeReadme } from "@/analysis/summary";

afterEach(() => vi.unstubAllGlobals());

describe("summaries", () => {
  const readme = "[![build](x.svg)](y)\n\n# Project\n\n![logo](l.png)\n\nA fast, tiny widget toolkit for building dashboards without a framework. Works everywhere.\n\n## Install";

  it("takes the first readable README paragraph, skipping badges and headings", () => {
    expect(summarizeReadme(readme, "desc")).toMatch(/^A fast, tiny widget toolkit/);
    expect(summarizeReadme(null, "Only a description")).toBe("Only a description");
    expect(summarizeReadme(null, null)).toBeNull();
  });

  it("falls back to the heuristic when no provider is configured or the provider fails", async () => {
    const none = await summarizeProject(null, { fullName: "a/b", description: null, readme });
    expect(none.source).toBe("readme");
    const failing = await summarizeProject({ name: "x", complete: async () => { throw new Error("boom"); } }, { fullName: "a/b", description: null, readme });
    expect(failing.source).toBe("readme");
  });

  it("uses any AIProvider implementation when it works", async () => {
    const result = await summarizeProject({ name: "fake", complete: async () => "A dashboard toolkit." }, { fullName: "a/b", description: null, readme });
    expect(result).toEqual({ summary: "A dashboard toolkit.", source: "fake" });
  });
});

describe("OpenAICompatibleProvider", () => {
  it("posts a chat completion and returns the text", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      void init;
      return new Response(JSON.stringify({ choices: [{ message: { content: " Hello " } }] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAICompatibleProvider("local", "http://localhost:11434/v1/", "llama3", "key");
    expect(await provider.complete({ system: "s", prompt: "p" })).toBe("Hello");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:11434/v1/chat/completions");
    expect(JSON.parse(String(init.body))).toMatchObject({ model: "llama3", messages: [{ role: "system" }, { role: "user", content: "p" }] });
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer key");
  });

  it("throws on non-2xx responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    await expect(new OpenAICompatibleProvider("x", "http://h", "m").complete({ system: "s", prompt: "p" })).rejects.toThrow(/500/);
  });
});
