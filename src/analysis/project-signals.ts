export interface DocsAssessment {
  score: number;
  notes: string[];
}

export function assessDocumentation(readme: string | null, paths: string[]): DocsAssessment {
  let score = 0;
  const notes: string[] = [];
  if (readme) {
    if (readme.length > 1500) {
      score += 0.3;
      notes.push("Substantial README.");
    } else if (readme.length > 400) {
      score += 0.15;
      notes.push("Short README.");
    }
    if (/^#{1,3}\s*(install|installation|getting started|setup|quick ?start)/im.test(readme)) {
      score += 0.2;
      notes.push("Install instructions.");
    }
    if (/^#{1,3}\s*(usage|example|examples|api|documentation|how to)/im.test(readme) || /```/.test(readme)) {
      score += 0.2;
      notes.push("Usage examples.");
    }
  } else {
    notes.push("No README found.");
  }
  if (paths.some((p) => /^(docs?|documentation|wiki)\//i.test(p))) {
    score += 0.15;
    notes.push("Docs folder.");
  }
  if (paths.some((p) => /^(contributing|changelog|history|changes)(\.\w+)?$/i.test(p))) {
    score += 0.15;
    notes.push("Contributing guide or changelog.");
  }
  return { score: Math.min(1, score), notes };
}

export function detectTests(paths: string[]): { hasTests: boolean; hasCi: boolean } {
  const hasTests = paths.some((p) => /(^|\/)(tests?|__tests__|spec|specs|e2e)\//i.test(p) || /\.(test|spec)\.[jt]sx?$/.test(p) || /(_test\.(go|py|rb)|Test\.java|Tests?\.cs)$/.test(p) || /(^|\/)test_[^/]+\.py$/.test(p));
  const hasCi = paths.some((p) => /^(\.github\/workflows\/|\.travis\.yml$|\.circleci\/|\.gitlab-ci\.yml$|appveyor\.yml$|azure-pipelines\.yml$|Jenkinsfile$)/.test(p));
  return { hasTests, hasCi };
}

export function hasGithubActions(paths: string[]): boolean {
  return paths.some((p) => p.startsWith(".github/workflows/"));
}
