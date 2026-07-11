export interface SecretAgentJob {
  id: string
  secretConfig?: unknown
}

export class InProcessAgentQueue<T extends SecretAgentJob> {
  private readonly pending: T[] = []
  private readonly idleWaiters: Array<() => void> = []
  private running = false

  constructor(
    private readonly worker: (job: T) => Promise<void>,
    private readonly onError: (job: T, error: unknown) => void = () => undefined,
  ) {}

  enqueue(job: T): void {
    this.pending.push(job)
    void this.drain()
  }

  whenIdle(): Promise<void> {
    if (!this.running && this.pending.length === 0) return Promise.resolve()
    return new Promise((resolve) => this.idleWaiters.push(resolve))
  }

  private async drain(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      while (this.pending.length > 0) {
        const job = this.pending.shift()
        if (!job) continue
        try {
          await this.worker(job)
        } catch (error) {
          this.onError(job, error)
        } finally {
          job.secretConfig = undefined
        }
      }
    } finally {
      this.running = false
      this.idleWaiters.splice(0).forEach((resolve) => resolve())
    }
  }
}
