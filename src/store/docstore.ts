import { mkdir, readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";

export interface DocStore {
  list(collection: string): Promise<Record<string, unknown>[]>;
  get(collection: string, id: string): Promise<Record<string, unknown> | null>;
  put(collection: string, id: string, doc: Record<string, unknown>): Promise<void>;
  remove(collection: string, id: string): Promise<void>;
}

export class FileStore implements DocStore {
  constructor(private root: string = join(process.cwd(), "data")) {}

  private dir(collection: string): string {
    return join(this.root, collection);
  }

  private safe(id: string): string {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("invalid id");
    return id;
  }

  async list(collection: string): Promise<Record<string, unknown>[]> {
    const dir = this.dir(collection);
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

  async get(collection: string, id: string): Promise<Record<string, unknown> | null> {
    try {
      return JSON.parse(
        await readFile(join(this.dir(collection), `${this.safe(id)}.json`), "utf8"),
      );
    } catch {
      return null;
    }
  }

  async put(
    collection: string,
    id: string,
    doc: Record<string, unknown>,
  ): Promise<void> {
    const dir = this.dir(collection);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${this.safe(id)}.json`), JSON.stringify(doc, null, 2));
  }

  async remove(collection: string, id: string): Promise<void> {
    try {
      await unlink(join(this.dir(collection), `${this.safe(id)}.json`));
    } catch {
      return;
    }
  }
}

export const store: DocStore = new FileStore();
