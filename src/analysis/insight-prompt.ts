export interface InsightFacts {
  fullName: string;
  description: string | null;
  summary: string | null;
  daysSinceCommit: number;
  archived: boolean;
  stars: number;
  forks: number;
  license: string | null;
  graveScore: number;
  revivalScore: number;
  difficulty: string | null;
  abandonmentSignals: string[];
  communitySignals: string[];
  technologies: string[];
  challenges: string[];
  activeForks: string[];
  topIssues: string[];
  readmeExcerpt: string | null;
}

export const INSIGHT_SYSTEM =
  "You advise developers who are considering reviving an abandoned open-source project. Use only the facts provided; if something is unknown, say so. Never invent versions, dates, numbers or issues. Be concrete and brief.";

export function buildInsightPrompt(f: InsightFacts): string {
  const list = (title: string, items: string[]) => (items.length ? `${title}:\n${items.map((i) => `- ${i}`).join("\n")}\n` : "");
  return [
    `Repository: ${f.fullName}${f.archived ? " (archived)" : ""}`,
    f.description ? `Description: ${f.description}` : "",
    f.summary ? `Summary: ${f.summary}` : "",
    `Last commit: ${f.daysSinceCommit} days ago. Stars: ${f.stars}. Forks: ${f.forks}. License: ${f.license ?? "none detected"}.`,
    `Grave Score (0-100, higher is more abandoned): ${f.graveScore}. Revival Score (0-100, higher is more promising): ${f.revivalScore}. Revival difficulty: ${f.difficulty ?? "not analyzed"}.`,
    "",
    list("Why it looks abandoned", f.abandonmentSignals),
    list("Community signals", f.communitySignals),
    list("Obsolete technologies found", f.technologies),
    list("Main challenges", f.challenges),
    list("Active forks", f.activeForks),
    list("Most discussed open issues", f.topIssues),
    f.readmeExcerpt ? `README excerpt:\n${f.readmeExcerpt}\n` : "",
    "Task: In at most 180 words, give (1) a verdict on whether this project is worth reviving and for whom, (2) the strongest reasons for and against, and (3) the first three concrete steps. Plain text, no headings, no preamble.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}
