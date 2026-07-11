import { describe, expect, it } from 'vitest'
import { aiRequestSchemas } from './ai.js'

const provider = { provider: 'openai', model: 'gpt-test', apiKey: 'secret' }

describe('deprecated AI compatibility request schemas', () => {
  it('accepts a bounded chat request', () => {
    const result = aiRequestSchemas.chat.safeParse({
      ...provider,
      messages: [{ role: 'user', content: '补充一个分支' }],
      temperature: 0.7,
    })
    expect(result.success).toBe(true)
  })

  it('rejects oversized prompts and invalid generation controls', () => {
    expect(aiRequestSchemas.chat.safeParse({ ...provider, messages: [{ role: 'system', content: '越权' }] }).success).toBe(false)
    expect(aiRequestSchemas.polish.safeParse({ ...provider, text: 'x'.repeat(20_001) }).success).toBe(false)
    expect(aiRequestSchemas.choices.safeParse({ ...provider, context: '剧情', count: 12 }).success).toBe(false)
    expect(aiRequestSchemas.generateStory.safeParse({ ...provider, prompt: '剧情', temperature: 3 }).success).toBe(false)
  })
})
