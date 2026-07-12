import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('player data source', () => {
  it('loads the official demo through the same project API path as every story', () => {
    const source = readFileSync(new URL('./VisualNovelPlayer.tsx', import.meta.url), 'utf8')
    expect(source).toContain('getProject(projectId)')
    expect(source).not.toContain("../engine/demo")
    expect(source).not.toContain('projectId === DEMO_ID')
    expect(source).toContain('第一章 · 终页归弦')
  })
})
