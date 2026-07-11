import { describe, expect, it } from 'vitest'
import { InProcessAgentQueue } from './queue.js'

describe('InProcessAgentQueue', () => {
  it('runs jobs sequentially and disposes secrets', async () => {
    const order: string[] = []
    const first: { id: string; secretConfig?: { apiKey: string } } = { id: 'first', secretConfig: { apiKey: 'one' } }
    const second: { id: string; secretConfig?: { apiKey: string } } = { id: 'second', secretConfig: { apiKey: 'two' } }
    const queue = new InProcessAgentQueue(async (job) => {
      order.push(`start:${job.id}`)
      await Promise.resolve()
      order.push(`end:${job.id}`)
    })

    queue.enqueue(first)
    queue.enqueue(second)
    await queue.whenIdle()

    expect(order).toEqual(['start:first', 'end:first', 'start:second', 'end:second'])
    expect(first.secretConfig).toBeUndefined()
    expect(second.secretConfig).toBeUndefined()
  })
})
