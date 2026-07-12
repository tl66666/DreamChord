import { describe, expect, it } from 'vitest'
import type { Character } from '../api/client'
import type { LibraryCharacter } from '../lib/libraryData'
import { mergeProjectCharacters, upsertAcceptedProjectCharacter } from './projectCharacters'

const localCharacter: LibraryCharacter = {
  id: 'local-yuki', name: '雪', role: '主角', description: '本地角色', biography: '', outline: '', usage: '',
  conflicts: [], color: '#ffffff', defaultExpression: 'normal',
  expressions: [{ id: 'normal', label: 'normal', url: '/builtin.png' }], updatedAt: '2026-01-01',
}

const projectCharacter = (overrides: Partial<Character> = {}): Character => ({
  id: 'server-yuki', name: '项目角色', description: '服务器角色', color: '#123456', defaultSprite: '/uploads/old.png',
  ...overrides,
})

describe('project editor characters', () => {
  it('merges project characters with the local library', () => {
    const characters = mergeProjectCharacters([localCharacter], [projectCharacter()])

    expect(characters.map((character) => character.id)).toEqual(['local-yuki', 'server-yuki'])
    expect(characters[1]?.expressions).toEqual([
      { id: 'default', label: 'default', url: '/uploads/old.png' },
    ])
  })

  it('deduplicates refreshed project characters by id and keeps the latest sprite', () => {
    const characters = mergeProjectCharacters([], [
      projectCharacter(),
      projectCharacter({ defaultSprite: '/uploads/latest.png' }),
    ])

    expect(characters).toHaveLength(1)
    expect(characters[0]?.expressions[0]?.url).toBe('/uploads/latest.png')
  })

  it('keeps the local library usable when the project has no characters', () => {
    expect(mergeProjectCharacters([localCharacter], [])).toEqual([localCharacter])
  })

  it('updates an accepted character immediately without creating a duplicate', () => {
    const characters = upsertAcceptedProjectCharacter([projectCharacter()], {
      variant: {
        id: 'variant', assetId: 'asset', kind: 'sprite', status: 'accepted', url: '/uploads/latest.png',
        mimeType: 'image/png', width: 1024, height: 1536, metadata: '{}', createdAt: '2026-07-12',
      },
      character: { id: 'server-yuki', name: '项目角色' },
    })

    expect(characters).toHaveLength(1)
    expect(characters[0]?.defaultSprite).toBe('/uploads/latest.png')
  })

  it('makes a newly accepted sprite available to editor selectors immediately', () => {
    const projectCharacters = upsertAcceptedProjectCharacter([], {
      variant: {
        id: 'new-variant', assetId: 'new-asset', kind: 'sprite', status: 'accepted', url: '/uploads/yun-normal.png',
        mimeType: 'image/png', width: 1024, height: 1536, metadata: '{}', createdAt: '2026-07-12',
      },
      character: { id: 'server-yun', name: '云' },
    })

    const selectableCharacters = mergeProjectCharacters([localCharacter], projectCharacters)
    expect(selectableCharacters.map((character) => character.name)).toEqual(['雪', '云'])
    expect(selectableCharacters[1]?.expressions).toEqual([
      { id: 'default', label: 'default', url: '/uploads/yun-normal.png' },
    ])
  })
})
