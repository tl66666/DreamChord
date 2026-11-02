// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { voiceTextHash } from '@dreamchord/story-domain'
import { useEditorStore } from '../stores/editorStore'
import DialogueVoiceGenerator from './DialogueVoiceGenerator'
import { VOICE_PREFERENCE_CHANGED } from '../voice/characterVoicePlan'

const api = vi.hoisted(() => ({ profiles: vi.fn(), generate: vi.fn(), accept: vi.fn(), translate: vi.fn() }))
vi.mock('../api/client', async (original) => ({ ...await original<typeof import('../api/client')>(), getVoiceProfiles: api.profiles, createVoiceGeneration: api.generate, acceptVoiceGeneration: api.accept, translateVoiceText: api.translate }))
describe('dialogue voice generation', () => {
  beforeEach(() => {
    localStorage.clear()
    useEditorStore.setState({ project: { id: 'project', title: '故事' }, chapterId: 'chapter' })
    api.profiles.mockResolvedValue([{ id: 'voice', name: '雪的声线', status: 'active', bindings: [{ project: { id: 'project' }, character: { id: 'character', name: '雪' } }], references: [{ id: 'zh-ref', status: 'active', language: 'zh' }, { id: 'ja-ref', status: 'active', language: 'ja' }] }])
    api.accept.mockResolvedValue({ id: 'asset', url: '/uploads/ja.wav' })
  })
  afterEach(() => { cleanup(); vi.clearAllMocks() })
  it('inherits the saved project voice locale without changing existing voice tracks', async () => {
    useEditorStore.setState({ project: { id: 'project', title: '故事', defaultVoiceLocale: 'ja' } })
    const onUpdate = vi.fn()
    const data = { role: 'yuki', text: '谢谢你。', voiceTracks: { ja: { url: '/existing-ja.ogg' }, zh: { url: '/existing-zh.ogg' } } }
    render(<DialogueVoiceGenerator nodeId="node" data={data} onUpdate={onUpdate} />)
    await screen.findByText(/使用 雪的声线/)
    expect(screen.getByLabelText('生成配音语言')).toHaveValue('ja')
    expect(onUpdate).not.toHaveBeenCalled()
    expect(api.generate).not.toHaveBeenCalled()
  })
  it('preserves a manual language choice during the current edit when preferences refresh', async () => {
    const onUpdate = vi.fn()
    const view = render(<DialogueVoiceGenerator nodeId="node" data={{ role: 'yuki', text: '谢谢你。' }} onUpdate={onUpdate} />)
    await screen.findByText(/使用 雪的声线/)
    fireEvent.change(screen.getByLabelText('生成配音语言'), { target: { value: 'ja' } })
    act(() => window.dispatchEvent(new Event(VOICE_PREFERENCE_CHANGED)))
    view.rerender(<DialogueVoiceGenerator nodeId="node" data={{ role: 'yuki', text: '再见。' }} onUpdate={onUpdate} />)
    expect(screen.getByLabelText('生成配音语言')).toHaveValue('ja')
  })
  it('resets a manual language selection to the next project default', async () => {
    render(<DialogueVoiceGenerator nodeId="node" data={{ role: 'yuki', text: '谢谢你。' }} onUpdate={vi.fn()} />)
    await screen.findByText(/使用 雪的声线/)
    fireEvent.change(screen.getByLabelText('生成配音语言'), { target: { value: 'zh' } })
    act(() => useEditorStore.setState({ project: { id: 'other', title: '另一部故事', defaultVoiceLocale: 'ja' } }))
    expect(screen.getByLabelText('生成配音语言')).toHaveValue('ja')
  })
  it('adopts a project default loaded later when the user has not chosen a language', async () => {
    render(<DialogueVoiceGenerator nodeId="node" data={{ role: 'yuki', text: '谢谢你。' }} onUpdate={vi.fn()} />)
    await screen.findByText(/使用 雪的声线/)
    act(() => useEditorStore.setState({ project: { id: 'project', title: '故事', defaultVoiceLocale: 'ja' } }))
    expect(screen.getByLabelText('生成配音语言')).toHaveValue('ja')
  })
  it('uses the translated line and matching reference, preserving the other voice track', async () => {
    const data = { role: 'yuki', text: '谢谢你。', localizations: { ja: { text: 'ありがとう。' } }, voiceTracks: { zh: { url: '/zh.wav' } } }
    api.generate.mockResolvedValue({ id: 'job', status: 'completed', text: 'ありがとう。', language: 'ja', outputUrl: '/uploads/ja.wav' })
    const onUpdate = vi.fn()
    render(<DialogueVoiceGenerator nodeId="node" data={data} onUpdate={onUpdate} />)
    await screen.findByText(/使用 雪的声线/)
    fireEvent.change(screen.getByLabelText('生成配音语言'), { target: { value: 'ja' } })
    fireEvent.click(screen.getByRole('button', { name: '生成试听' }))
    await screen.findByLabelText('当前台词配音试听')
    expect(api.generate).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project', characterId: 'character', nodeId: 'node', referenceId: 'ja-ref', language: 'ja', text: 'ありがとう。', directionMode: 'auto' }))
    fireEvent.click(screen.getByText('试听满意，应用到日文轨'))
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ voiceTracks: { zh: { url: '/zh.wav' }, ja: { url: '/uploads/ja.wav', textHash: voiceTextHash('ありがとう。'), profileId: 'voice' } } })))
  })
  it('blocks an old take after the current text changes', async () => {
    const data = { role: 'yuki', text: '谢谢你。' }
    api.generate.mockResolvedValue({ id: 'job', status: 'completed', text: '谢谢你。', language: 'zh', outputUrl: '/uploads/zh.wav' })
    const onUpdate = vi.fn()
    const view = render(<DialogueVoiceGenerator nodeId="node" data={data} onUpdate={onUpdate} />)
    await screen.findByText(/使用 雪的声线/)
    fireEvent.click(screen.getByRole('button', { name: '生成试听' }))
    await screen.findByLabelText('当前台词配音试听')
    view.rerender(<DialogueVoiceGenerator nodeId="node" data={{ ...data, text: '别走。' }} onUpdate={onUpdate} />)
    expect(screen.getByText('试听满意，应用到中文轨')).toBeDisabled()
    expect(api.accept).not.toHaveBeenCalled()
  })
  it('translates Chinese automatically when Japanese voice is selected and no translation exists', async () => {
    api.translate.mockResolvedValue({ text: '一緒に帰ろう。' })
    api.generate.mockResolvedValue({ id: 'job', status: 'completed', text: '一緒に帰ろう。', language: 'ja', outputUrl: '/ja.wav' })
    const onUpdate = vi.fn()
    render(<DialogueVoiceGenerator nodeId="line" data={{ role: 'yuki', text: '一起回家吧。' }} onUpdate={onUpdate} />)
    await screen.findByText(/使用 雪的声线/)
    fireEvent.change(screen.getByLabelText('生成配音语言'), { target: { value: 'ja' } })
    fireEvent.click(screen.getByRole('button', { name: '生成试听' }))
    await screen.findByLabelText('当前台词配音试听')
    expect(api.translate).toHaveBeenCalledWith('一起回家吧。')
    expect(api.generate).toHaveBeenCalledWith(expect.objectContaining({ text: '一緒に帰ろう。', language: 'ja', sourceText: '一起回家吧。', sourceLanguage: 'zh' }))
    fireEvent.click(screen.getByText('试听满意，应用到日文轨'))
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ localizations: { ja: { text: '一緒に帰ろう。', sourceHash: voiceTextHash('一起回家吧。') } } })))
  })
  it('preserves a translation edited while the audition is being accepted', async () => {
    let finishAccept!: (asset: { id: string; url: string }) => void
    api.accept.mockReturnValue(new Promise((resolve) => { finishAccept = resolve }))
    api.generate.mockResolvedValue({ id: 'job', status: 'completed', text: 'ありがとう。', language: 'ja', outputUrl: '/ja.wav' })
    const data = { role: 'yuki', text: '谢谢你。', localizations: { ja: { text: 'ありがとう。' } } }
    const onUpdate = vi.fn()
    const view = render(<DialogueVoiceGenerator nodeId="line" data={data} onUpdate={onUpdate} />)
    await screen.findByText(/使用 雪的声线/)
    fireEvent.change(screen.getByLabelText('生成配音语言'), { target: { value: 'ja' } })
    fireEvent.click(screen.getByRole('button', { name: '生成试听' }))
    await screen.findByLabelText('当前台词配音试听')
    fireEvent.click(screen.getByText('试听满意，应用到日文轨'))
    view.rerender(<DialogueVoiceGenerator nodeId="line" data={{ ...data, localizations: { ja: { text: '本当にありがとう。' } } }} onUpdate={onUpdate} />)
    finishAccept({ id: 'asset', url: '/ja.wav' })
    await screen.findByText('译文已修改，候选已入库，没有覆盖你的新译文。')
    expect(onUpdate).not.toHaveBeenCalled()
  })
})
