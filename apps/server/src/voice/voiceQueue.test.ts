import { describe, expect, it } from 'vitest'
import { SerialVoiceQueue } from './voiceQueue.js'

describe('SerialVoiceQueue', () => {
  it('runs GPT-SoVITS work strictly one at a time and preserves FIFO order', async () => {
    const queue = new SerialVoiceQueue()
    const events: string[] = []
    let releaseFirst: (() => void) | undefined

    const first = queue.enqueue(async () => {
      events.push('first:start')
      await new Promise<void>((resolve) => { releaseFirst = resolve })
      events.push('first:end')
      return 'first'
    })
    const second = queue.enqueue(async () => {
      events.push('second:start')
      events.push('second:end')
      return 'second'
    })

    await Promise.resolve()
    expect(events).toEqual(['first:start'])
    releaseFirst?.()
    await expect(first).resolves.toBe('first')
    await expect(second).resolves.toBe('second')
    expect(events).toEqual(['first:start', 'first:end', 'second:start', 'second:end'])
  })

  it('continues with the next task after a failure', async () => {
    const queue = new SerialVoiceQueue()
    const failed = queue.enqueue(async () => { throw new Error('failed') })
    const next = queue.enqueue(async () => 'ready')
    await expect(failed).rejects.toThrow('failed')
    await expect(next).resolves.toBe('ready')
  })
})
