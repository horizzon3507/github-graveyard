import type { AIProvider, CompletionRequest } from "@/providers/ai/types";

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`AI provider responded ${res.status}`);
  return res.json();
}

/** Works with OpenAI and any OpenAI-compatible server (Ollama, LM Studio, vLLM, llama.cpp). */
export class OpenAICompatibleProvider implements AIProvider {
  constructor(
    readonly name: string,
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly apiKey?: string,
  ) {}

  async complete({ system, prompt, maxTokens = 300 }: CompletionRequest) {
    const json = await postJson(
      `${this.baseUrl.replace(/\/$/, "")}/chat/completions`,
      this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
      { model: this.model, max_tokens: maxTokens, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] },
    );
    return String(json.choices?.[0]?.message?.content ?? "").trim();
  }
}

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl = "https://api.anthropic.com",
  ) {}

  async complete({ system, prompt, maxTokens = 300 }: CompletionRequest) {
    const json = await postJson(
      `${this.baseUrl}/v1/messages`,
      { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
      { model: this.model, max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] },
    );
    return String(json.content?.[0]?.text ?? "").trim();
  }
}

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl = "https://generativelanguage.googleapis.com",
  ) {}

  async complete({ system, prompt, maxTokens = 300 }: CompletionRequest) {
    const json = await postJson(
      `${this.baseUrl}/v1beta/models/${this.model}:generateContent`,
      { "x-goog-api-key": this.apiKey },
      { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens } },
    );
    return String(json.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
  }
}
