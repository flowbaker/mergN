import type { StepRecord, RunLog, FuncDefinition } from "../atoms/index";
import type { Queue, QueueItem } from "./queue";
import type { RunLogStore } from "./log";
import type { FuncRegistry } from "./worker";

export class InMemoryQueue implements Queue {
  private items: QueueItem[] = [];

  async enqueue(item: QueueItem): Promise<void> {
    const exists = this.items.some(
      (i) => i.runId === item.runId && i.nodeId === item.nodeId,
    );
    if (!exists) this.items.push(item);
  }

  async pop(): Promise<QueueItem | null> {
    return this.items.shift() ?? null;
  }

  async ack(_item: QueueItem): Promise<void> {}

  async nack(item: QueueItem): Promise<void> {
    this.items.push(item);
  }
}

export class InMemoryRunLog implements RunLogStore {
  private records: StepRecord[] = [];

  async append(record: StepRecord): Promise<void> {
    this.records.push(record);
  }

  async get(runId: string): Promise<RunLog> {
    return { runId, records: this.records.filter((r) => r.runId === runId) };
  }

  async getStep(runId: string, nodeId: string): Promise<StepRecord | null> {
    const matches = this.records.filter(
      (r) => r.runId === runId && r.nodeId === nodeId,
    );
    return matches.length ? matches[matches.length - 1] : null;
  }
}

export class InMemoryFuncRegistry implements FuncRegistry {
  private defs = new Map<string, FuncDefinition>();

  register(def: FuncDefinition): void {
    this.defs.set(`${def.id}@${def.version}`, def);
  }

  async get(funcId: string, version: number): Promise<FuncDefinition> {
    const def = this.defs.get(`${funcId}@${version}`);
    if (!def) throw new Error(`func not found: ${funcId}@${version}`);
    return def;
  }
}
