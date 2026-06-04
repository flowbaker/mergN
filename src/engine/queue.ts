export interface QueueItem {
  runId: string
  nodeId: string
}

export interface Queue {
  enqueue(item: QueueItem): Promise<void>
  pop(): Promise<QueueItem | null>
  ack(item: QueueItem): Promise<void>
  nack(item: QueueItem): Promise<void>
}
