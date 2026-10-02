import type { TechFinding, Severity } from "@/types/analysis";

export interface TechInput {
  /** Contents of well-known manifest files, keyed by repo-relative path. */
  files: Record<string, string>;
  /** Every path in the repository tree (may be truncated). */
  paths: string[];
}

/** Manifest files the collector tries to download (repo root only, plus the first *.csproj). */
export const MANIFEST_FILES = [
  "package.json",
  "requirements.txt",
  "setup.py",
  "setup.cfg",
  "pyproject.toml",
  "Pipfile",
  ".python-version",
  "runtime.txt",
  ".nvmrc",
  ".node-version",
  "Gemfile",
  ".ruby-version",
  "pom.xml",
  "build.gradle",
  "go.mod",
  "Cargo.toml",
  "composer.json",
  "Dockerfile",
  "tox.ini",
] as const;

export function majorOf(range: string | undefined): number | null {
  if (!range) return null;
  const m = range.match(/(\d+)(?:\.(\d+|x|\*))?/);
  return m ? Number(m[1]) : null;
}

function minorOf(range: string | undefined): number | null {
  if (!range) return null;
  const m = range.match(/\d+\.(\d+)/);
  return m ? Number(m[1]) : null;
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: { node?: string };
  name?: string;
}

export function parsePackageJson(content: string | undefined): PackageJson | null {
  if (!content) return null;
  try {
    return JSON.parse(content) as PackageJson;
  } catch {
    return null;
  }
}

const SEVERITY_POINTS: Record<Severity, number> = { low: 1, medium: 2, high: 3 };

export function techDebtPoints(findings: TechFinding[]): number {
  return findings.reduce((sum, f) => sum + SEVERITY_POINTS[f.severity], 0);
}

type Add = (finding: Omit<TechFinding, "suggestion"> & { suggestion?: string }) => void;

function jsRules(pkg: PackageJson, add: Add, paths: string[]) {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const has = (name: string) => name in deps;
  const major = (name: string) => majorOf(deps[name]);

  const react = major("react");
  if (react !== null && react <= 17) {
    add({ id: "react-legacy", name: `React ${react}`, evidence: `react ${deps.react} in package.json`, category: "framework", severity: react <= 15 ? "high" : "medium", modern: "React 19", suggestion: `Migrate React ${react} → React 19` });
  }
  if (has("angular")) {
    add({ id: "angularjs", name: "AngularJS", evidence: `angular ${deps.angular}`, category: "framework", severity: "high", modern: "Angular, React or Vue", suggestion: "Rewrite AngularJS views incrementally in a supported framework" });
  }
  const vue = major("vue");
  if (vue !== null && vue <= 2) {
    add({ id: "vue2", name: "Vue 2", evidence: `vue ${deps.vue}`, category: "framework", severity: "medium", modern: "Vue 3", suggestion: "Migrate Vue 2 → Vue 3 (Vue 2 reached end of life in 2023)" });
  }
  if (has("jquery")) {
    add({ id: "jquery", name: "jQuery", evidence: `jquery ${deps.jquery}`, category: "library", severity: "low", modern: "Native DOM APIs", suggestion: "Replace jQuery with native DOM APIs where practical" });
  }
  const bootstrap = major("bootstrap");
  if (bootstrap !== null && bootstrap <= 3) {
    add({ id: "bootstrap3", name: `Bootstrap ${bootstrap}`, evidence: `bootstrap ${deps.bootstrap}`, category: "framework", severity: "medium", modern: "Bootstrap 5 or Tailwind CSS", suggestion: `Upgrade Bootstrap ${bootstrap} → Bootstrap 5` });
  }
  const webpack = major("webpack");
  if (webpack !== null && webpack <= 4) {
    add({ id: "webpack-legacy", name: `Webpack ${webpack}`, evidence: `webpack ${deps.webpack}`, category: "build", severity: webpack <= 2 ? "high" : "medium", modern: "Vite", suggestion: `Migrate Webpack ${webpack} → Vite` });
  }
  for (const tool of ["gulp", "grunt", "bower"]) {
    if (has(tool) || (tool !== "gulp" && paths.includes(tool === "grunt" ? "Gruntfile.js" : "bower.json"))) {
      add({ id: `${tool}`, name: tool[0].toUpperCase() + tool.slice(1), evidence: `${tool} in package manifest`, category: "build", severity: "medium", modern: tool === "bower" ? "npm / pnpm" : "npm scripts or Vite", suggestion: `Replace ${tool} with npm scripts or a modern bundler` });
    }
  }
  if (has("coffee-script") || has("coffeescript")) {
    add({ id: "coffeescript", name: "CoffeeScript", evidence: "coffee-script in dependencies", category: "language", severity: "high", modern: "TypeScript", suggestion: "Convert CoffeeScript sources to TypeScript" });
  }
  if (has("babel-core") || has("babel-preset-es2015") || has("babel-preset-react")) {
    add({ id: "babel6", name: "Babel 6", evidence: "babel-core / babel-preset-* packages", category: "build", severity: "high", modern: "Babel 7+, SWC or esbuild", suggestion: "Migrate Babel 6 → modern transpiler (SWC / esbuild / Babel 7)" });
  }
  if (has("node-sass")) {
    add({ id: "node-sass", name: "node-sass", evidence: "node-sass in dependencies", category: "library", severity: "high", modern: "Dart Sass (sass)", suggestion: "Replace node-sass with sass (Dart Sass)" });
  }
  const express = major("express");
  if (express !== null && express <= 3) {
    add({ id: "express3", name: `Express ${express}`, evidence: `express ${deps.express}`, category: "framework", severity: "high", modern: "Express 5", suggestion: `Upgrade Express ${express} → Express 5` });
  }
  if (has("tslint")) {
    add({ id: "tslint", name: "TSLint", evidence: "tslint in devDependencies", category: "build", severity: "medium", modern: "ESLint + typescript-eslint", suggestion: "Replace TSLint with ESLint and typescript-eslint" });
  }
  if (has("enzyme")) {
    add({ id: "enzyme", name: "Enzyme", evidence: "enzyme in devDependencies", category: "testing", severity: "medium", modern: "React Testing Library", suggestion: "Replace Enzyme with React Testing Library" });
  }
  if (has("react-scripts")) {
    add({ id: "cra", name: "Create React App", evidence: "react-scripts in dependencies", category: "build", severity: "medium", modern: "Vite or Next.js", suggestion: "Migrate Create React App → Vite" });
  }
  if (has("request")) {
    add({ id: "request", name: "request (deprecated)", evidence: "request in dependencies", category: "library", severity: "medium", modern: "fetch / undici", suggestion: "Replace the deprecated request package with fetch" });
  }
  if (has("moment")) {
    add({ id: "moment", name: "Moment.js", evidence: "moment in dependencies", category: "library", severity: "low", modern: "date-fns or Temporal", suggestion: "Replace Moment.js with date-fns or Intl/Temporal" });
  }
  if (has("backbone")) {
    add({ id: "backbone", name: "Backbone.js", evidence: "backbone in dependencies", category: "framework", severity: "medium", modern: "React, Vue or Svelte", suggestion: "Replace Backbone views with a component framework" });
  }
  if (has("flow-bin")) {
    add({ id: "flow", name: "Flow", evidence: "flow-bin in devDependencies", category: "language", severity: "medium", modern: "TypeScript", suggestion: "Migrate Flow annotations → TypeScript" });
  }
  const ts = major("typescript");
  if (ts !== null && ts <= 3) {
    add({ id: "typescript-legacy", name: `TypeScript ${ts}`, evidence: `typescript ${deps.typescript}`, category: "language", severity: "medium", modern: "TypeScript 5", suggestion: `Upgrade TypeScript ${ts} → 5` });
  }
  if (has("polymer") || has("@polymer/polymer")) {
    add({ id: "polymer", name: "Polymer", evidence: "polymer in dependencies", category: "framework", severity: "high", modern: "Lit", suggestion: "Migrate Polymer components → Lit" });
  }
}

function nodeEngine(files: Record<string, string>, pkg: PackageJson | null): { version: number; evidence: string } | null {
  const sources: [string | undefined, string][] = [
    [pkg?.engines?.node, "engines.node in package.json"],
    [files[".nvmrc"], ".nvmrc"],
    [files[".node-version"], ".node-version"],
  ];
  for (const [value, evidence] of sources) {
    if (!value) continue;
    const trimmed = value.trim();
    const lts: Record<string, number> = { lts: 22, "lts/*": 22, node: 22, stable: 22 };
    const m = lts[trimmed.toLowerCase()] ?? majorOf(trimmed.replace(/^v/i, ""));
    if (m !== null && m !== undefined) return { version: m, evidence: `${evidence} (${trimmed})` };
  }
  return null;
}

function pythonRules(files: Record<string, string>, add: Add) {
  const setup = `${files["setup.py"] ?? ""}\n${files["setup.cfg"] ?? ""}\n${files["pyproject.toml"] ?? ""}\n${files["tox.ini"] ?? ""}`;
  const py2 = /Programming Language :: Python :: 2\b|python_requires\s*=\s*['"]?[<>=~!,\s]*2\.|envlist\s*=.*\bpy2/i.test(setup);
  const pyVersionFile = files[".python-version"] ?? files["runtime.txt"] ?? "";
  const pyFileMajor = majorOf(pyVersionFile.replace(/python-?/i, ""));
  if (py2 || pyFileMajor === 2) {
    add({ id: "python2", name: "Python 2", evidence: pyFileMajor === 2 ? "python version file pins 2.x" : "Python 2 classifiers or python_requires", category: "language", severity: "high", modern: "Python 3.12+", suggestion: "Port the codebase from Python 2 to Python 3 (2to3, then six removal)" });
  } else {
    const requires = setup.match(/python_requires\s*=\s*['"]?[^'"\n]*?(\d)\.(\d+)/i);
    if (requires && Number(requires[1]) === 3 && Number(requires[2]) <= 7) {
      add({ id: "python-old", name: `Python 3.${requires[2]}`, evidence: `python_requires ${requires[0].split("=")[1].trim()}`, category: "language", severity: "medium", modern: "Python 3.12+", suggestion: "Raise the minimum supported Python to 3.10+" });
    }
  }
  const reqs = (files["requirements.txt"] ?? "").toLowerCase();
  const django = reqs.match(/^django\s*[=<>~!]+\s*(\d+)/m);
  if (django && Number(django[1]) <= 2) {
    add({ id: "django-legacy", name: `Django ${django[1]}`, evidence: "requirements.txt", category: "framework", severity: "high", modern: "Django 5", suggestion: `Upgrade Django ${django[1]} → 5 one LTS at a time` });
  }
  const flask = reqs.match(/^flask\s*[=<>~!]+\s*(\d+)/m);
  if (flask && Number(flask[1]) < 2) {
    add({ id: "flask-legacy", name: `Flask ${flask[1]}`, evidence: "requirements.txt", category: "framework", severity: "medium", modern: "Flask 3", suggestion: "Upgrade Flask to 3.x" });
  }
  if (/^nose\b/m.test(reqs) || /\bnose\b/.test(files["tox.ini"] ?? "")) {
    add({ id: "nose", name: "nose", evidence: "requirements.txt / tox.ini", category: "testing", severity: "high", modern: "pytest", suggestion: "Replace the unmaintained nose test runner with pytest" });
  }
  if (files["setup.py"] && !files["pyproject.toml"]) {
    add({ id: "setup-py", name: "setup.py packaging", evidence: "setup.py without pyproject.toml", category: "build", severity: "low", modern: "pyproject.toml", suggestion: "Move packaging metadata to pyproject.toml" });
  }
}

function dockerRules(dockerfile: string, add: Add) {
  const from = [...dockerfile.matchAll(/^FROM\s+(?:--platform=\S+\s+)?([^\s]+)/gim)].map((m) => m[1]);
  for (const image of from) {
    const [name, tag = "latest"] = image.split(":");
    const base = name.split("/").pop() ?? name;
    const v = majorOf(tag);
    let outdated: { modern: string; severity: Severity } | null = null;
    if (base === "node" && v !== null && v < 18) outdated = { modern: "node:22", severity: "medium" };
    else if (base === "python" && v !== null && (v === 2 || (v === 3 && (minorOf(tag) ?? 99) < 8))) outdated = { modern: "python:3.12", severity: v === 2 ? "high" : "medium" };
    else if (base === "ruby" && v !== null && v < 3) outdated = { modern: "ruby:3.3", severity: "medium" };
    else if (base === "ubuntu" && ["12.04", "14.04", "16.04", "18.04"].includes(tag)) outdated = { modern: "ubuntu:24.04", severity: "medium" };
    else if (["jessie", "stretch", "buster"].some((c) => tag.includes(c))) outdated = { modern: "a current Debian release (bookworm)", severity: "medium" };
    if (outdated) {
      add({ id: `docker-${base}`, name: `Docker image ${image}`, evidence: "Dockerfile", category: "container", severity: outdated.severity, modern: outdated.modern, suggestion: `Update the Docker base image to ${outdated.modern}` });
      return;
    }
  }
}

export function detectTechnologies({ files, paths }: TechInput): TechFinding[] {
  const findings: TechFinding[] = [];
  const seen = new Set<string>();
  const add: Add = (f) => {
    if (seen.has(f.id)) return;
    seen.add(f.id);
    findings.push({ ...f, suggestion: f.suggestion ?? `Replace ${f.name} with ${f.modern}` });
  };

  const pkg = parsePackageJson(files["package.json"]);
  if (pkg) jsRules(pkg, add, paths);

  const node = nodeEngine(files, pkg);
  if (node && node.version < 18) {
    add({ id: "node-legacy", name: `Node.js ${node.version}`, evidence: node.evidence, category: "runtime", severity: node.version < 12 ? "high" : "medium", modern: "Node.js 22 LTS", suggestion: `Upgrade Node.js ${node.version} → 22 LTS` });
  }

  pythonRules(files, add);

  const has = (re: RegExp) => paths.some((p) => re.test(p));
  if (has(/^\.travis\.yml$/)) add({ id: "travis", name: "Travis CI", evidence: ".travis.yml", category: "ci", severity: "medium", modern: "GitHub Actions", suggestion: "Replace Travis CI with GitHub Actions" });
  if (has(/^(appveyor\.yml|\.appveyor\.yml)$/)) add({ id: "appveyor", name: "AppVeyor", evidence: "appveyor.yml", category: "ci", severity: "low", modern: "GitHub Actions", suggestion: "Move AppVeyor jobs to GitHub Actions" });
  if (has(/^circle\.yml$/)) add({ id: "circleci1", name: "CircleCI 1.0", evidence: "circle.yml", category: "ci", severity: "medium", modern: "GitHub Actions", suggestion: "Replace the CircleCI 1.0 config with GitHub Actions" });

  if (files["Dockerfile"]) dockerRules(files["Dockerfile"], add);

  const gemfile = files["Gemfile"];
  if (gemfile) {
    const rails = gemfile.match(/gem\s+['"]rails['"]\s*,\s*['"][~><= ]*(\d+)/);
    if (rails && Number(rails[1]) < 6) add({ id: "rails-legacy", name: `Rails ${rails[1]}`, evidence: "Gemfile", category: "framework", severity: "high", modern: "Rails 8", suggestion: `Upgrade Rails ${rails[1]} → 8 through each major release` });
  }
  const ruby = majorOf(files[".ruby-version"]?.trim().replace(/^ruby-/, ""));
  if (ruby !== null && ruby < 3) add({ id: "ruby-legacy", name: `Ruby ${ruby}`, evidence: ".ruby-version", category: "language", severity: "medium", modern: "Ruby 3.3", suggestion: "Upgrade Ruby to 3.3" });

  const pom = files["pom.xml"] ?? files["build.gradle"] ?? "";
  const java = pom.match(/(?:maven\.compiler\.(?:source|target)|sourceCompatibility)['">=\s]*(?:JavaVersion\.VERSION_)?['"]?(1[._]?[5-8])\b/);
  if (java) add({ id: "java-legacy", name: `Java ${java[1].replace(/[._]/, ".")}`, evidence: "build configuration", category: "language", severity: "medium", modern: "Java 21 LTS", suggestion: "Raise the Java target to 21 LTS" });

  const goMod = files["go.mod"];
  if (goMod) {
    const go = goMod.match(/^go\s+1\.(\d+)/m);
    if (go && Number(go[1]) < 18) add({ id: "go-legacy", name: `Go 1.${go[1]}`, evidence: "go.mod", category: "language", severity: "medium", modern: "Go 1.23+", suggestion: "Bump the go directive to a supported release" });
  } else if (has(/^(Godeps\/|glide\.yaml|Gopkg\.toml)/)) {
    add({ id: "go-deps", name: "Pre-modules Go dependency tool", evidence: "Godeps / glide / dep", category: "build", severity: "high", modern: "Go modules", suggestion: "Migrate Godeps/glide/dep → Go modules" });
  }

  const cargo = files["Cargo.toml"]?.match(/edition\s*=\s*"(\d{4})"/);
  if (cargo && Number(cargo[1]) <= 2018) add({ id: "rust-edition", name: `Rust ${cargo[1]} edition`, evidence: "Cargo.toml", category: "language", severity: "low", modern: "Rust 2024 edition", suggestion: "Migrate to the latest Rust edition with cargo fix --edition" });

  const composer = files["composer.json"]?.match(/"php"\s*:\s*"[^"\d]*(\d+)\.(\d+)/);
  if (composer && (Number(composer[1]) < 7 || (Number(composer[1]) === 7 && Number(composer[2]) < 4))) {
    add({ id: "php-legacy", name: `PHP ${composer[1]}.${composer[2]}`, evidence: "composer.json", category: "language", severity: "high", modern: "PHP 8.3", suggestion: "Upgrade PHP to 8.3 and fix removed APIs" });
  }

  const csproj = Object.entries(files).find(([p]) => p.endsWith(".csproj"));
  if (csproj && /<TargetFramework>(net4\d*|netcoreapp\d[^<]*|netstandard1[^<]*)<\/TargetFramework>/.test(csproj[1])) {
    add({ id: "dotnet-legacy", name: ".NET Framework / Core (legacy)", evidence: csproj[0], category: "framework", severity: "medium", modern: ".NET 9", suggestion: "Retarget the project to .NET 9" });
  }

  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  return findings.sort((a, b) => order[a.severity] - order[b.severity]);
}
