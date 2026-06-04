import { mkdir, readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";

const DIR = join(process.cwd(), "data", "workflows");

export interface SavedWorkflow {
  id: string;
  name: string;
  funcs: unknown[];
  wires: unknown[];
  positions: Record<string, { x: number; y: number }>;
  config: Record<string, Record<string, string>>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowMeta {
  id: string;
  name: string;
  funcCount: number;
  updatedAt: string;
}

function safeId(id: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("invalid id");
  return id;
}

async function ensureDir(): Promise<void> {
  await mkdir(DIR, { recursive: true });
}

export async function listWorkflows(): Promise<WorkflowMeta[]> {
  await ensureDir();
  const files = (await readdir(DIR)).filter((f) => f.endsWith(".json"));
  const metas: WorkflowMeta[] = [];
  for (const file of files) {
    try {
      const wf = JSON.parse(
        await readFile(join(DIR, file), "utf8"),
      ) as SavedWorkflow;
      metas.push({
        id: wf.id,
        name: wf.name,
        funcCount: Array.isArray(wf.funcs) ? wf.funcs.length : 0,
        updatedAt: wf.updatedAt,
      });
    } catch {
      continue;
    }
  }
  metas.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return metas;
}

export async function getWorkflow(id: string): Promise<SavedWorkflow | null> {
  await ensureDir();
  try {
    return JSON.parse(
      await readFile(join(DIR, `${safeId(id)}.json`), "utf8"),
    ) as SavedWorkflow;
  } catch {
    return null;
  }
}

export async function saveWorkflow(
  input: Omit<SavedWorkflow, "createdAt" | "updatedAt">,
): Promise<SavedWorkflow> {
  await ensureDir();
  const existing = await getWorkflow(input.id);
  const now = new Date().toISOString();
  const wf: SavedWorkflow = {
    ...input,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await writeFile(join(DIR, `${safeId(input.id)}.json`), JSON.stringify(wf, null, 2));
  return wf;
}

export async function deleteWorkflow(id: string): Promise<void> {
  try {
    await unlink(join(DIR, `${safeId(id)}.json`));
  } catch {
    return;
  }
}
