import { describe, expect, it, vi } from 'vitest'
import { lookupPublicKnowledge } from './publicKnowledge.js'

describe('public knowledge lookup', () => {
  it('queries only the Chinese Wikipedia summary endpoint and returns a cited extract', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      title: '量子纠缠',
      extract: '量子纠缠是一种量子力学现象。',
      content_urls: { desktop: { page: 'https://zh.wikipedia.org/wiki/量子纠缠' } },
    }), { status: 200, headers: { 'content-type': 'application/json' } }))

    const result = await lookupPublicKnowledge('量子纠缠是什么意思？', { fetchImpl })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const requestedUrl = new URL(String(fetchImpl.mock.calls[0][0]))
    expect(requestedUrl.origin).toBe('https://zh.wikipedia.org')
    expect(decodeURIComponent(requestedUrl.pathname)).toContain('量子纠缠')
    expect(result?.title).toBe('量子纠缠')
    expect(result?.extract).toBe('量子纠缠是一种量子力学现象。')
    expect(decodeURIComponent(result?.sourceUrl ?? '')).toBe('https://zh.wikipedia.org/wiki/量子纠缠')
  })

  it('returns null for missing, invalid, or failed responses', async () => {
    const notFound = vi.fn(async () => new Response('{}', { status: 404 }))
    const invalid = vi.fn(async () => new Response(JSON.stringify({ title: 'x', extract: '' }), { status: 200 }))
    const failed = vi.fn(async () => { throw new Error('offline') })

    await expect(lookupPublicKnowledge('不存在的条目是什么', { fetchImpl: notFound })).resolves.toBeNull()
    await expect(lookupPublicKnowledge('空摘要是什么', { fetchImpl: invalid })).resolves.toBeNull()
    await expect(lookupPublicKnowledge('网络失败是什么', { fetchImpl: failed })).resolves.toBeNull()
  })
})
