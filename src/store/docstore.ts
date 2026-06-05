import { mkdir, readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";

export interface DocStore {
  spaces(): Promise<string[]>;
  list(spaceId: string, collection: string): Promise<Record<string, unknown>[]>;
  get(
    spaceId: string,
    collection: string,
    id: string,
  ): Promise<Record<string, unknown> | null>;
  put(
    spaceId: string,
    collection: string,
    id: string,
    doc: Record<string, unknown>,
  ): Promise<void>;
  remove(spaceId: string, collection: string, id: string): Promise<void>;
}

const SAFE = /^[A-Za-z0-9_-]+$/;

export function assertSpace(id: string): string {
  if (!SAFE.test(id)) throw new Error(`invalid space id: ${id}`);
  return id;
}

export class FileStore implements DocStore {
  constructor(private root: string) {}

  private dir(spaceId: string, collection: string): string {
    return join(this.root, assertSpace(spaceId), collection);
  }

  private safe(id: string): string {
    if (!SAFE.test(id)) throw new Error("invalid id");
    return id;
  }

  async spaces(): Promise<string[]> {
    try {
      const entries = await readdir(this.root, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory() && SAFE.test(e.name))
        .map((e) => e.name);
    } catch {
      return [];
    }
  }

  async list(
    spaceId: string,
    collection: string,
  ): Promise<Record<string, unknown>[]> {
    const dir = this.dir(spaceId, collection);
    await mkdir(dir, { recursive: true });
    const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
    const out: Record<string, unknown>[] = [];
    for (const file of files) {
      try {
        out.push(JSON.parse(await readFile(join(dir, file), "utf8")));
      } catch {
        continue;
      }
    }
    return out;
  }

  async get(
    spaceId: string,
    collection: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      return JSON.parse(
        await readFile(
          join(this.dir(spaceId, collection), `${this.safe(id)}.json`),
          "utf8",
        ),
      );
    } catch {
      return null;
    }
  }

  async put(
    spaceId: string,
    collection: string,
    id: string,
    doc: Record<string, unknown>,
  ): Promise<void> {
    const dir = this.dir(spaceId, collection);
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, `${this.safe(id)}.json`),
      JSON.stringify(doc, null, 2),
    );
  }

  async remove(spaceId: string, collection: string, id: string): Promise<void> {
    try {
      await unlink(join(this.dir(spaceId, collection), `${this.safe(id)}.json`));
    } catch {
      return;
    }
  }
}
