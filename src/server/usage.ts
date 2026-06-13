import type { DocStore } from "../store/docstore";

// Per-space monthly usage counters used to enforce plan limits:
//   chats    — number of AI conversations started this calendar month (Free cap)
//   aiTokens — AI tokens consumed this month (Pro cap)
// Reset implicitly when the calendar month rolls over (period changes).

const SYS = "__sys";
const COLLECTION = "space_usage";

export interface SpaceUsage {
  spaceId: string;
  period: string; // YYYY-MM
  chats: number;
  aiTokens: number;
  updatedAt: string;
}

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

export interface UsageStore {
  get(spaceId: string): Promise<SpaceUsage>;
  recordChat(spaceId: string): Promise<void>;
  addTokens(spaceId: string, tokens: number): Promise<void>;
}

export function createUsageStore(store: DocStore): UsageStore {
  async function read(spaceId: string): Promise<SpaceUsage> {
    const raw = (await store.get(SYS, COLLECTION, spaceId)) as unknown as
      | SpaceUsage
      | null;
    const period = currentPeriod();
    if (!raw || raw.period !== period) {
      // new space or a new month — start fresh
      return { spaceId, period, chats: 0, aiTokens: 0, updatedAt: "" };
    }
    return raw;
  }

  async function write(u: SpaceUsage): Promise<void> {
    u.updatedAt = new Date().toISOString();
    await store.put(
      SYS,
      COLLECTION,
      u.spaceId,
      u as unknown as Record<string, unknown>,
    );
  }

  return {
    get: read,
    async recordChat(spaceId) {
      const u = await read(spaceId);
      u.chats += 1;
      await write(u);
    },
    async addTokens(spaceId, tokens) {
      if (!tokens || tokens < 0) return;
      const u = await read(spaceId);
      u.aiTokens += tokens;
      await write(u);
    },
  };
}
