import { describe, expect, it, vi } from 'vitest'
import { CosyVoiceProvider } from './cosyVoiceProvider.js'

describe('CosyVoice provider', () => {
  it('rejects unchecked Japanese synthesis rather than returning mispronounced dialogue', async () => {
    const fetcher = vi.fn()
    const provider = new CosyVoiceProvider({ baseUrl: 'http://127.0.0.1:50000', timeoutMs: 5000, sampleRate: 24000 }, fetcher)
    await expect(provider.synthesize({ text: '大丈夫。', textLanguage: 'ja', referencePath: '/sample.wav', promptText: 'こんにちは。', promptLanguage: 'ja', speed: 1 })).rejects.toThrow('GPT-SoVITS')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('does not mistake another HTTP service for a ready voice model', async () => {
    const provider = new CosyVoiceProvider(
      { baseUrl: 'http://127.0.0.1:50000', timeoutMs: 5000, sampleRate: 24000 },
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, provider: 'another-app' }))),
    )
    expect(await provider.health()).toMatchObject({ ok: false, provider: 'cosyvoice' })
  })

  it('maps voice clone plus direction to the official instruct2 multipart endpoint', async () => {
    const pcm = new Int16Array([0, 1200, -1200, 0])
    const fetcher = vi.fn().mockResolvedValue(new Response(pcm.buffer, { status: 200 }))
    const readReference = vi.fn().mockResolvedValue(Buffer.from([82, 73, 70, 70]))
    const provider = new CosyVoiceProvider(
      { baseUrl: 'http://127.0.0.1:50000', timeoutMs: 5000, sampleRate: 24000 },
      fetcher,
      readReference,
    )

    expect(provider.capabilities).toMatchObject({ instructionEmotion: true, voiceClone: true, speedControl: true })
    const result = await provider.synthesize({
      text: '我不会再把你删掉。', textLanguage: 'zh', referencePath: 'C:\\voices\\yuki.wav',
      promptText: '这是参考台词。', promptLanguage: 'zh', speed: 0.94,
      direction: {
        emotion: 'resolve', intensity: 0.65, pace: 0.94, pauseProfile: 'dramatic',
        delivery: '克制但坚定', lockedFields: [], source: 'auto', textHash: 'hash',
      },
    })

    const [url, init] = fetcher.mock.calls[0]!
    expect(url).toBe('http://127.0.0.1:50000/inference_instruct2')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    const body = init.body as FormData
    expect(body.get('tts_text')).toBe('我不会再把你删掉。')
    expect(body.get('speed')).toBe('0.94')
    expect(body.get('instruct_text')).toContain('克制但坚定')
    expect(body.get('instruct_text')).toContain('坚定')
    expect(body.get('instruct_text')).toContain('稍慢')
    expect(readReference).toHaveBeenCalledWith('C:\\voices\\yuki.wav')
    expect(result.mimeType).toBe('audio/wav')
    expect(result.bytes.subarray(0, 4).toString('ascii')).toBe('RIFF')
    expect(result.providerMetadata).toMatchObject({ directionMode: 'instruct2', sampleRate: 24000 })
  })

  it('uses zero-shot mode when no expressive direction is supplied', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(new Int16Array([0]).buffer, { status: 200 }))
    const provider = new CosyVoiceProvider(
      { baseUrl: 'http://127.0.0.1:50000', timeoutMs: 5000, sampleRate: 24000 },
      fetcher,
      async () => Buffer.from([1]),
    )
    await provider.synthesize({
      text: '普通台词。', textLanguage: 'zh', referencePath: 'sample.wav',
      promptText: '参考台词。', promptLanguage: 'zh', speed: 1,
    })
    expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:50000/inference_zero_shot')
    expect((fetcher.mock.calls[0]?.[1].body as FormData).get('prompt_text')).toBe('参考台词。')
  })

  it('rejects empty synthesis instead of saving a silent WAV header', async () => {
    const provider = new CosyVoiceProvider(
      { baseUrl: 'http://127.0.0.1:50000', timeoutMs: 5000, sampleRate: 24000 },
      vi.fn().mockResolvedValue(new Response(new Uint8Array(), { status: 200 })),
      async () => Buffer.from([1]),
    )
    await expect(provider.synthesize({ text: '你好。', textLanguage: 'zh', referencePath: 'sample.wav', promptText: '参考。', promptLanguage: 'zh', speed: 1 })).rejects.toThrow('生成失败')
  })

  it('uses the actual sample rate reported by the bridge', async () => {
    const provider = new CosyVoiceProvider(
      { baseUrl: 'http://127.0.0.1:50000', timeoutMs: 5000, sampleRate: 24000 },
      vi.fn().mockResolvedValue(new Response(new Int16Array([0, 1]).buffer, { headers: { 'x-audio-sample-rate': '48000' } })),
      async () => Buffer.from([1]),
    )
    const result = await provider.synthesize({ text: '你好。', textLanguage: 'zh', referencePath: 'sample.wav', promptText: '参考。', promptLanguage: 'zh', speed: 1 })
    expect(result.bytes.readUInt32LE(24)).toBe(48000)
  })
})
