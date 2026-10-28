// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../stores/editorStore'
import AutomaticVoiceBar from './AutomaticVoiceBar'
import { automaticVoiceEnabled, enableAutomaticVoiceForBinding, saveAutomaticVoice } from './automaticVoicePreference'

const api = vi.hoisted(() => ({ generate: vi.fn(), accept: vi.fn() }))
vi.mock('../api/client', async (original) => ({ ...await original<typeof import('../api/client')>(),
  getVoiceProfiles: vi.fn(async () => [{ id: 'voice', status: 'active', references: [{ id: 'ref', language: 'zh', status: 'active' }], bindings: [{ project: { id: 'project' }, character: { id: 'snow', name: '雪' } }] }]),
  getVoiceGenerationJobs: vi.fn(async () => []), createVoiceGeneration: api.generate, acceptVoiceGeneration: api.accept,
}))
afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); vi.clearAllMocks() })

describe('automatic dubbing editor integration', () => {
  it('prepares and saves speech after a writing pause without opening the voice workbench', async () => {
    vi.useFakeTimers()
    useEditorStore.setState({ project: { id: 'project', title: '故事' }, chapterId: 'chapter', isLoading: false })
    useEditorStore.getState().hydrateGraph([{ id: 'line', type: 'dialogue', position: { x: 0, y: 0 }, data: { role: '雪', text: '放学后见。' } }], [])
    api.generate.mockImplementation(async (input) => ({ id: 'job', status: 'completed', text: input.text, language: 'zh' }))
    api.accept.mockResolvedValue({ id: 'asset', url: '/voice.wav' })
    const applied = vi.fn()
    render(<AutomaticVoiceBar projectId="project" preferredSceneId={null} suspended={false} onApplied={applied} onManage={() => undefined} />)
    await act(async () => { await Promise.resolve() })
    fireEvent.click(screen.getByLabelText('开启自动配音'))
    expect(api.generate).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(2300) })
    expect(api.generate).toHaveBeenCalledTimes(1)
    expect(useEditorStore.getState().nodes[0].data).toMatchObject({ text: '放学后见。', voiceTracks: { zh: { url: '/voice.wav' } } })
    expect(applied).toHaveBeenCalledOnce()
    expect(useEditorStore.getState().canUndo).toBe(false)
    expect(screen.getByText('1 句配音已就绪')).toBeInTheDocument()
    act(() => useEditorStore.getState().updateNodeData('line', { text: '明天见。' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(2300) })
    expect(api.generate).toHaveBeenCalledTimes(2)
    expect(useEditorStore.getState().undo).toBeDefined()
    act(() => useEditorStore.getState().undo())
    expect(useEditorStore.getState().nodes[0].data.text).toBe('放学后见。')
  })
  it('enables automatic mode on binding once, while respecting a deliberate pause', () => {
    expect(automaticVoiceEnabled('project')).toBe(false)
    enableAutomaticVoiceForBinding('project')
    expect(automaticVoiceEnabled('project')).toBe(true)
    saveAutomaticVoice('project', false)
    enableAutomaticVoiceForBinding('project')
    expect(automaticVoiceEnabled('project')).toBe(false)
  })
})
