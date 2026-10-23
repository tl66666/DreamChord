/** GPT-SoVITS keeps mutable global pipeline state, so the first integration is deliberately single-concurrency. */
export class SerialVoiceQueue {
  private tail: Promise<void> = Promise.resolve()

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task)
    this.tail = result.then(() => undefined, () => undefined)
    return result
  }
}

