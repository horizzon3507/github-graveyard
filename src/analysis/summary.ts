import type { AIProvider } from "@/providers/ai/types";
import { truncate } from "@/lib/utils";

/** First readable paragraph of a README, skipping badges, images, headings and HTML. */
export function summarizeReadme(readme: string | null, description: string | null): string | null {
  if (readme) {
    const blocks = readme.replace(/<!--[\s\S]*?-->/g, "").split(/\n\s*\n/);
    for (const block of blocks) {
      const text = block
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, "")
        .replace(/<[^>]+>/g, "")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/[*_`>#]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (text.length >= 60 && /[a-z]{3}/i.test(text) && !/^(table of contents|license|installation)/i.test(text)) {
        return truncate(text, 320);
      }
    }
  }
  return description ? truncate(description, 320) : null;
}

export async function summarizeProject(
  ai: AIProvider | null,
  input: { fullName: string; description: string | null; readme: string | null },
): Promise<{ summary: string | null; source: string | null }> {
  const heuristic = summarizeReadme(input.readme, input.description);
  if (!ai || !input.readme) return { summary: heuristic, source: heuristic ? "readme" : null };
  try {
    const text = await ai.complete({
      system:
        "You summarise open-source repositories for developers. Use only the information given. Write at most two plain sentences describing what the project does. Do not speculate about maintenance status.",
      prompt: `Repository: ${input.fullName}\nDescription: ${input.description ?? "(none)"}\n\nREADME (excerpt):\n${input.readme.slice(0, 3000)}`,
      maxTokens: 160,
    });
    return text ? { summary: truncate(text, 400), source: ai.name } : { summary: heuristic, source: heuristic ? "readme" : null };
  } catch {
    return { summary: heuristic, source: heuristic ? "readme" : null };
  }
}
