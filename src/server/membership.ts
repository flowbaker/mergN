import { randomUUID } from "node:crypto";
import type { DocStore } from "../store/docstore";

const SYS = "__sys";
const SPACES = "spaces";

export interface SpaceDoc {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface Membership {
  ensurePersonalSpace(user: {
    id: string;
    name?: string;
    email: string;
  }): Promise<SpaceDoc>;
  listSpaces(userId: string): Promise<SpaceDoc[]>;
  createSpace(userId: string, name: string): Promise<SpaceDoc>;
  getSpace(spaceId: string): Promise<SpaceDoc | null>;
  canAccess(userId: string, spaceId: string): Promise<boolean>;
}

export function createMembership(store: DocStore): Membership {
  async function all(): Promise<SpaceDoc[]> {
    return (await store.list(SYS, SPACES)) as unknown as SpaceDoc[];
  }

  async function getSpace(spaceId: string): Promise<SpaceDoc | null> {
    return (await store.get(SYS, SPACES, spaceId)) as unknown as SpaceDoc | null;
  }

  async function createSpace(userId: string, name: string): Promise<SpaceDoc> {
    const id = randomUUID();
    const doc: SpaceDoc = {
      id,
      name: name.trim() || "Workspace",
      ownerId: userId,
      createdAt: new Date().toISOString(),
    };
    await store.put(SYS, SPACES, id, doc as unknown as Record<string, unknown>);
    return doc;
  }

  async function listSpaces(userId: string): Promise<SpaceDoc[]> {
    return (await all()).filter((s) => s.ownerId === userId);
  }

  return {
    getSpace,
    createSpace,
    listSpaces,
    async ensurePersonalSpace(user) {
      const mine = await listSpaces(user.id);
      if (mine.length) return mine[0];
      const label = (user.name || user.email.split("@")[0] || "Personal").trim();
      return createSpace(user.id, `${label}'s space`);
    },
    async canAccess(userId, spaceId) {
      const s = await getSpace(spaceId);
      return Boolean(s) && s!.ownerId === userId;
    },
  };
}
