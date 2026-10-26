// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import VoiceLibrary from './VoiceLibrary'

const api = vi.hoisted(() => ({
  list: vi.fn(), health: vi.fn(), create: vi.fn(), assets: vi.fn(), attach: vi.fn(), projects: vi.fn(),
  bind: vi.fn(), generate: vi.fn(), getJob: vi.fn(), jobs: vi.fn(), accept: vi.fn(), startEngine: vi.fn(), stopEngine: vi.fn(),
}))
vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return {
    ...original,
    getVoiceProfiles: (...args: unknown[]) => api.list(...args),
    getVoiceProviderHealth: (...args: unknown[]) => api.health(...args),
    createVoiceProfile: (...args: unknown[]) => api.create(...args),
    getAssetLibrary: (...args: unknown[]) => api.assets(...args),
    attachVoiceReference: (...args: unknown[]) => api.attach(...args),
    getMyProjects: (...args: unknown[]) => api.projects(...args),
    bindCharacterVoice: (...args: unknown[]) => api.bind(...args),
    createVoiceGeneration: (...args: unknown[]) => api.generate(...args),
    getVoiceGenerationJob: (...args: unknown[]) => api.getJob(...args),
    getVoiceGenerationJobs: (...args: unknown[]) => api.jobs(...args),
    acceptVoiceGeneration: (...args: unknown[]) => api.accept(...args),
    startVoiceEngine: (...args: unknown[]) => api.startEngine(...args),
    stopVoiceEngine: (...args: unknown[]) => api.stopEngine(...args),
  }
})

describe('VoiceLibrary', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  function common() {
    api.projects.mockResolvedValue([])
    api.jobs.mockResolvedValue([])
  }

  it('shows reusable profiles and a clear offline fallback', async () => {
    common()
    api.list.mockResolvedValue([{ id: 'voice', name: '雪·轻声', description: '近距离的自然声线', language: 'zh', tags: '["温柔"]', status: 'active', provider: 'gpt-sovits', defaultEmotion: '自然', defaultSpeed: 1, references: [], bindings: [] }])
    api.health.mockResolvedValue({ ok: false, provider: 'none', message: '未配置声音生成服务' })
    api.assets.mockResolvedValue([])
    render(<VoiceLibrary />)

    expect((await screen.findAllByText('雪·轻声')).length).toBeGreaterThan(0)
    expect(screen.getByText(/未配置声音生成服务/)).toBeInTheDocument()
    expect(screen.getByText(/手动上传配音仍可使用/)).toBeInTheDocument()
  })

  it('labels bundled synthetic voices and shows their provenance note', async () => {
    common()
    api.list.mockResolvedValue([{ id: 'starter-voice-profile-dreamchord-xingli', name: '星璃・清澈', description: '清亮自然', language: 'zh-CN', tags: '["合成音色"]', status: 'active', provider: 'gpt-sovits', defaultEmotion: '自然', defaultSpeed: 1, authorizationNote: 'DreamChord 内置合成起始音色，源自 hexgrad/Kokoro-82M/zf_xiaobei（Apache-2.0）；非真人声音克隆。', references: [], bindings: [] }])
    api.health.mockResolvedValue({ ok: true, provider: 'gpt-sovits', message: '服务可访问' })
    api.assets.mockResolvedValue([])
    render(<VoiceLibrary />)

    expect(await screen.findAllByText('梦弦内置 · 合成音')).not.toHaveLength(0)
    expect(screen.getByText(/Apache-2.0/)).toBeInTheDocument()
    expect(screen.getByText(/非真人声音克隆/)).toBeInTheDocument()
  })

  it('requires rights confirmation before creating a private profile', async () => {
    common()
    api.list.mockResolvedValue([])
    api.health.mockResolvedValue({ ok: true, provider: 'gpt-sovits', message: '服务可访问' })
    api.assets.mockResolvedValue([])
    api.create.mockResolvedValue({ id: 'new', name: '宫·温暖', description: '', language: 'zh', tags: '[]', status: 'active', provider: 'gpt-sovits', defaultEmotion: '自然', defaultSpeed: 1, references: [], bindings: [] })
    render(<VoiceLibrary />)

    fireEvent.click(await screen.findByRole('button', { name: '新建音色' }))
    fireEvent.change(screen.getByLabelText('音色名称'), { target: { value: '宫·温暖' } })
    const submit = screen.getByRole('button', { name: '创建私有音色' })
    expect(submit).toBeDisabled()
    fireEvent.click(screen.getByLabelText(/拥有本人同意或合法授权/))
    fireEvent.click(submit)

    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ name: '宫·温暖', authorizationConfirmed: true })))
    expect((await screen.findAllByText('宫·温暖')).length).toBeGreaterThan(0)
  })

  it('starts the embedded engine from the voice library without opening another app', async () => {
    common()
    api.list.mockResolvedValue([])
    api.assets.mockResolvedValue([])
    api.health.mockResolvedValue({ ok: false, provider: 'gpt-sovits', message: '无法连接', engine: { installed: true, canManage: true, state: 'stopped', message: '已安装，当前未启动。' } })
    api.startEngine.mockResolvedValue({ installed: true, canManage: true, state: 'starting', message: '正在加载模型。' })
    render(<VoiceLibrary />)

    fireEvent.click(await screen.findByRole('button', { name: '启动内置声音引擎' }))

    await waitFor(() => expect(api.startEngine).toHaveBeenCalledOnce())
    expect(screen.getByText(/正在加载模型/)).toBeInTheDocument()
  })

  it('guides binding, generation, preview and acceptance without training jargon', async () => {
    const reference = { id: 'reference', transcript: '今晚的风很安静。', language: 'zh', emotion: '自然', status: 'active', asset: { id: 'sample', name: '雪参考音', type: 'VOICE_SAMPLE', url: '/uploads/sample.wav' } }
    api.list.mockResolvedValue([{ id: 'voice', name: '雪·轻声', description: '', language: 'zh', tags: '[]', status: 'active', provider: 'gpt-sovits', defaultEmotion: '自然', defaultSpeed: 1, references: [reference], bindings: [] }])
    api.health.mockResolvedValue({ ok: true, provider: 'gpt-sovits', message: '服务可访问' })
    api.assets.mockResolvedValue([])
    api.projects.mockResolvedValue([{ id: 'project', title: '回声档案', description: '', cover: '', isPublic: false, isPublished: false, author: { username: 'demo', nickname: null }, chapters: [], characters: [{ id: 'snow', name: '雪', description: '', color: '#fff', defaultSprite: '' }] }])
    api.jobs.mockResolvedValue([])
    api.bind.mockResolvedValue({ id: 'binding', character: { id: 'snow', name: '雪' }, project: { id: 'project', title: '回声档案' } })
    api.generate.mockResolvedValue({ id: 'job', status: 'completed', text: '我们把这一刻写下来吧。', language: 'zh', emotion: '温柔', speed: 1, outputUrl: '/uploads/generated.wav', errorMessage: null, acceptedAsset: null, character: { id: 'snow', name: '雪' }, profile: { id: 'voice', name: '雪·轻声' } })
    api.accept.mockResolvedValue({ id: 'asset', name: '雪-对白', type: 'VOICE', url: '/uploads/generated.wav' })
    render(<VoiceLibrary />)

    await screen.findByText('角色绑定与试听生成')
    fireEvent.change(screen.getByLabelText('选择项目'), { target: { value: 'project' } })
    fireEvent.change(screen.getByLabelText('选择角色'), { target: { value: 'snow' } })
    fireEvent.click(screen.getByRole('button', { name: '绑定这个音色' }))
    await waitFor(() => expect(api.bind).toHaveBeenCalledWith('voice', { projectId: 'project', characterId: 'snow' }))

    fireEvent.change(screen.getByLabelText('试听台词'), { target: { value: '我们把这一刻写下来吧。' } })
    fireEvent.click(screen.getByRole('button', { name: '生成试听' }))
    expect(await screen.findByText('试听候选已完成')).toBeInTheDocument()
    expect(screen.getByLabelText('生成的配音试听')).toHaveAttribute('src', '/uploads/generated.wav')
    fireEvent.click(screen.getByRole('button', { name: '收入配音素材库' }))
    await waitFor(() => expect(api.accept).toHaveBeenCalledWith('job', expect.objectContaining({ name: expect.any(String) })))
  })
})
