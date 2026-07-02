import type { Node, Edge } from '@xyflow/react'
import type { RuntimeStory, RuntimeScene, RuntimeEvent, CharacterOnStage, CharacterId, CharacterState } from './types'
import { CHARACTER_REGISTRY, resolveCharacterUrl } from './characters'
import { loadLibraryCharacters } from '../lib/libraryData'

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

function parseCharacterOnStage(node: Node): CharacterOnStage | null {
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

export function convertFlowToRuntime(
  projectId: string,
  projectTitle: string,
  nodes: Node[],
  edges: Edge[],
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

  function walk(nodeId: string) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return
    ordered.push(node)

    const outEdges = edges
      .filter((e) => e.source === nodeId)
      .sort((a, b) => {
        const aLabel = (a.sourceHandle || a.label || '').toString()
        const bLabel = (b.sourceHandle || b.label || '').toString()
        if (aLabel.startsWith('choice-') && bLabel.startsWith('choice-')) {
          return Number(aLabel.replace('choice-', '')) - Number(bLabel.replace('choice-', ''))
        }
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
      const target = nodes.find((node) => node.id === currentId)
      if (!target) return ''
      if (PLAYABLE_NODE_TYPES.has(target.type || 'dialogue')) return target.id

      const nextEdge = edges.find((edge) => edge.source === target.id && !edge.sourceHandle)
      if (!nextEdge) return ''
      currentId = nextEdge.target
    }

    return ''
  }

  const scenes: RuntimeScene[] = []
  let currentBackground = 'bg-classroom'
  const onStage = new Map<CharacterId, CharacterOnStage>()

  for (const node of ordered) {
    const data = node.data as Record<string, unknown>

    if (node.type === 'background') {
      currentBackground = (data.backgroundId as string) || currentBackground
      continue
    }

    if (node.type === 'character') {
      const ch = parseCharacterOnStage(node)
      if (ch) {
        const action = (data.action as string) || 'show'
        if (action === 'hide') {
          onStage.delete(ch.id)
        } else {
          onStage.set(ch.id, ch)
        }
      }
      continue
    }

    const scene: RuntimeScene = {
      id: node.id,
      event: inferEvent(node),
      background: currentBackground,
      characters: Array.from(onStage.values()),
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
