import type { CharacterId, CharacterState } from './types'

export interface CharacterConfig {
  id: CharacterId
  type: string
  layer: 'human' | 'human_corrupted' | 'system'
  name: string
  color: string
  defaultState: CharacterState
  expressions: CharacterState[]
  immutable?: boolean
}

export const CHARACTER_REGISTRY: Record<CharacterId, CharacterConfig> = {
  yuki: {
    id: 'yuki',
    type: 'editor_avatar',
    layer: 'human',
    name: '雪',
    color: '#8b5cf6',
    defaultState: 'normal',
    expressions: ['normal', 'smile', 'surprised'],
  },
  ren: {
    id: 'ren',
    type: 'deleted_world_residue',
    layer: 'human_corrupted',
    name: '影',
    color: '#475569',
    defaultState: 'normal',
    expressions: ['normal', 'smirk', 'serious'],
  },
  miya: {
    id: 'miya',
    type: 'constant_anchor_node',
    layer: 'human',
    name: '宫',
    color: '#d97706',
    defaultState: 'normal',
    expressions: ['normal', 'smile', 'warm'],
    immutable: true,
  },
  sora: {
    id: 'sora',
    type: 'uninitialized_entity',
    layer: 'system',
    name: '空',
    color: '#fbbf24',
    defaultState: 'normal',
    expressions: ['normal', 'curious', 'happy'],
  },
  ghost: {
    id: 'ghost',
    type: 'ui_runtime_agent',
    layer: 'system',
    name: '系统幽灵',
    color: '#c4b5fd',
    defaultState: 'normal',
    expressions: ['normal'],
  },
}

export function resolveCharacterUrl(
  characterId: string,
  expression: string = 'normal',
): string {
  const id = characterId.toLowerCase().trim()

  if (id === 'ghost' || id === 'system-ghost') {
    return '/assets/characters/system-ghost.png'
  }

  if (id in CHARACTER_REGISTRY) {
    const cfg = CHARACTER_REGISTRY[id as CharacterId]
    const safeExpression = cfg.expressions.includes(expression as CharacterState)
      ? expression
      : cfg.defaultState
    return `/assets/characters/${id}_${safeExpression}.png`
  }

  const customUrl = resolveCustomCharacterUrl(id, expression)
  if (customUrl) return customUrl

  const legacyMatch = id.match(/^(.+)_(.+)$/)
  if (legacyMatch) {
    const [, base, expr] = legacyMatch
    if (base in CHARACTER_REGISTRY) {
      const cfg = CHARACTER_REGISTRY[base as CharacterId]
      const safeExpression = cfg.expressions.includes(expr as CharacterState)
        ? expr
        : cfg.defaultState
      return `/assets/characters/${base}_${safeExpression}.png`
    }
  }

  return '/assets/characters/default-avatar.png'
}

export function resolveCharacterName(id: string): string {
  const direct = CHARACTER_REGISTRY[id as CharacterId]
  if (direct) return direct.name
  const custom = loadCustomCharacter(id)
  if (custom) return custom.name
  const byName = Object.values(CHARACTER_REGISTRY).find((cfg) => cfg.name === id)
  return byName?.name || id
}

export function resolveCharacterColor(id: string): string {
  const direct = CHARACTER_REGISTRY[id as CharacterId]
  if (direct) return direct.color
  const custom = loadCustomCharacter(id)
  if (custom) return custom.color || '#8b5cf6'
  const byName = Object.values(CHARACTER_REGISTRY).find((cfg) => cfg.name === id)
  return byName?.color || '#8b5cf6'
}

export function isValidExpression(id: string, expression: string): boolean {
  const cfg = CHARACTER_REGISTRY[id as CharacterId]
  if (!cfg) return true
  return cfg.expressions.includes(expression as CharacterState)
}

function loadCustomCharacter(id: string): { id: string; name: string; color?: string; defaultExpression?: string; expressions?: { id: string; url: string }[] } | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem('dreamchord_library_characters_v2')
    if (!raw) return null
    const characters = JSON.parse(raw) as Array<{ id: string; name: string; color?: string; defaultExpression?: string; expressions?: { id: string; url: string }[] }>
    return characters.find((character) => character.id === id || character.name === id) || null
  } catch {
    return null
  }
}

function resolveCustomCharacterUrl(id: string, expression: string) {
  const character = loadCustomCharacter(id)
  if (!character) return ''
  const expressions = character.expressions || []
  const matched = expressions.find((item) => item.id === expression)
  const fallback = expressions.find((item) => item.id === character.defaultExpression) || expressions[0]
  return matched?.url || fallback?.url || ''
}
