import { describe, expect, it, vi } from 'vitest'
import type { Node } from '@xyflow/react'
import type { Asset, VoiceGenerationJob, VoiceProfile } from '../api/client'
import { AutomaticVoiceController, type AutomaticVoiceSnapshot } from './automaticVoice'

function setup() {
  const snapshot: AutomaticVoiceSnapshot = { projectId: 'p', chapterId: 'c', locale: 'ja', enabled: true, settled: true, preferredSceneId: 'second', nodes: [
    { id: 'one', type: 'dialogue', position: { x: 0, y: 0 }, data: { role: '雪', text: '一起回家吧。', sceneGroupId: 'first' } },
    { id: 'two', type: 'dialogue', position: { x: 0, y: 0 }, data: { role: '雪', text: '等我一下。', sceneGroupId: 'second' } },
  ], profiles: [{ id: 'voice', status: 'active', references: [{ id: 'ref', status: 'active', language: 'ja' }], bindings: [{ project: { id: 'p' }, character: { id: 'snow', name: '雪' } }] }] as VoiceProfile[] }
  const jobs = vi.fn(async () => [] as VoiceGenerationJob[])
  const translate = vi.fn(async (text: string) => ({ text: `日本語:${text}` }))
  const generate = vi.fn(async (input) => ({ id: `job-${input.nodeId}`, status: 'completed', text: input.text, language: input.language, outputUrl: '/take.wav' }) as VoiceGenerationJob)
  const poll = vi.fn(async () => ({} as VoiceGenerationJob))
  const accept = vi.fn(async (id: string) => ({ id, url: `/${id}.wav` }) as Asset)
  const commit = vi.fn((nodes: Node[]) => { snapshot.nodes = nodes })
  const status = vi.fn()
  const controller = new AutomaticVoiceController({ snapshot: () => snapshot, jobs, translate, generate, poll, accept, commit, status, sleep: async () => undefined })
  return { snapshot, jobs, translate, generate, poll, accept, commit, status, controller }
}

describe('automatic character dubbing', () => {
  it('prioritizes the edited scene, translates and links every line without per-line actions, then generates only changed text', async () => {
    const s = setup()
    await s.controller.run()
    expect(s.generate.mock.calls.map(([input]) => input.nodeId)).toEqual(['two', 'one'])
    expect(s.snapshot.nodes[0].data).toMatchObject({ text: '一起回家吧。', localizations: { ja: { text: '日本語:一起回家吧。' } }, voiceTracks: { ja: { profileId: 'voice' } } })
    await s.controller.run()
    expect(s.generate).toHaveBeenCalledTimes(2)
    s.snapshot.nodes[0] = { ...s.snapshot.nodes[0], data: { ...s.snapshot.nodes[0].data, text: '明天见。' } }
    await s.controller.run()
    expect(s.generate).toHaveBeenCalledTimes(3)
    expect(s.generate.mock.calls[2][0].sourceText).toBe('明天见。')
  })
  it('recovers an in-flight matching task instead of retranslating or generating it again', async () => {
    const s = setup(); s.snapshot.nodes = [s.snapshot.nodes[0]]
    const job = { id: 'existing', projectId: 'p', chapterId: 'c', nodeId: 'one', profileId: 'voice', referenceId: 'ref', language: 'ja', text: '一緒に帰ろう。', status: 'running', providerMetadata: JSON.stringify({ sourceText: '一起回家吧。' }) } as VoiceGenerationJob
    s.jobs.mockResolvedValue([job]); s.poll.mockResolvedValue({ ...job, status: 'completed', outputUrl: '/existing.wav', acceptedAsset: { id: 'asset', url: '/existing.wav' } as Asset })
    await s.controller.run()
    expect(s.generate).not.toHaveBeenCalled(); expect(s.translate).not.toHaveBeenCalled(); expect(s.accept).not.toHaveBeenCalled()
    expect(s.snapshot.nodes[0].data).toMatchObject({ voiceTracks: { ja: { url: '/existing.wav' } } })
  })
  it.each(['text', 'binding', 'manual audio', 'scope'])('does not overwrite %s changed while acceptance is in flight', async (change) => {
    const s = setup(); s.snapshot.nodes = [s.snapshot.nodes[0]]
    s.accept.mockImplementation(async () => {
      if (change === 'text') s.snapshot.nodes[0].data.text = '新台词。'
      if (change === 'binding') s.snapshot.profiles = []
      if (change === 'manual audio') s.snapshot.nodes[0].data.voiceTracks = { ja: { url: '/manual.wav' } }
      if (change === 'scope') s.snapshot.chapterId = 'other'
      s.snapshot.settled = false
      return { id: 'asset', url: '/old.wav' } as Asset
    })
    await s.controller.run()
    expect(s.commit).not.toHaveBeenCalled()
  })
  it('stops submitting on pause and prevents concurrent runs', async () => {
    const s = setup()
    let finish!: (value: VoiceGenerationJob) => void
    s.generate.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const running = s.controller.run()
    await vi.waitFor(() => expect(s.generate).toHaveBeenCalledTimes(1))
    await s.controller.run()
    s.snapshot.enabled = false
    finish({ id: 'job', status: 'completed', text: '声', language: 'ja', emotion: '自然', speed: 1 })
    await running
    expect(s.generate).toHaveBeenCalledTimes(1); expect(s.accept).not.toHaveBeenCalled()
  })
  it('pauses after a provider failure until an explicit retry', async () => {
    const s = setup()
    s.generate.mockRejectedValueOnce(new Error('引擎未启动'))
    await s.controller.run(); await s.controller.run()
    expect(s.generate).toHaveBeenCalledTimes(1)
    expect(s.status).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'error', message: '引擎未启动' }))
    s.controller.retry(); await s.controller.run()
    expect(s.generate).toHaveBeenCalledTimes(3)
    expect(s.status).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'ready' }))
  })
})
