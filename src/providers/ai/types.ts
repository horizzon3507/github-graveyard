export interface CompletionRequest {
  system: string;
  prompt: string;
  maxTokens?: number;
}

/** Provider-agnostic text generation. Implement this to plug in a new model vendor. */
export interface AIProvider {
  readonly name: string;
  complete(request: CompletionRequest): Promise<string>;
}
