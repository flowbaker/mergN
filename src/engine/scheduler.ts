import type { StepStatus } from '../atoms/index'
import type { Workflow } from './graph'
import { dependenciesOf } from './graph'
import type { RunLogStore } from './log'
import type { Queue } from './queue'

export class Scheduler {
  constructor(
    private workflow: Workflow,
    private log: RunLogStore,
    private queue: Queue,
  ) {}

  async tick(runId: string): Promise<void> {
    const log = await this.log.get(runId)
    const status = new Map<string, StepStatus>()
    for (const record of log.records) status.set(record.nodeId, record.status)

    for (const node of this.workflow.nodes) {
      const current = status.get(node.nodeId)
      if (current === 'done' || current === 'pending') continue
      const ready = dependenciesOf(node).every((dep) => status.get(dep) === 'done')
      if (ready) await this.queue.enqueue({ runId, nodeId: node.nodeId })
    }
  }
}
