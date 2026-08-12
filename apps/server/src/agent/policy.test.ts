import { describe, expect, it } from 'vitest'
import { decideAgentPolicy } from './policy.js'

describe('Agent execution policy', () => {
  it('routes a chapter-bound story request to the controlled creative path', () => {
    expect(decideAgentPolicy({
      prompt: '根据当前章节创建一个可运行的剧情场景',
      hasChapter: true,
      hasSelectedDraft: false,
      provider: 'glm',
      materialMode: 'reuse',
    }).kind).toBe('creative-action')
  })

  it('keeps a material-plan request tied to the original creative prompt', () => {
    expect(decideAgentPolicy({
      prompt: '根据当前章节和素材库续写雨夜港口的重逢',
      hasChapter: true,
      hasSelectedDraft: false,
      provider: 'glm',
      materialMode: 'prompts',
    }).kind).toBe('material-plan')
  })

  it('always imports an explicitly selected draft locally', () => {
    expect(decideAgentPolicy({
      prompt: '根据已选草稿创建场景',
      hasChapter: true,
      hasSelectedDraft: true,
      provider: 'glm',
      materialMode: 'reuse',
    }).kind).toBe('local-import')
  })

  it('keeps immediate questions local even when a provider is configured', () => {
    expect(decideAgentPolicy({
      prompt: '你好',
      hasChapter: false,
      hasSelectedDraft: false,
      provider: 'glm',
      materialMode: 'reuse',
    }).kind).toBe('local-immediate')
  })
})
