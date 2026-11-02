import { describe, expect, it, vi } from 'vitest'
import { voiceTextHash } from '@dreamchord/story-domain'
import { VoiceTranslationService } from './voiceTranslation.js'

describe('Chinese to Japanese voice translation', () => {
  it('reuses the curtain-call starter and dialogue without loading a translation model', async () => {
    const local = vi.fn()
    const result = await new VoiceTranslationService(local).translate({ text: '那你呢？最后这一句，你想怎么写？', targetLanguage: 'ja' })
    expect(result.text).toBe('君ならどうする？　最後の一行、何て書きたい？')
    expect(local).not.toHaveBeenCalled()
  })
  it('also reuses the new cinema demo script for Japanese dubbing', async () => {
    const local = vi.fn()
    const result = await new VoiceTranslationService(local).translate({ text: '这次是我出门晚了。', targetLanguage: 'ja' })
    expect(result.text).toBe('今日は、家を出るのが遅くなった。')
    expect(local).not.toHaveBeenCalled()
  })
  it('reuses an official translation without loading another model', async () => {
    const local = vi.fn()
    const result = await new VoiceTranslationService(local).translate({ text: '最后一页……只差最后一句。', targetLanguage: 'ja' })
    expect(result).toMatchObject({ text: '最後のページ……あと一文なのに。', source: 'official-script', sourceHash: voiceTextHash('最后一页……只差最后一句。') })
    expect(local).not.toHaveBeenCalled()
  })
  it('deduplicates repeated translations and keeps the Chinese source hash', async () => {
    const local = vi.fn().mockResolvedValue('明日、一緒に海を見に行こう。')
    const translator = new VoiceTranslationService(local)
    const input = { text: '明天一起去看海吧。', targetLanguage: 'ja' as const }
    const results = await Promise.all([translator.translate(input), translator.translate(input)])
    expect(local).toHaveBeenCalledOnce()
    expect(results[0]).toEqual(results[1])
    expect(results[0]).toMatchObject({ targetLanguage: 'ja', sourceLanguage: 'zh', sourceHash: voiceTextHash(input.text) })
  })
  it('rejects unrelated long English output rather than sending it as Japanese speech', async () => {
    const translator = new VoiceTranslationService(vi.fn().mockResolvedValue('Here is an explanation of the input sentence in English.'))
    await expect(translator.translate({ text: '明天一起去看海吧。', targetLanguage: 'ja' })).rejects.toThrow('有效的日文')
  })
})
