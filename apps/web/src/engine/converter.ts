import type { Node, Edge } from '@xyflow/react'
import type { RuntimeStory, RuntimeScene, RuntimeEvent, CharacterOnStage, CharacterId, CharacterState, RuntimeCharacterCatalogEntry, RuntimeAudioDirection, RuntimeBgmDirection, RuntimeOneShotAudio } from './types'
import { CHARACTER_REGISTRY, resolveCharacterUrl } from './characters'
import { loadLibraryCharacters } from '../lib/libraryData'
import { resolveStageStateAfterNode } from '../editor/workbench/storyEditorGraph'

export function inferEvent(node: Node): RuntimeEvent {
  switch (node.type) {
    case 'choice':
      return 'ON_BRANCH_SELECT'
    case 'character':
      return 'ON_CHARACTER_SPAWN'
    case 'background':
      return 'ON_REALITY_CHANGE'
    case 'subtitle':
      return 'ON_NODE_VISUALIZE'
    case 'condition':
      return 'ON_BRANCH_SELECT'
    case 'setVariable':
      return 'ON_NODE_CREATE'
    case 'jump':
      return 'ON_REALITY_CHANGE'
    case 'transition':
      return 'ON_REALITY_CHANGE'
    case 'dialogue':
    default:
      return 'ON_NODE_VISUALIZE'
  }
}

function parseCharacterOnStage(node: Node, projectCharacters: RuntimeCharacterCatalogEntry[]): CharacterOnStage | null {
  if (node.type !== 'character') return null
  const data = node.data as Record<string, unknown>
  const id = (data.characterId as string) || 'default-avatar'
  const expression = (data.expression as string) || 'normal'
  const position = (data.position as 'left' | 'center' | 'right') || 'center'

  // 自定义上传素材（/uploads/ 或 http 开头）直接作为 URL 使用
  if (id.startsWith('/uploads/') || id.startsWith('http')) {
    return {
      id: 'ghost' as CharacterId,
      state: 'normal' as CharacterState,
      position,
      customUrl: id,
    }
  }

  const projectCharacter = projectCharacters.find((character) => character.id === id || character.name === id)
  if (projectCharacter) {
    const matchedSprite = projectCharacter.sprites?.find((sprite) => sprite.name === expression)
    return {
      id: projectCharacter.id as CharacterId,
      state: expression as CharacterState,
      position,
      customUrl: matchedSprite?.url || projectCharacter.defaultSprite,
    }
  }

  const normalizedId = id.toLowerCase().replace(/_.*$/, '')
  if (!(normalizedId in CHARACTER_REGISTRY)) {
    const customCharacter = loadLibraryCharacters().find((character) => character.id === id || character.name === id)
    if (!customCharacter) return null
    return {
      id: customCharacter.id as CharacterId,
      state: expression as CharacterState,
      position,
      customUrl: resolveCharacterUrl(customCharacter.id, expression),
    }
  }
  const normalizedExpression = expression.toLowerCase().startsWith(`${normalizedId}_`)
    ? expression.slice(normalizedId.length + 1)
    : expression
  return {
    id: normalizedId as CharacterId,
    state: normalizedExpression as CharacterState,
    position,
  }
}

function findStartNode(nodes: Node[], edges: Edge[]): Node {
  const targets = new Set(edges.map((e) => e.target))
  const start = nodes.find((n) => !targets.has(n.id))
  return start || nodes[0]
}

const PLAYABLE_NODE_TYPES = new Set(['dialogue', 'subtitle', 'choice'])

function parseAudioDirection(value: unknown): RuntimeAudioDirection | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const input = value as Record<string, unknown>
  const bgmInput = input.bgm && typeof input.bgm === 'object' && !Array.isArray(input.bgm)
    ? input.bgm as Record<string, unknown>
    : undefined
  const action = bgmInput?.action
  const bgm: RuntimeBgmDirection | undefined = action === 'keep' || action === 'stop'
    ? { action }
    : action === 'play' && typeof bgmInput?.url === 'string' && bgmInput.url
      ? {
          action,
          url: bgmInput.url,
          ...(typeof bgmInput.volume === 'number' ? { volume: bgmInput.volume } : {}),
          ...(typeof bgmInput.fadeInMs === 'number' ? { fadeInMs: bgmInput.fadeInMs } : {}),
          ...(typeof bgmInput.fadeOutMs === 'number' ? { fadeOutMs: bgmInput.fadeOutMs } : {}),
        }
      : undefined
  const oneShot = (item: unknown): RuntimeOneShotAudio | undefined => item && typeof item === 'object' && !Array.isArray(item) && typeof (item as Record<string, unknown>).url === 'string'
    ? {
        url: (item as Record<string, unknown>).url as string,
        ...(typeof (item as Record<string, unknown>).volume === 'number' ? { volume: (item as Record<string, unknown>).volume as number } : {}),
      }
    : undefined
  const sfx = Array.isArray(input.sfx) ? input.sfx.map(oneShot).filter((item): item is NonNullable<typeof item> => Boolean(item)) : []
  const voice = oneShot(input.voice)
  if (!bgm && sfx.length === 0 && !voice) return undefined
  return { ...(bgm ? { bgm } : {}), ...(sfx.length ? { sfx } : {}), ...(voice ? { voice } : {}) }
}

export function convertFlowToRuntime(
  projectId: string,
  projectTitle: string,
  nodes: Node[],
  edges: Edge[],
  projectCharacters: RuntimeCharacterCatalogEntry[] = [],
): RuntimeStory {
  if (nodes.length === 0) {
    return {
      id: projectId,
      title: projectTitle,
      version: '1.0',
      initialState: {
        nodeCount: 0,
        realityVersion: 0,
        constantNodeLocked: false,
        characters: { yuki: 'normal', ren: 'normal', miya: 'normal', sora: 'normal', ghost: 'normal' },
        activeUIEvents: [],
      },
      scenes: [],
    }
  }

  const start = findStartNode(nodes, edges)
  const visited = new Set<string>()
  const ordered: Node[] = []

  // 预构建查找表，将 O(n) 的 nodes.find 降为 O(1)
  const nodeMap = new Map<string, Node>()
  for (const node of nodes) nodeMap.set(node.id, node)
  const outEdgesBySource = new Map<string, Edge[]>()
  for (const edge of edges) {
    const arr = outEdgesBySource.get(edge.source) || []
    arr.push(edge)
    outEdgesBySource.set(edge.source, arr)
  }

  function walk(nodeId: string) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    const node = nodeMap.get(nodeId)
    if (!node) return
    ordered.push(node)

    const outEdges = (outEdgesBySource.get(nodeId) || []).sort((a, b) => {
      const aLabel = (a.sourceHandle || a.label || '').toString()
      const bLabel = (b.sourceHandle || b.label || '').toString()
      if (aLabel.startsWith('choice-') && bLabel.startsWith('choice-')) {
        return Number(aLabel.replace('choice-', '')) - Number(bLabel.replace('choice-', ''))
      }
      // "真"标签优先（真结局路线），其余按标签字母序
      if (aLabel.includes('真')) return -1
      if (bLabel.includes('真')) return 1
      return 0
    })

    for (const edge of outEdges) {
      walk(edge.target)
    }
  }

  walk(start.id)

  function resolvePlayableTargetId(targetId?: string | null): string {
    if (!targetId) return ''
    const seen = new Set<string>()
    let currentId = targetId

    while (currentId && !seen.has(currentId)) {
      seen.add(currentId)
      const target = nodeMap.get(currentId)
      if (!target) return ''
      if (PLAYABLE_NODE_TYPES.has(target.type || 'dialogue')) return target.id

      const nextEdge = (outEdgesBySource.get(currentId) || []).find((edge) => !edge.sourceHandle)
      if (!nextEdge) return ''
      currentId = nextEdge.target
    }

    return ''
  }

  const scenes: RuntimeScene[] = []

  for (const node of ordered) {
    const data = node.data as Record<string, unknown>

    if (node.type === 'background' || node.type === 'character') continue

    const stage = resolveStageStateAfterNode(nodes, edges, node.id)
    const stageCharacters = stage.characters.flatMap((character) => {
      const parsed = parseCharacterOnStage({
        id: `runtime-${node.id}-${character.characterId}`,
        type: 'character',
        position: { x: 0, y: 0 },
        data: {
          characterId: character.characterId,
          expression: character.expression,
          position: character.position,
          action: 'show',
        },
      }, projectCharacters)
      return parsed ? [parsed] : []
    })

    const scene: RuntimeScene = {
      id: node.id,
      event: inferEvent(node),
      background: stage.backgroundId,
      characters: stageCharacters,
      ...(parseAudioDirection(data.audio) ? { audio: parseAudioDirection(data.audio) } : {}),
    }
    const outEdges = edges
      .filter((edge) => edge.source === node.id)
      .sort((a, b) => {
        const aHandle = String(a.sourceHandle || '')
        const bHandle = String(b.sourceHandle || '')
        if (aHandle.startsWith('choice-') && bHandle.startsWith('choice-')) {
          return Number(aHandle.replace('choice-', '')) - Number(bHandle.replace('choice-', ''))
        }
        return String(a.label || '').localeCompare(String(b.label || ''))
      })

    if (node.type === 'dialogue') {
      scene.dialogue = {
        role: (data.role as string) || 'unknown',
        text: (data.text as string) || '',
      }
    } else if (node.type === 'subtitle') {
      scene.dialogue = {
        role: (data.role as string) || 'ghost',
        text: (data.text as string) || '',
      }
    } else if (node.type === 'choice') {
      const choices = Array.isArray(data.choices) ? (data.choices as string[]) : []
      scene.choices = choices.length > 0 ? choices : ['继续']
      const targets = scene.choices.map((_, index) => {
        const edge = outEdges.find((item) => item.sourceHandle === `choice-${index}`)
        return edge?.target
      })
      scene.choiceTargets = targets.map((target) =>
        target ? resolvePlayableTargetId(target) : undefined,
      )
    }
    if (node.type !== 'choice') {
      scene.nextSceneId = resolvePlayableTargetId(outEdges[0]?.target) || null
    }

    scenes.push(scene)
  }

  return {
    id: projectId,
    title: projectTitle,
    version: '1.0',
    initialState: {
      nodeCount: nodes.length,
      realityVersion: 0,
      constantNodeLocked: false,
      characters: { yuki: 'normal', ren: 'normal', miya: 'normal', sora: 'normal', ghost: 'normal' },
      activeUIEvents: [],
    },
    scenes,
  }
}
