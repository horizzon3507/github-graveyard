import { describe, expect, it } from "vitest";
import { parseRepoInput, safeRelativePath, looksLikeGitHubUrl } from "@/lib/validation";

describe("parseRepoInput", () => {
  it("parses URLs, shorthand and .git suffixes", () => {
    expect(parseRepoInput("https://github.com/jashkenas/backbone")).toEqual({ owner: "jashkenas", name: "backbone" });
    expect(parseRepoInput("github.com/vuejs/vue/issues/12")).toEqual({ owner: "vuejs", name: "vue" });
    expect(parseRepoInput("https://github.com/a/b.git")).toEqual({ owner: "a", name: "b" });
    expect(parseRepoInput("facebook/react")).toEqual({ owner: "facebook", name: "react" });
  });

  it("rejects other hosts and malformed input", () => {
    expect(parseRepoInput("https://gitlab.com/a/b")).toBeNull();
    expect(parseRepoInput("https://github.com.evil.com/a/b")).toBeNull();
    expect(parseRepoInput("https://github.com/onlyowner")).toBeNull();
    expect(parseRepoInput("javascript:alert(1)")).toBeNull();
    expect(parseRepoInput("https://github.com/../etc")).toBeNull();
    expect(parseRepoInput("a/b; rm -rf /")).toBeNull();
    expect(parseRepoInput("x".repeat(400))).toBeNull();
  });

  it("detects GitHub URLs", () => {
    expect(looksLikeGitHubUrl("https://github.com/a/b")).toBe(true);
    expect(looksLikeGitHubUrl("jquery plugin")).toBe(false);
  });
});

describe("safeRelativePath", () => {
  it("only allows same-site paths", () => {
    expect(safeRelativePath("/repo/a/b")).toBe("/repo/a/b");
    expect(safeRelativePath("//evil.com")).toBe("/");
    expect(safeRelativePath("https://evil.com")).toBe("/");
    expect(safeRelativePath("/\\evil.com")).toBe("/");
    expect(safeRelativePath(null, "/x")).toBe("/x");
  });
});
