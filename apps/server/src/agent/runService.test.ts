import { describe, expect, it } from 'vitest'
import { RunAbortRegistry } from './runService.js'

describe('RunAbortRegistry', () => {
  it('aborts and releases the controller for a running task', () => {
    const registry = new RunAbortRegistry()
    const controller = registry.create('run')
    expect(controller.signal.aborted).toBe(false)
    expect(registry.abort('run')).toBe(true)
    expect(controller.signal.aborted).toBe(true)
    registry.release('run')
    expect(registry.abort('run')).toBe(false)
  })
})
