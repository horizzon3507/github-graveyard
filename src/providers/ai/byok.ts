import { AppError } from "@/lib/errors";
import type { AIProvider } from "@/providers/ai/types";
import { AnthropicProvider, GeminiProvider, OpenAICompatibleProvider } from "@/providers/ai/providers";

export interface ByokPreset {
  id: string;
  label: string;
  defaultModel: string;
  keyUrl: string;
  note: string;
}

/** Fixed endpoints only: user-supplied URLs would let anyone make the server call internal hosts. */
export const BYOK_PRESETS: ByokPreset[] = [
  { id: "openai", label: "OpenAI", defaultModel: "gpt-4o-mini", keyUrl: "https://platform.openai.com/api-keys", note: "Billed to your OpenAI API account." },
  { id: "anthropic", label: "Anthropic", defaultModel: "claude-3-5-haiku-latest", keyUrl: "https://console.anthropic.com/settings/keys", note: "Billed to your Anthropic account." },
  { id: "gemini", label: "Google Gemini", defaultModel: "gemini-1.5-flash", keyUrl: "https://aistudio.google.com/apikey", note: "Has a free tier. Google may use free-tier data for training outside the EU/UK." },
  { id: "groq", label: "Groq", defaultModel: "openai/gpt-oss-20b", keyUrl: "https://console.groq.com/keys", note: "Free tier, no card." },
  { id: "openrouter", label: "OpenRouter", defaultModel: "openrouter/free", keyUrl: "https://openrouter.ai/keys", note: "Free models available (50 requests per day without credits)." },
];

const OPENAI_COMPATIBLE: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
};

export function isByokProvider(id: string): boolean {
  return BYOK_PRESETS.some((p) => p.id === id);
}

export function createByokProvider(id: string, apiKey: string, model?: string): AIProvider {
  const preset = BYOK_PRESETS.find((p) => p.id === id);
  if (!preset) throw new AppError("invalid_input", "Unsupported AI provider.");
  const chosen = model?.trim() || preset.defaultModel;
  if (id === "anthropic") return new AnthropicProvider(apiKey, chosen);
  if (id === "gemini") return new GeminiProvider(apiKey, chosen);
  return new OpenAICompatibleProvider(id, OPENAI_COMPATIBLE[id], chosen, apiKey);
}
