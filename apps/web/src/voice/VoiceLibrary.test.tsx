// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import VoiceLibrary from './VoiceLibrary'

const api = vi.hoisted(() => ({ list: vi.fn(), health: vi.fn(), create: vi.fn(), assets: vi.fn(), attach: vi.fn() }))
vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return {
    ...original,
    getVoiceProfiles: (...args: unknown[]) => api.list(...args),
    getVoiceProviderHealth: (...args: unknown[]) => api.health(...args),
    createVoiceProfile: (...args: unknown[]) => api.create(...args),
    getAssetLibrary: (...args: unknown[]) => api.assets(...args),
    attachVoiceReference: (...args: unknown[]) => api.attach(...args),
  }
})

describe('VoiceLibrary', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('shows reusable profiles and a clear offline fallback', async () => {
    api.list.mockResolvedValue([{ id: 'voice', name: '雪·轻声', description: '近距离的自然声线', language: 'zh', tags: '["温柔"]', status: 'active', provider: 'gpt-sovits', defaultEmotion: '自然', defaultSpeed: 1, references: [], bindings: [] }])
    api.health.mockResolvedValue({ ok: false, provider: 'none', message: '未配置声音生成服务' })
    api.assets.mockResolvedValue([])
    render(<VoiceLibrary />)

    expect((await screen.findAllByText('雪·轻声')).length).toBeGreaterThan(0)
    expect(screen.getByText(/未配置声音生成服务/)).toBeInTheDocument()
    expect(screen.getByText(/手动上传配音仍可使用/)).toBeInTheDocument()
  })

  it('requires rights confirmation before creating a private profile', async () => {
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
})
