import type { DependencyHealth } from "@/types/analysis";
import { majorOf, parsePackageJson } from "@/analysis/technology";

export interface DependencySpec {
  name: string;
  spec: string;
}

export interface LatestVersion {
  version: string;
  deprecated?: string | null;
}

export const MAX_DEPENDENCIES_CHECKED = 15;

export function extractDependencies(files: Record<string, string>): { ecosystem: "npm" | "pypi" | null; deps: DependencySpec[]; total: number } {
  const pkg = parsePackageJson(files["package.json"]);
  if (pkg) {
    const all = Object.entries(pkg.dependencies ?? {}).map(([name, spec]) => ({ name, spec }));
    const dev = Object.entries(pkg.devDependencies ?? {}).map(([name, spec]) => ({ name, spec }));
    const registry = [...all, ...dev].filter(({ spec }) => /^[~^<>=v\d]/.test(spec) || spec === "*" || spec === "latest");
    return { ecosystem: "npm", deps: [...all, ...dev].filter((d) => registry.includes(d)).slice(0, MAX_DEPENDENCIES_CHECKED), total: all.length + dev.length };
  }
  const requirements = files["requirements.txt"];
  if (requirements) {
    const deps: DependencySpec[] = [];
    for (const line of requirements.split("\n")) {
      const m = line.trim().match(/^([A-Za-z0-9][A-Za-z0-9._-]*)\s*(?:\[[^\]]*\])?\s*(==|>=|~=|<=)\s*([\d][\w.]*)/);
      if (m) deps.push({ name: m[1], spec: `${m[2]}${m[3]}` });
    }
    return { ecosystem: "pypi", deps: deps.slice(0, MAX_DEPENDENCIES_CHECKED), total: deps.length };
  }
  return { ecosystem: null, deps: [], total: 0 };
}

export function assessDependencies(
  ecosystem: "npm" | "pypi" | null,
  total: number,
  deps: DependencySpec[],
  latest: Record<string, LatestVersion | null>,
): DependencyHealth {
  const outdated: DependencyHealth["outdated"] = [];
  const deprecated: DependencyHealth["deprecated"] = [];
  let checked = 0;
  for (const { name, spec } of deps) {
    const info = latest[name];
    if (!info) continue;
    checked++;
    const current = majorOf(spec);
    const latestMajor = majorOf(info.version);
    if (current !== null && latestMajor !== null && latestMajor - current >= 1) {
      outdated.push({ name, current: spec, latest: info.version, majorsBehind: latestMajor - current });
    }
    if (info.deprecated) deprecated.push({ name, message: info.deprecated.slice(0, 200) });
  }
  const bad = new Set([...outdated.map((o) => o.name), ...deprecated.map((d) => d.name)]);
  return {
    ecosystem,
    checked,
    total,
    outdated: outdated.sort((a, b) => b.majorsBehind - a.majorsBehind),
    deprecated,
    healthyRatio: checked === 0 ? null : (checked - bad.size) / checked,
  };
}

export const EMPTY_DEPENDENCY_HEALTH: DependencyHealth = { ecosystem: null, checked: 0, total: 0, outdated: [], deprecated: [], healthyRatio: null };
