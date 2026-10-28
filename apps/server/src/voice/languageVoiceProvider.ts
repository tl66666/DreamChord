import type { LanguageManagedVoiceEngine } from './managedVoiceEngine.js'
import type { VoiceProvider, VoiceSynthesisInput } from './provider.js'

export class LanguageVoiceProvider implements VoiceProvider {
  readonly id = 'local-multilingual'
  constructor(private readonly primary: VoiceProvider, private readonly japanese: VoiceProvider, private readonly engine: Pick<LanguageManagedVoiceEngine, 'activeProviderId' | 'selectLanguage' | 'status'>, private readonly delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))) {}
  private current() { return this.engine.activeProviderId === 'gpt-sovits' ? this.japanese : this.primary }
  get capabilities() { return this.current().capabilities }
  async health() {
    const provider = this.current()
    const health = await provider.health()
    return provider === this.current() ? health : { ok: false, provider: this.current().id, message: '正在切换配音语言，请等待模型加载。' }
  }
  async synthesize(input: VoiceSynthesisInput) {
    await this.engine.selectLanguage(input.textLanguage)
    const provider = this.current()
    const deadline = Date.now() + 180000
    let ready = false
    while (Date.now() < deadline) {
      const state = this.engine.status().state
      if (state === 'failed' || state === 'stopped' || state === 'not-installed') throw new Error('声音引擎未启动或已停止，请在声音库重试。')
      if ((await provider.health()).ok) { ready = true; break }
      await this.delay(1000)
    }
    if (!ready) throw new Error('切换语言后模型加载超时，请在声音库检查状态。')
    const result = await provider.synthesize(input)
    return { ...result, providerMetadata: { ...result.providerMetadata, actualProvider: provider.id, textLanguage: input.textLanguage, languageRouting: true } }
  }
}
