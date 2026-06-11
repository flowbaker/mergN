import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  wrapLanguageModel,
  defaultSettingsMiddleware,
  type LanguageModel,
} from "ai";

// OpenAI's structured outputs run in "strict" mode, which rejects any schema
// whose `required` array doesn't list EVERY property — our schemas use optional
// fields (cron, placeholder, …). Turning strict off lets OpenAI accept them
// (gpt-4o still follows the schema). Other providers ignore this.
const openaiStrictOff = defaultSettingsMiddleware({
  settings: { providerOptions: { openai: { strictJsonSchema: false } } },
});

export interface LlmConfig {
  provider: string; // google | openai | anthropic | local
  model?: string;
  baseURL?: string;
  apiKey?: string;
}

// Runtime override set from the in-app settings (DB). Takes precedence over env.
let override: LlmConfig | null = null;

export function setLlmConfig(cfg: LlmConfig | null): void {
  override = cfg && cfg.provider ? cfg : null;
}

export function getLlmConfig(): LlmConfig {
  if (override) return override;
  return {
    provider: (process.env.LLM_PROVIDER ?? "google").toLowerCase(),
    model: process.env.LLM_MODEL,
    baseURL: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY,
  };
}

export function getModel(): LanguageModel {
  const { provider, model, baseURL, apiKey } = getLlmConfig();

  switch (provider) {
    case "local":
    case "openai-compatible": {
      const p = createOpenAICompatible({
        name: "local",
        baseURL: baseURL ?? "http://localhost:11434/v1",
        apiKey: apiKey ?? "local",
        // local servers (Ollama/LM Studio/vLLM) that speak json_schema can do
        // the structured output the agents rely on.
        supportsStructuredOutputs: true,
      });
      return p(model ?? "llama3.1");
    }
    case "openai": {
      const openai = createOpenAI({ baseURL, apiKey });
      return wrapLanguageModel({
        model: openai(model ?? "gpt-4o-mini"),
        middleware: openaiStrictOff,
      });
    }
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(model ?? "claude-3-5-sonnet-latest");
    }
    case "google":
    default: {
      const m = model ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
      return apiKey ? createGoogleGenerativeAI({ apiKey })(m) : google(m);
    }
  }
}
