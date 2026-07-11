// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, saveChapter, type SaveChapterPayload } from './client'

describe('saveChapter', () => {
  afterEach(() => vi.restoreAllMocks())

  it('uses chapterId in the URL without sending it in the strict request body', async () => {
    const put = vi.spyOn(api, 'put').mockResolvedValue({ data: { version: 2 } })
    const payload: SaveChapterPayload = {
      chapterId: 'chapter-1',
      baseVersion: 1,
      nodes: [],
      edges: [],
    }

    await saveChapter('project-1', payload)

    expect(put).toHaveBeenCalledWith('/projects/project-1/chapters/chapter-1', {
      baseVersion: 1,
      nodes: [],
      edges: [],
    })
  })
})
