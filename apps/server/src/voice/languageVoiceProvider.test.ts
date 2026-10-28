import { describe, expect, it, vi } from 'vitest'
import { LanguageVoiceProvider } from './languageVoiceProvider.js'
import type { VoiceProvider, VoiceSynthesisInput } from './provider.js'

const input: VoiceSynthesisInput = { text: '大丈夫。', textLanguage: 'ja', referencePath: '/ja.wav', promptText: 'こんにちは。', promptLanguage: 'ja', speed: 1 }
function backend(id: string): VoiceProvider {
  return { id, capabilities: { voiceClone: true, instructionEmotion: id === 'cosyvoice', emotionReference: id === 'gpt-sovits', speedControl: true }, health: vi.fn().mockResolvedValue({ ok: true, provider: id, message: 'ready' }), synthesize: vi.fn().mockResolvedValue({ bytes: Buffer.from('wave'), mimeType: 'audio/wav' }) }
}
describe('language-specific local voice routing', () => {
  it('switches to Japanese reference synthesis and switches back for Chinese dialogue', async () => {
    let active: 'cosyvoice' | 'gpt-sovits' = 'cosyvoice'
    const engine = { get activeProviderId() { return active }, selectLanguage: vi.fn(async (language: string) => { active = language.startsWith('ja') ? 'gpt-sovits' : 'cosyvoice' }), status: () => ({ state: 'running' as const, installed: true, canManage: true, message: 'ready' }) }
    const primary = backend('cosyvoice'), japanese = backend('gpt-sovits')
    const provider = new LanguageVoiceProvider(primary, japanese, engine)
    expect((await provider.synthesize(input)).providerMetadata).toMatchObject({ actualProvider: 'gpt-sovits', languageRouting: true })
    expect(japanese.synthesize).toHaveBeenCalledWith(input)
    expect(primary.synthesize).not.toHaveBeenCalled()
    expect(provider.capabilities.instructionEmotion).toBe(false)
    await provider.synthesize({ ...input, textLanguage: 'zh', text: '没关系。' })
    expect(primary.synthesize).toHaveBeenCalled()
    expect(provider.capabilities.instructionEmotion).toBe(true)
  })
  it('waits for the selected model to become ready before submitting a reference', async () => {
    const primary = backend('cosyvoice'), japanese = backend('gpt-sovits')
    vi.mocked(japanese.health).mockResolvedValueOnce({ ok: false, provider: 'gpt-sovits', message: 'loading' })
    const delay = vi.fn().mockResolvedValue(undefined)
    const engine = { activeProviderId: 'gpt-sovits' as const, selectLanguage: vi.fn(), status: () => ({ state: 'starting' as const, installed: true, canManage: true, message: 'loading' }) }
    await new LanguageVoiceProvider(primary, japanese, engine, delay).synthesize(input)
    expect(delay).toHaveBeenCalledOnce()
    expect(japanese.synthesize).toHaveBeenCalledOnce()
  })
  it('stops cleanly when the user stops the model during language loading', async () => {
    const primary = backend('cosyvoice'), japanese = backend('gpt-sovits')
    const engine = { activeProviderId: 'gpt-sovits' as const, selectLanguage: vi.fn(), status: () => ({ state: 'stopped' as const, installed: true, canManage: true, message: 'stopped' }) }
    await expect(new LanguageVoiceProvider(primary, japanese, engine).synthesize(input)).rejects.toThrow('已停止')
    expect(japanese.synthesize).not.toHaveBeenCalled()
  })
})
