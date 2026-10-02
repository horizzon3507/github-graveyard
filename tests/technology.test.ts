import { describe, expect, it } from "vitest";
import { detectTechnologies, majorOf } from "@/analysis/technology";
import { assessDependencies, extractDependencies } from "@/analysis/dependencies";
import { findIssuesWorthSolving, isMaintenanceRequest } from "@/analysis/issues";
import { assessDocumentation, detectTests } from "@/analysis/project-signals";
import { categorize } from "@/analysis/categories";
import type { IssueItem } from "@/types/github";

describe("technology archaeology", () => {
  it("finds legacy JavaScript stacks and their modern equivalents", () => {
    const pkg = JSON.stringify({ dependencies: { react: "^15.6.0", jquery: "^2.1.0", bootstrap: "3.3.7" }, devDependencies: { webpack: "^2.2.0", grunt: "^1.0.0" }, engines: { node: ">=8" } });
    const found = detectTechnologies({ files: { "package.json": pkg }, paths: [".travis.yml", "package.json"] });
    const byId = Object.fromEntries(found.map((f) => [f.id, f]));
    expect(byId["react-legacy"].modern).toBe("React 19");
    expect(byId["webpack-legacy"].modern).toBe("Vite");
    expect(byId["travis"].modern).toBe("GitHub Actions");
    expect(byId["node-legacy"].name).toBe("Node.js 8");
    expect(byId["jquery"]).toBeDefined();
    expect(byId["bootstrap3"]).toBeDefined();
    expect(found[0].severity).toBe("high");
  });

  it("detects Python 2 and old Docker images, and ignores modern stacks", () => {
    const old = detectTechnologies({ files: { "setup.py": "classifiers=['Programming Language :: Python :: 2.7']", Dockerfile: "FROM python:2.7-slim\nRUN pip install" }, paths: [] });
    expect(old.map((f) => f.id)).toEqual(expect.arrayContaining(["python2", "docker-python"]));
    const modern = detectTechnologies({ files: { "package.json": JSON.stringify({ dependencies: { react: "^19.0.0", vite: "^6.0.0" } }), ".nvmrc": "22" }, paths: [".github/workflows/ci.yml"] });
    expect(modern).toEqual([]);
  });

  it("parses version ranges", () => {
    expect(majorOf("^16.4.2")).toBe(16);
    expect(majorOf(">=0.14")).toBe(0);
    expect(majorOf("latest")).toBeNull();
  });
});

describe("dependency health", () => {
  it("flags outdated and deprecated packages", () => {
    const { ecosystem, deps, total } = extractDependencies({ "package.json": JSON.stringify({ dependencies: { a: "^1.0.0", b: "^2.0.0", c: "workspace:*" } }) });
    expect(ecosystem).toBe("npm");
    expect(deps.map((d) => d.name)).toEqual(["a", "b"]);
    const health = assessDependencies(ecosystem, total, deps, { a: { version: "4.1.0" }, b: { version: "2.3.0", deprecated: "use x" } });
    expect(health.outdated[0]).toMatchObject({ name: "a", majorsBehind: 3 });
    expect(health.deprecated[0].name).toBe("b");
    expect(health.healthyRatio).toBe(0);
  });

  it("reads pinned PyPI requirements", () => {
    const { ecosystem, deps } = extractDependencies({ "requirements.txt": "requests==2.9.1\nflask>=0.10\n# comment\n-e ." });
    expect(ecosystem).toBe("pypi");
    expect(deps.map((d) => d.name)).toEqual(["requests", "flask"]);
  });
});

const issue = (n: number, patch: Partial<IssueItem>): IssueItem => ({ number: n, title: `issue ${n}`, body: "", isPullRequest: false, state: "open", comments: 0, reactions: 0, labels: [], author: "u", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z", url: `https://github.com/o/r/issues/${n}`, draft: false, ...patch });

describe("issues worth solving", () => {
  it("sorts issues into the four buckets without duplicates", () => {
    const result = findIssuesWorthSolving(
      [
        issue(1, { title: "Is this project still maintained?", comments: 12, reactions: 9 }),
        issue(2, { title: "Crash on startup", labels: ["bug"], comments: 3, reactions: 4 }),
        issue(3, { title: "Typo in README", labels: ["good first issue"] }),
        issue(4, { title: "Add dark mode", labels: ["enhancement"], comments: 30, reactions: 50 }),
        issue(5, { isPullRequest: true, title: "PR" }),
        issue(6, { state: "closed", title: "closed crash", labels: ["bug"] }),
      ],
      6,
    );
    expect(result.communityRequests.map((i) => i.number)).toEqual([1]);
    expect(result.criticalBugs.map((i) => i.number)).toEqual([2]);
    expect(result.easyWins.map((i) => i.number)).toEqual([3]);
    expect(result.mostRequested.map((i) => i.number)).toEqual([4]);
    expect(isMaintenanceRequest({ title: "Add dark mode", body: "" })).toBe(false);
    expect(isMaintenanceRequest({ title: "Looking for maintainers", body: "" })).toBe(true);
  });
});

describe("project signals and categories", () => {
  it("assesses docs and tests from paths", () => {
    expect(detectTests(["src/a.ts", "src/a.test.ts", ".github/workflows/ci.yml"])).toEqual({ hasTests: true, hasCi: true });
    expect(detectTests(["src/a.ts"])).toEqual({ hasTests: false, hasCi: false });
    expect(assessDocumentation("# Foo\n\n## Installation\n\n## Usage\n\n```js\nfoo()\n```\n" + "x".repeat(1600), ["docs/index.md", "CHANGELOG.md"]).score).toBeGreaterThan(0.9);
    expect(assessDocumentation(null, []).notes).toContain("No README found.");
  });

  it("categorizes repositories", () => {
    expect(categorize({ name: "pixel-quest", description: "A roguelike game engine", topics: ["gamedev"], language: "C++" })).toContain("games");
    expect(categorize({ name: "x", description: "command-line tool", topics: [], language: "Go" })).toContain("developer-tools");
    expect(categorize({ name: "x", description: "TensorFlow models", topics: ["machine-learning"], language: "Python" })).toContain("ai");
  });
});
