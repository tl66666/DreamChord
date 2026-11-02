import { describe, expect, it, vi } from 'vitest'
import { ProjectVoicePreparation, type PreparationLine } from './projectVoicePreparation.js'

const a = { chapterId: 'chapter-a', nodeId: 'a', text: '你好', profileId: 'voice-a' } as PreparationLine
const b = { ...a, chapterId: 'chapter-b', nodeId: 'b' }
describe('whole project voice preparation', () => {
  it('prepares every chapter once and reuses already ready lines', async () => {
    const pending = [a, b]
    const render = vi.fn(async () => ({ url: '/take.wav', text: 'こんにちは' }))
    const manager = new ProjectVoicePreparation({ scan: async () => ({ pending: [...pending], ready: 3 - pending.length, unbound: 0 }), render, commit: async (_owner, _project, _locale, line) => { pending.splice(pending.findIndex(n => n.nodeId === line.nodeId), 1); return true } })
    const task = manager.start('owner', 'project', 'ja')
    expect(manager.start('owner', 'project', 'ja')).toBe(task)
    await manager.settled('owner', 'project')
    expect(render).toHaveBeenCalledTimes(2)
    expect(manager.status('owner', 'project')).toMatchObject({ state: 'ready', ready: 3, pending: 0 })
  })
  it('pause prevents a completed in-flight take from modifying the story', async () => {
    let finish!: (take: { url: string; text: string }) => void
    const commit = vi.fn(async () => true)
    const manager = new ProjectVoicePreparation({ scan: async () => ({ pending: [a], ready: 0, unbound: 0 }), render: () => new Promise(resolve => { finish = resolve }), commit })
    manager.start('owner', 'project', 'ja')
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    manager.pause('owner', 'project')
    finish({ url: '/late.wav', text: 'こんにちは' })
    await manager.settled('owner', 'project')
    expect(commit).not.toHaveBeenCalled()
    expect(manager.status('other-owner', 'project')).toBeUndefined()
    expect(manager.status('owner', 'project')?.state).toBe('paused')
  })
  it('stops on stale writes or provider failure and supports explicit retry', async () => {
    const render = vi.fn().mockRejectedValueOnce(new Error('声音服务未启动')).mockResolvedValue({ url: '/take.wav', text: '你好' })
    const manager = new ProjectVoicePreparation({ scan: async () => ({ pending: [a], ready: 0, unbound: 0 }), render, commit: async () => false })
    manager.start('owner', 'project', 'zh'); await manager.settled('owner', 'project')
    expect(manager.status('owner', 'project')).toMatchObject({ state: 'error', message: '声音服务未启动' })
    manager.start('owner', 'project', 'zh'); await manager.settled('owner', 'project')
    expect(render).toHaveBeenCalledTimes(2)
    expect(manager.status('owner', 'project')?.message).toContain('修改')
  })
})
