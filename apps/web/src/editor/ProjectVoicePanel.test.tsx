// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../stores/editorStore'
import ProjectVoicePanel from './ProjectVoicePanel'

const api = vi.hoisted(() => ({ profiles: vi.fn(), generate: vi.fn(), accept: vi.fn(), translate: vi.fn(), bind: vi.fn(), update: vi.fn() }))
vi.mock('../api/client', async (original) => ({ ...await original<typeof import('../api/client')>(), getVoiceProfiles: api.profiles, createVoiceGeneration: api.generate, acceptVoiceGeneration: api.accept, translateVoiceText: api.translate, bindCharacterVoice: api.bind, updateProject: api.update }))
const characters = [{ id: 'yuki-id', name: '雪' }, { id: 'ren-id', name: '影' }]
describe('chapter character voice workflow', () => {
  beforeEach(() => {
    localStorage.clear(); vi.resetAllMocks()
    useEditorStore.setState({ project: { id: 'project', title: '故事' }, chapterId: 'chapter' })
    useEditorStore.getState().hydrateGraph(characters.map((_, index) => ({ id: `line-${index}`, type: 'dialogue', position: { x: 0, y: 0 }, data: { role: index ? 'ren' : 'yuki', text: index ? '我会留下。' : '请别走。' } })), [])
    api.profiles.mockResolvedValue(characters.map((character, index) => ({ id: `voice-${index}`, name: `${character.name}的声音`, status: 'active', references: [{ id: `ref-${index}`, status: 'active', language: 'ja' }], bindings: [{ id: `binding-${index}`, project: { id: 'project' }, character }] })))
    api.translate.mockImplementation(async (text: string) => ({ text: text === '请别走。' ? '行かないで。' : 'ここに残る。' }))
    api.generate.mockImplementation(async (input) => ({ id: `job-${input.nodeId}`, status: 'completed', text: input.text, language: input.language, outputUrl: `/${input.nodeId}.wav` }))
    api.accept.mockImplementation(async (jobId: string) => ({ id: `asset-${jobId}`, url: `/${jobId}.wav` }))
    api.update.mockResolvedValue({ id: 'project', defaultVoiceLocale: 'ja' })
  })
  afterEach(() => { cleanup(); localStorage.clear() })
  it('generates all lines from fixed character voices and applies them together without changing Chinese text', async () => {
    render(<ProjectVoicePanel open onClose={() => undefined} characters={characters} />)
    await waitFor(() => expect(screen.getByLabelText('雪的固定音色')).toHaveValue('voice-0'))
    fireEvent.change(screen.getByLabelText('批量配音语言'), { target: { value: 'ja' } })
    await waitFor(() => expect(screen.getByLabelText('批量配音语言')).toHaveValue('ja'))
    expect(api.update).toHaveBeenCalledWith('project', { defaultVoiceLocale: 'ja' })
    fireEvent.click(screen.getByText('生成缺失台词'))
    await screen.findByText('本轮生成结束，可试听后统一应用。')
    expect(api.generate).toHaveBeenNthCalledWith(1, expect.objectContaining({ characterId: 'yuki-id', referenceId: 'ref-0', text: '行かないで。', sourceText: '请别走。', language: 'ja' }))
    expect(api.generate).toHaveBeenNthCalledWith(2, expect.objectContaining({ characterId: 'ren-id', referenceId: 'ref-1', text: 'ここに残る。', language: 'ja' }))
    fireEvent.click(screen.getByText('试听满意，应用 2 句'))
    await screen.findByText('已自动关联 2 句配音，中文字幕保留。')
    const nodes = useEditorStore.getState().nodes
    expect(nodes[0].data).toMatchObject({ text: '请别走。', localizations: { ja: { text: '行かないで。' } }, voiceTracks: { ja: { url: '/job-line-0.wav' } } })
    expect(nodes[1].data).toMatchObject({ text: '我会留下。', voiceTracks: { ja: { url: '/job-line-1.wav' } } })
    expect(api.accept).toHaveBeenCalledTimes(2)
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().nodes[0].data.voiceTracks).toBeUndefined()
  })
  it('preserves a line edited while accepted audio is being linked', async () => {
    let finish!: (asset: { id: string; url: string }) => void
    api.accept.mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    render(<ProjectVoicePanel open onClose={() => undefined} characters={characters} />)
    await waitFor(() => expect(screen.getByLabelText('雪的固定音色')).toHaveValue('voice-0'))
    fireEvent.click(screen.getByText('生成缺失台词'))
    await screen.findByText('本轮生成结束，可试听后统一应用。')
    fireEvent.click(screen.getByText('试听满意，应用 2 句'))
    await waitFor(() => expect(api.accept).toHaveBeenCalledTimes(1))
    useEditorStore.getState().updateNodeData('line-0', { text: '我改主意了。' })
    finish({ id: 'asset', url: '/old.wav' })
    await screen.findByText(/已自动关联 1 句配音/)
    expect(useEditorStore.getState().nodes[0].data).toMatchObject({ text: '我改主意了。' })
    expect(useEditorStore.getState().nodes[0].data.voiceTracks).toBeUndefined()
  })
})
