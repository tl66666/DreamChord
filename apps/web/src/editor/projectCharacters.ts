import type { AcceptedAssetVariant, Character } from '../api/client'
import type { LibraryCharacter } from '../lib/libraryData'

const FALLBACK_SPRITE = '/assets/characters/default-avatar.png'

function toLibraryCharacter(character: Character): LibraryCharacter {
  return {
    id: character.id,
    name: character.name,
    role: '项目角色',
    description: character.description || '',
    biography: character.description || '',
    outline: '',
    usage: '当前项目镜头与对话',
    conflicts: [],
    color: character.color || '#64748b',
    defaultExpression: 'default',
    expressions: [{ id: 'default', label: 'default', url: character.defaultSprite || FALLBACK_SPRITE }],
    updatedAt: '',
  }
}

export function mergeProjectCharacters(localCharacters: LibraryCharacter[], projectCharacters: Character[]): LibraryCharacter[] {
  const uniqueProjectCharacters = new Map<string, Character>()
  projectCharacters.forEach((character) => uniqueProjectCharacters.set(character.id, character))
  const projectIds = new Set(uniqueProjectCharacters.keys())
  return [
    ...localCharacters.filter((character) => !projectIds.has(character.id)),
    ...Array.from(uniqueProjectCharacters.values(), toLibraryCharacter),
  ]
}

export function upsertAcceptedProjectCharacter(characters: Character[], accepted: AcceptedAssetVariant): Character[] {
  if (!accepted.character) return characters
  const existing = characters.find((character) => character.id === accepted.character?.id)
  const character: Character = {
    id: accepted.character.id,
    name: accepted.character.name,
    description: existing?.description || null,
    color: existing?.color || '#64748b',
    defaultSprite: accepted.variant.url,
  }
  return [...characters.filter((item) => item.id !== character.id), character]
}
