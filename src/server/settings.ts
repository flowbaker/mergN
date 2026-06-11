import type { DocStore } from "../store/docstore";
import type { LlmConfig } from "../agent/model";

const SPACE = "_global";
const COLLECTION = "settings";
const LLM_ID = "llm";

export interface SettingsStore {
  getLlm(): Promise<LlmConfig | null>;
  setLlm(cfg: LlmConfig): Promise<void>;
}

export function createSettingsStore(store: DocStore): SettingsStore {
  return {
    async getLlm() {
      const doc = await store.get(SPACE, COLLECTION, LLM_ID);
      return doc ? (doc as unknown as LlmConfig) : null;
    },
    async setLlm(cfg) {
      await store.put(
        SPACE,
        COLLECTION,
        LLM_ID,
        cfg as unknown as Record<string, unknown>,
      );
    },
  };
}
