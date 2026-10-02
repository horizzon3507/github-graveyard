import "server-only";
import { env } from "@/lib/env";
import type { AIProvider } from "@/providers/ai/types";
import { AnthropicProvider, GeminiProvider, OpenAICompatibleProvider } from "@/providers/ai/providers";

let provider: AIProvider | null | undefined;

/** Returns the configured provider, or null when AI is disabled (the default). */
export function getAIProvider(): AIProvider | null {
  if (provider !== undefined) return provider;
  const e = env();
  switch (e.AI_PROVIDER) {
    case "openai":
      provider = e.AI_API_KEY ? new OpenAICompatibleProvider("openai", e.AI_BASE_URL ?? "https://api.openai.com/v1", e.AI_MODEL ?? "gpt-4o-mini", e.AI_API_KEY) : null;
      break;
    case "anthropic":
      provider = e.AI_API_KEY ? new AnthropicProvider(e.AI_API_KEY, e.AI_MODEL ?? "claude-3-5-haiku-latest", e.AI_BASE_URL) : null;
      break;
    case "gemini":
      provider = e.AI_API_KEY ? new GeminiProvider(e.AI_API_KEY, e.AI_MODEL ?? "gemini-1.5-flash", e.AI_BASE_URL) : null;
      break;
    case "local":
      provider = new OpenAICompatibleProvider("local", e.AI_BASE_URL ?? "http://localhost:11434/v1", e.AI_MODEL ?? "llama3.2", e.AI_API_KEY);
      break;
    default:
      provider = null;
  }
  return provider;
}
