import { describe, expect, it, vi } from 'vitest'
import { SaveCoordinator } from './saveCoordinator'

describe('save coordinator', () => {
  it('serializes saves and performs exactly one follow-up with latest state', async () => {
    let value = 1
    let release!: () => void
    const first = new Promise<void>((resolve) => { release = resolve })
    const save = vi.fn(async (snapshot: number) => { if (snapshot === 1) await first })
    const coordinator = new SaveCoordinator({ readLatest: () => value, save })
    coordinator.markDirty()
    const pending = coordinator.flush()
    value = 2
    coordinator.markDirty()
    void coordinator.flush()
    value = 3
    coordinator.markDirty()
    release()
    await pending
    await coordinator.whenIdle()
    expect(save.mock.calls.map(([snapshot]) => snapshot)).toEqual([1, 3])
    expect(coordinator.state).toBe('saved')
  })

  it('reports conflict and error states without losing dirty work', async () => {
    const conflict = new SaveCoordinator({ readLatest: () => 1, save: async () => { throw Object.assign(new Error('conflict'), { code: 'conflict' }) } })
    conflict.markDirty(); await conflict.flush()
    expect(conflict.state).toBe('conflict')
    expect(conflict.isDirty).toBe(true)
    const failed = new SaveCoordinator({ readLatest: () => 1, save: async () => { throw new Error('offline') } })
    failed.markDirty(); await failed.flush()
    expect(failed.state).toBe('error')
  })
})
