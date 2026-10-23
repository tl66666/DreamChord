import { describe, expect, it, vi } from 'vitest'
import { GptSovitsProvider } from './gptSovitsProvider.js'
import { readVoiceProviderConfig } from './providerConfig.js'

describe('GPT-SoVITS provider', () => {
  it('maps DreamChord synthesis input to the official /tts contract', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'content-type': 'audio/wav', 'x-seed': '42' },
    }))
    const provider = new GptSovitsProvider({ baseUrl: 'http://127.0.0.1:9880', timeoutMs: 5000 }, fetcher)

    const result = await provider.synthesize({
      text: '你好，世界。',
      textLanguage: 'zh',
      referencePath: 'C:\\voice-library\\sample.wav',
      promptText: '这是一段参考音频。',
      promptLanguage: 'zh',
      speed: 0.95,
      seed: 42,
    })

    expect(result.bytes).toEqual(Buffer.from([1, 2, 3]))
    expect(result.mimeType).toBe('audio/wav')
    const [url, init] = fetcher.mock.calls[0]!
    expect(url).toBe('http://127.0.0.1:9880/tts')
    expect(JSON.parse(init.body)).toMatchObject({
      text: '你好，世界。', text_lang: 'zh', ref_audio_path: 'C:\\voice-library\\sample.wav',
      prompt_text: '这是一段参考音频。', prompt_lang: 'zh', speed_factor: 0.95, seed: 42,
      media_type: 'wav', streaming_mode: false,
    })
  })

  it('returns a bounded provider error without exposing the reference path', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('model unavailable', { status: 503 }))
    const provider = new GptSovitsProvider({ baseUrl: 'http://127.0.0.1:9880', timeoutMs: 5000 }, fetcher)

    await expect(provider.synthesize({
      text: 'test', textLanguage: 'en', referencePath: 'C:\\secret\\voice.wav', promptText: 'sample', promptLanguage: 'en', speed: 1,
    })).rejects.toThrow('GPT-SoVITS 请求失败（503）')
  })

  it('accepts only a server-configured loopback endpoint in the first release', () => {
    expect(readVoiceProviderConfig({ VOICE_PROVIDER: 'gpt-sovits', GPT_SOVITS_BASE_URL: 'http://localhost:9880' })).toMatchObject({ enabled: true })
    expect(readVoiceProviderConfig({ VOICE_PROVIDER: 'gpt-sovits', GPT_SOVITS_BASE_URL: 'https://example.com' })).toMatchObject({ enabled: false, reason: expect.stringContaining('本机') })
    expect(readVoiceProviderConfig({})).toMatchObject({ enabled: false, reason: expect.stringContaining('未配置') })
  })
})
