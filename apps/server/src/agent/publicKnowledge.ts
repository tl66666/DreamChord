export interface PublicKnowledgeResult {
  title: string
  extract: string
  sourceUrl: string
}

interface LookupOptions {
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

function extractTopic(prompt: string): string {
  return prompt
    .trim()
    .replace(/[？?！!。]+$/g, '')
    .replace(/^(请|麻烦)?(你)?(给我)?(简单)?(介绍一下|介绍|解释一下|解释|说说|讲讲)/, '')
    .replace(/(是什么|是什么意思|指的是什么|是谁|有什么含义|怎么理解)$/g, '')
    .trim()
    .slice(0, 100)
}

function safeSourceUrl(value: unknown, title: string): string {
  if (typeof value === 'string') {
    try {
      const url = new URL(value)
      if (url.protocol === 'https:' && url.hostname === 'zh.wikipedia.org') return url.href
    } catch { /* use the canonical fallback */ }
  }
  return `https://zh.wikipedia.org/wiki/${encodeURIComponent(title)}`
}

export async function lookupPublicKnowledge(prompt: string, options: LookupOptions = {}): Promise<PublicKnowledgeResult | null> {
  const topic = extractTopic(prompt)
  if (topic.length < 2) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 3_500)
  try {
    const endpoint = new URL(`https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`)
    const response = await (options.fetchImpl ?? fetch)(endpoint, {
      method: 'GET',
      headers: { accept: 'application/json', 'user-agent': 'DreamChord/0.2 public-knowledge' },
      redirect: 'error',
      signal: controller.signal,
    })
    if (!response.ok) return null
    const payload = await response.json() as {
      title?: unknown
      extract?: unknown
      content_urls?: { desktop?: { page?: unknown } }
    }
    if (typeof payload.title !== 'string' || typeof payload.extract !== 'string' || !payload.extract.trim()) return null
    return {
      title: payload.title.trim().slice(0, 200),
      extract: payload.extract.trim().slice(0, 1_200),
      sourceUrl: safeSourceUrl(payload.content_urls?.desktop?.page, payload.title.trim()),
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
