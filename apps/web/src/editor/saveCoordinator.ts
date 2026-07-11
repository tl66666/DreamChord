export type SaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'conflict' | 'error'

export class SaveCoordinator<T> {
  state: SaveState = 'clean'
  private revision = 0
  private active: Promise<void> | null = null

  constructor(private readonly options: {
    readLatest: () => T
    save: (snapshot: T) => Promise<void>
    onStateChange?: (state: SaveState) => void
    onError?: (error: unknown, state: 'conflict' | 'error') => void
  }) {}

  get isDirty(): boolean { return this.state === 'dirty' || this.state === 'saving' || this.state === 'conflict' || this.state === 'error' }

  markDirty(): void {
    this.revision += 1
    if (this.state !== 'saving') this.setState('dirty')
  }

  flush(): Promise<void> {
    if (this.active) return this.active
    if (!this.isDirty) return Promise.resolve()
    this.active = this.run().finally(() => { this.active = null })
    return this.active
  }

  async whenIdle(): Promise<void> { if (this.active) await this.active }

  reset(): void {
    if (!this.active) { this.revision = 0; this.setState('clean') }
  }

  private async run(): Promise<void> {
    let hasNewerRevision = true
    while (hasNewerRevision) {
      const revision = this.revision
      const value = this.options.readLatest()
      this.setState('saving')
      try {
        await this.options.save(value)
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
        const message = error instanceof Error ? error.message : ''
        const state = code === 'conflict' || message.toLocaleLowerCase().includes('conflict') || message.includes('章节已被其他操作修改') ? 'conflict' : 'error'
        this.setState(state)
        this.options.onError?.(error, state)
        return
      }
      if (this.revision === revision) {
        hasNewerRevision = false
      }
    }
    this.setState('saved')
  }

  private setState(state: SaveState): void {
    this.state = state
    this.options.onStateChange?.(state)
  }
}
