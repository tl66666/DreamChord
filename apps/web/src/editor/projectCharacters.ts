import type { AcceptedAssetVariant, Character } from '../api/client'
import type { LibraryCharacter } from '../lib/libraryData'
import { loadLibraryCharacters } from '../lib/libraryData'
import type { ShotCard } from './sceneGraph'

const FALLBACK_SPRITE = '/assets/characters/default-avatar.png'

function toLibraryCharacter(character: Character, local?: LibraryCharacter): LibraryCharacter {
  const legacy = !character.sprites?.length && local?.expressions.some(e => e.url === character.defaultSprite) ? local : undefined
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
    defaultExpression: character.sprites?.some(s => s.name === 'normal') ? 'normal' : character.sprites?.[0]?.name || legacy?.defaultExpression || 'default',
    expressions: character.sprites?.length ? character.sprites.map(s => ({ id: s.name, label: ({ normal: '平静', sad: '难言', smile: '微笑' } as Record<string, string>)[s.name] || s.name, url: s.url })) : legacy?.expressions || [{ id: 'default', label: 'default', url: character.defaultSprite || FALLBACK_SPRITE }],
    updatedAt: '',
  }
}

export function mergeProjectCharacters(localCharacters: LibraryCharacter[], projectCharacters: Character[]): LibraryCharacter[] {
  const uniqueProjectCharacters = new Map<string, Character>()
  projectCharacters.forEach((character) => uniqueProjectCharacters.set(character.id, character))
  const projectIds = new Set(uniqueProjectCharacters.keys())
  const projectNames = new Set(projectCharacters.map(c => c.name))
  return [
    ...localCharacters.filter((character) => !projectIds.has(character.id) && !projectNames.has(character.name)),
    ...Array.from(uniqueProjectCharacters.values(), c => toLibraryCharacter(c, localCharacters.find(l => l.id === c.id || l.name === c.name))),
  ]
}

/** Resolve old names/library aliases for display without mutating the saved story graph. */
export function resolveProjectCharacterId(raw: string, projectCharacters: Character[], localCharacters = loadLibraryCharacters()): string {
  const local = localCharacters.find(c => c.id === raw)
  return projectCharacters.find(c => c.id === raw || c.name === raw || c.name === local?.name)?.id || raw
}
export function resolveProjectShotCard(card: ShotCard, projectCharacters: Character[], localCharacters = loadLibraryCharacters()): ShotCard {
  const identity = (raw: string) => resolveProjectCharacterId(raw, projectCharacters, localCharacters)
  const characters = card.characters.map(c => ({ ...c, characterId: identity(c.characterId) }))
  const speaker = identity(card.speaker)
  const staged = characters.find(c => c.characterId === speaker && c.action !== 'hide')
  return { ...card, speaker, characters, speakerExpression: staged?.expression || card.speakerExpression, speakerPosition: staged?.position || card.speakerPosition }
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
