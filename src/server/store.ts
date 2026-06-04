import { store } from "../store/docstore";

const COLLECTION = "workflows";

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

export async function listWorkflows(): Promise<WorkflowMeta[]> {
  const docs = (await store.list(COLLECTION)) as unknown as SavedWorkflow[];
  return docs
    .map((wf) => ({
      id: wf.id,
      name: wf.name,
      funcCount: Array.isArray(wf.funcs) ? wf.funcs.length : 0,
      updatedAt: wf.updatedAt,
    }))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getWorkflow(id: string): Promise<SavedWorkflow | null> {
  return (await store.get(COLLECTION, id)) as SavedWorkflow | null;
}

export async function saveWorkflow(
  input: Omit<SavedWorkflow, "createdAt" | "updatedAt">,
): Promise<SavedWorkflow> {
  const existing = await getWorkflow(input.id);
  const now = new Date().toISOString();
  const wf: SavedWorkflow = {
    ...input,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await store.put(COLLECTION, input.id, wf as unknown as Record<string, unknown>);
  return wf;
}

export async function deleteWorkflow(id: string): Promise<void> {
  await store.remove(COLLECTION, id);
}
