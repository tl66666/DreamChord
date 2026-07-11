/**
 * ShotCardEditor.tsx — 中栏：统一镜头卡编辑器
 *
 * 将选中场景的节点聚合为镜头卡列表，
 * 每张卡片统一管理背景、角色、发言、台词。
 * 选项卡支持分支去向：新建分支/跳转/汇合。
 */

import { useMemo, useState, useCallback, useEffect } from 'react'
import { useToast } from '../components/FeedbackProvider'
import type { Node, Edge } from '@xyflow/react'
import {
  MessageSquare, GitBranch, Type,
  ImageIcon, ArrowRight,
  FileText, Send, GitMerge,
} from 'lucide-react'
import {
  type ShotCard, type LensType,
  type Scene,
  findSceneStartNode, getSceneGroupNodes, getNodeSceneGroupId,
  getNodeCharacterId, getNodeSceneCode,
  createSceneNodes, normalizeShotCard,
  layoutNodes, normalEdge, chainEdges, choiceEdge,
  groupNodesToCards,
} from './sceneGraph'
import { loadLibraryCharacters, loadLibraryScenes, loadStoryTemplates } from '../lib/libraryData'
import { ShotCardItem } from './ShotCardItem'
import { ManuscriptImporter, parseManuscriptToShotCards } from './manuscriptUtils'
import type { Asset } from '../api/client'
import type { ProjectAssetTarget } from './ProjectAssetPicker'

interface ShotCardEditorProps {
  nodes: Node[]
  edges: Edge[]
  selectedSceneId: string | null
  selectedCardId: string | null
  autoEditCardId: string | null
  onConsumeAutoEdit: () => void
  onSelectCard: (cardId: string) => void
  onUpdateGraph: (nodes: Node[], edges: Edge[]) => void
  scenes: Scene[]
  onCreateBranch: (cardId: string, choiceIndex: number, choiceText: string) => void
  onNavigateToScene: (sceneId: string) => void
  onRequestAI: (mode: 'polish' | 'continue' | 'choices' | 'branchReplies' | 'storyGraph') => void
  onSetSceneExit: (sceneId: string, targetSceneId: string | null) => void
  convergenceMap: Map<string, string[]>
  onOpenAssetPicker: (target: ProjectAssetTarget) => void
  assetSelection?: { target: ProjectAssetTarget; asset: Asset } | null
  onAssetApplied: () => void
}

export default function ShotCardEditor({
  nodes, edges, selectedSceneId, selectedCardId,
  autoEditCardId, onConsumeAutoEdit,
  onSelectCard, onUpdateGraph, scenes, onCreateBranch, onNavigateToScene,
  onRequestAI, onSetSceneExit, convergenceMap, onOpenAssetPicker, assetSelection, onAssetApplied,
}: ShotCardEditorProps) {
  const toast = useToast()
  const characters = useMemo(() => loadLibraryCharacters(), [])
  const libraryScenes = useMemo(() => loadLibraryScenes(), [])
  const storyTemplates = useMemo(() => loadStoryTemplates(), [])
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [compactMode, setCompactMode] = useState(false)
  const [showImporter, setShowImporter] = useState(false)
  const [quickInput, setQuickInput] = useState('')
  const [pendingQuickText, setPendingQuickText] = useState<string | null>(null)

  // 新建场景后自动展开编辑
  useEffect(() => {
    if (autoEditCardId) {
      setEditingCardId(autoEditCardId)
      onConsumeAutoEdit()
    }
  }, [autoEditCardId, onConsumeAutoEdit])

  const cards = useMemo<ShotCard[]>(() => {
    if (!selectedSceneId) return []
    const sceneStart = findSceneStartNode(selectedSceneId, nodes, edges)
    if (!sceneStart) return []
    const sceneNodes = getSceneGroupNodes(sceneStart, nodes, edges)
    return groupNodesToCards(sceneNodes)
  }, [nodes, edges, selectedSceneId])

  // 对话连续性标记：与前卡相同 speaker + background + 同场景 + 非选项
  const continuityFlags = useMemo(() => cards.map((card, i) => {
    if (i === 0) return false
    const prev = cards[i - 1]
    return prev.speaker === card.speaker
      && prev.background === card.background
      && prev.sceneGroupId === card.sceneGroupId
      && card.type !== 'choice'
  }), [cards])

  const updateCard = useCallback((cardId: string, updates: Partial<ShotCard>) => {
    const card = cards.find((c) => c.id === cardId)
    if (!card) return

    // 定位现有节点
    const cardNodes = card.nodeIds
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is Node => Boolean(n))
    const existingBg = cardNodes.find((n) => n.type === 'background')
    const existingText = cardNodes.find((n) => n.type !== 'background' && n.type !== 'character')
    if (!existingText) return

    const updateKeys = Object.keys(updates)

    // ── 快速路径 1：仅修改文本 ──
    // 直接更新 text 节点的 data.text，不重建边、不重新布局
    if (updateKeys.length === 1 && 'text' in updates) {
      const newNodes = nodes.map((n) =>
        n.id === existingText.id
          ? { ...n, data: { ...n.data, text: updates.text } }
          : n,
      )
      onUpdateGraph(newNodes, edges)
      return
    }

    // ── 快速路径 2：仅修改背景 ──
    if (updateKeys.length === 1 && 'background' in updates && existingBg) {
      const bgIsShared = cards.some((c) => c.id !== cardId && c.nodeIds.includes(existingBg.id))
      if (!bgIsShared) {
        // bg 不被共享：直接更新 data.backgroundId
        const newNodes = nodes.map((n) =>
          n.id === existingBg.id
            ? { ...n, data: { ...n.data, backgroundId: updates.background } }
            : n,
        )
        onUpdateGraph(newNodes, edges)
        return
      }
      // bg 被共享：创建新 bg 节点，插入到此卡片链前
      const stamp = Date.now()
      const rnd = Math.random().toString(36).slice(2, 6)
      const newBgId = `scene-bg-${stamp}-${rnd}`
      const newBgNode: Node = {
        id: newBgId,
        type: 'background',
        position: { x: 260, y: 120 },
        data: { backgroundId: updates.background, sceneGroupId: card.sceneGroupId, sceneCode: card.sceneCode },
      }
      const firstNonBgNode = cardNodes.find((n) => n.type !== 'background')
      const incomingEdge = firstNonBgNode
        ? edges.find((e) => e.target === firstNonBgNode.id && !e.sourceHandle && !card.nodeIds.includes(e.source))
        : undefined
      let newEdges = edges
      if (incomingEdge && firstNonBgNode) {
        newEdges = newEdges.filter((e) => e.id !== incomingEdge.id)
        newEdges = [...newEdges, normalEdge(incomingEdge.source, newBgId), normalEdge(newBgId, firstNonBgNode.id)]
      }
      const laidOut = layoutNodes([...nodes, newBgNode], newEdges)
      onUpdateGraph(laidOut, newEdges)
      return
    }

    // ── 快速路径 3：仅修改 lensType/type（镜头类型切换） ──
    if ('lensType' in updates && updateKeys.every((k) => k === 'lensType' || k === 'type')) {
      const newLensType = updates.lensType as LensType
      const isSubtitle = newLensType !== 'dialogue' && newLensType !== 'thought'
      const newRole = newLensType === 'thought'
        ? card.speaker
        : isSubtitle
          ? (card.speaker === 'ghost' ? 'ghost' : '旁白')
          : card.speaker
      const newNodes = nodes.map((n) =>
        n.id === existingText.id
          ? {
              ...n,
              type: isSubtitle ? 'subtitle' : 'dialogue',
              data: { ...n.data, lensType: newLensType, role: newRole },
            }
          : n,
      )
      onUpdateGraph(newNodes, edges)
      return
    }

    // ── 快速路径 4：仅修改发言人相关字段（不含角色列表变更） ──
    const speakerOnly = updateKeys.length > 0 && updateKeys.every((k) =>
      ['speaker', 'speakerExpression', 'speakerPosition', 'autoStageSpeaker'].includes(k),
    )
    if (speakerOnly && !updates.characters) {
      const updatedCard: ShotCard = { ...card, ...updates }
      const newRole = updatedCard.lensType === 'thought'
        ? updatedCard.speaker
        : updatedCard.lensType !== 'dialogue'
          ? (updatedCard.speaker === 'ghost' ? 'ghost' : '旁白')
          : updatedCard.speaker

      let newNodes = nodes.map((n) =>
        n.id === existingText.id
          ? { ...n, data: { ...n.data, role: newRole } }
          : n,
      )

      // 如果 autoStageSpeaker 且发言人是角色，检查是否已在角色列表中
      if (updatedCard.autoStageSpeaker && updatedCard.speaker !== '旁白') {
        const speakerInChars = card.characters.some((c) => c.characterId === updatedCard.speaker)
        if (!speakerInChars) {
          // 需要添加角色 → 走完整重建
        } else {
          // 更新已有角色节点的表情和位置
          const normalized = normalizeShotCard(updatedCard)
          const speakerSlot = normalized.characters.find((c) => c.characterId === updatedCard.speaker)
          const existingChars = cardNodes.filter((n) => n.type === 'character')
          const speakerChar = existingChars.find((n) => {
            const cid = getNodeCharacterId(n)
            return cid === updatedCard.speaker || cid.toLowerCase() === updatedCard.speaker.toLowerCase()
          })
          if (speakerChar && speakerSlot) {
            newNodes = newNodes.map((n) =>
              n.id === speakerChar.id
                ? { ...n, data: { ...n.data, expression: speakerSlot.expression, position: speakerSlot.position } }
                : n,
            )
          }
          onUpdateGraph(newNodes, edges)
          return
        }
      } else {
        onUpdateGraph(newNodes, edges)
        return
      }
    }

    // ── 完整重建路径：角色列表变更、类型变更、选项变更 ──
    const updatedCard: ShotCard = { ...card, ...updates }
    const normalized = normalizeShotCard(updatedCard)
    const { nodes: newNodes } = createSceneNodes(normalized, card.sceneGroupId)
    const newBgNode = newNodes.find((n) => n.type === 'background')
    const newCharNodes = newNodes.filter((n) => n.type === 'character')
    const newTextNode = newNodes.find((n) => n.type !== 'background' && n.type !== 'character')
    if (!newTextNode) return

    const oldCharIds = new Set(cardNodes.filter((n) => n.type === 'character').map((n) => n.id))
    const bgId = existingBg?.id || newBgNode?.id
    const textId = existingText?.id || newTextNode.id

    // 检查 bg 是否被其他卡片共享
    const bgIsShared = existingBg
      ? cards.some((c) => c.id !== cardId && c.nodeIds.includes(existingBg.id))
      : false

    // 1. bg + text 原地更新（保留 ID）
    let allNodes = nodes.map((n) => {
      if (existingBg && n.id === existingBg.id && newBgNode) {
        return { ...n, data: { ...n.data, ...newBgNode.data } }
      }
      if (existingText && n.id === existingText.id && newTextNode) {
        return { ...n, type: newTextNode.type, data: { ...n.data, ...newTextNode.data } }
      }
      return n
    })

    // 2. 删除旧 char 节点
    allNodes = allNodes.filter((n) => !oldCharIds.has(n.id))

    // 3. 添加新节点
    const nodesToAdd: Node[] = []
    if (!existingBg && newBgNode) nodesToAdd.push(newBgNode)
    if (!existingText) nodesToAdd.push(newTextNode)
    nodesToAdd.push(...newCharNodes)
    allNodes.push(...nodesToAdd)

    // 4. 重建边
    // 4a. 在移除旧边之前，找到进入此卡片的入边
    const cardNodeIdsSet = new Set(card.nodeIds)
    const cardEntryNode = bgIsShared
      ? (cardNodes.find((n) => n.type === 'character') || existingText)
      : (existingBg || existingText)
    const incomingEdge = cardEntryNode
      ? edges.find((e) =>
          e.target === cardEntryNode.id && !e.sourceHandle && !cardNodeIdsSet.has(e.source))
      : undefined

    // 4b. 移除涉及旧 char 节点的边 + 入边
    let allEdges = edges.filter((e) => {
      if (oldCharIds.has(e.source) || oldCharIds.has(e.target)) return false
      if (incomingEdge && e.id === incomingEdge.id) return false
      return true
    })

    // 4c. 移除旧内部链边
    if (bgId && textId && !bgIsShared) {
      allEdges = allEdges.filter(
        (e) => !(e.source === bgId && e.target === textId && !e.sourceHandle),
      )
    }
    // 共享 bg 时移除任何从卡片外部指向 text 的边
    if (bgIsShared && textId) {
      allEdges = allEdges.filter(
        (e) => !(e.target === textId && !e.sourceHandle && !cardNodeIdsSet.has(e.source)),
      )
    }

    // 4d. 移除旧 choice 边
    if (textId) {
      allEdges = allEdges.filter(
        (e) => !(e.source === textId && e.sourceHandle?.startsWith('choice-')),
      )
    }

    // 4e. bg 新建时重连入边（existingBg 不存在时）
    if (!existingBg && bgId && card.nodeIds[0] && !incomingEdge) {
      const oldIncoming = edges.find((e) => e.target === card.nodeIds[0])
      if (oldIncoming) {
        allEdges = allEdges.filter((e) => e.id !== oldIncoming.id)
        allEdges.push(normalEdge(oldIncoming.source, bgId))
      }
    }

    // 4f. text 新建时重连出边
    if (!existingText && textId && card.nodeIds.length > 0) {
      const outgoingEdge = edges.find(
        (e) => e.source === card.nodeIds[card.nodeIds.length - 1] && !e.sourceHandle,
      )
      if (outgoingEdge) {
        allEdges = allEdges.filter((e) => e.id !== outgoingEdge.id)
        allEdges.push(normalEdge(textId, outgoingEdge.target))
      }
    }

    // 4g. 构建新内部链
    const chainNodes: Node[] = []
    if (bgId && !bgIsShared) {
      // 非共享 bg：bg 在链中
      const bg = allNodes.find((n) => n.id === bgId)
      if (bg) chainNodes.push(bg)
    }
    chainNodes.push(...newCharNodes)
    if (textId) {
      const text = allNodes.find((n) => n.id === textId)
      if (text) chainNodes.push(text)
    }
    allEdges.push(...chainEdges(chainNodes))

    // 4h. 重连入边到新链首节点
    if (incomingEdge && chainNodes.length > 0) {
      allEdges.push(normalEdge(incomingEdge.source, chainNodes[0]!.id))
    }

    // 4i. 保留选项边（更新标签）
    if (newTextNode.type === 'choice' && updatedCard.choices) {
      updatedCard.choices.forEach((label, index) => {
        const oldEdge = edges.find(
          (e) => e.source === textId && e.sourceHandle === `choice-${index}`,
        )
        if (oldEdge) {
          allEdges.push({
            ...oldEdge,
            id: `e-${textId}-${oldEdge.target}-choice-${index}`,
            source: textId,
            label,
          })
        }
      })
    }

    const laidOut = layoutNodes(allNodes, allEdges)
    onUpdateGraph(laidOut, allEdges)
  }, [cards, nodes, edges, onUpdateGraph])

  useEffect(() => {
    if (!assetSelection) return
    if (assetSelection.target.field === 'background') updateCard(assetSelection.target.cardId, { background: assetSelection.asset.url })
    onAssetApplied()
  }, [assetSelection, onAssetApplied, updateCard])

  const addCard = useCallback((type: 'dialogue' | 'choice' | 'narration') => {
    if (!selectedSceneId) return
    const sceneStart = findSceneStartNode(selectedSceneId, nodes, edges)
    const sceneCode = sceneStart ? getNodeSceneCode(sceneStart) || '1-1' : '1-1'
    const existingBg = cards[0]?.background || 'bg-classroom'
    const lensType: LensType = type === 'narration' ? 'narration' : 'dialogue'
    const newCard: ShotCard = {
      id: `card-${Date.now()}`,
      sceneId: selectedSceneId, type, lensType,
      background: existingBg,
      characters: type === 'choice' ? cards[cards.length - 1]?.characters || [] : [],
      speaker: '旁白', speakerExpression: 'normal', speakerPosition: 'center',
      autoStageSpeaker: false, text: '',
      choices: type === 'choice' ? ['选项 1', '选项 2'] : undefined,
      sceneCode, sceneGroupId: selectedSceneId, nodeIds: [],
    }
    const normalized = normalizeShotCard(newCard)
    const { nodes: newNodes } = createSceneNodes(normalized, selectedSceneId)
    const sceneNodesList = sceneStart ? getSceneGroupNodes(sceneStart, nodes, edges) : []
    const lastSceneNode = sceneNodesList[sceneNodesList.length - 1]
    const allNodes = [...nodes, ...newNodes]
    let allEdges = [...edges]
    if (lastSceneNode) {
      // 如果最后一个场景节点已有出边（连接到下一场景），需要将新节点插入到链中
      const outgoingEdge = edges.find((e) => e.source === lastSceneNode.id && !e.sourceHandle)
      if (outgoingEdge) {
        allEdges = allEdges.filter((e) => e.id !== outgoingEdge.id)
        allEdges.push(normalEdge(lastSceneNode.id, newNodes[0]!.id))
        allEdges.push(normalEdge(newNodes[newNodes.length - 1]!.id, outgoingEdge.target))
      } else {
        allEdges.push(normalEdge(lastSceneNode.id, newNodes[0]!.id))
      }
    }
    allEdges.push(...chainEdges(newNodes))
    const laidOut = layoutNodes(allNodes, allEdges)
    onUpdateGraph(laidOut, allEdges)
    setEditingCardId(newCard.id)
    onSelectCard(newCard.id)
  }, [selectedSceneId, nodes, edges, cards, onSelectCard, onUpdateGraph])

  // 快速续接对话：继承上一张卡的背景和角色舞台，预设发言人
  const quickAppendDialogue = useCallback((speakerId: string) => {
    if (!selectedSceneId) return
    const lastCard = cards[cards.length - 1]
    if (!lastCard) { addCard('dialogue'); return }

    const sceneStart = findSceneStartNode(selectedSceneId, nodes, edges)
    const sceneCode = lastCard.sceneCode
    const isNarration = speakerId === '旁白'
    const speakerChar = lastCard.characters.find(c => c.characterId === speakerId)
    const newCard: ShotCard = {
      id: `card-${Date.now()}`,
      sceneId: selectedSceneId,
      type: isNarration ? 'narration' : 'dialogue',
      lensType: isNarration ? 'narration' : 'dialogue',
      background: lastCard.background,
      characters: lastCard.characters.map(c => ({ ...c, action: 'keep' as const })),
      speaker: speakerId,
      speakerExpression: 'normal',
      speakerPosition: speakerChar?.position || 'center',
      autoStageSpeaker: !isNarration,
      text: '',
      sceneCode,
      sceneGroupId: selectedSceneId,
      nodeIds: [],
    }
    const normalized = normalizeShotCard(newCard)
    const { nodes: newNodes } = createSceneNodes(normalized, selectedSceneId)
    const sceneNodesList = sceneStart ? getSceneGroupNodes(sceneStart, nodes, edges) : []
    const lastSceneNode = sceneNodesList[sceneNodesList.length - 1]
    const allNodes = [...nodes, ...newNodes]
    let allEdges = [...edges]
    if (lastSceneNode) {
      const outgoingEdge = edges.find((e) => e.source === lastSceneNode.id && !e.sourceHandle)
      if (outgoingEdge) {
        allEdges = allEdges.filter((e) => e.id !== outgoingEdge.id)
        allEdges.push(normalEdge(lastSceneNode.id, newNodes[0]!.id))
        allEdges.push(normalEdge(newNodes[newNodes.length - 1]!.id, outgoingEdge.target))
      } else {
        allEdges.push(normalEdge(lastSceneNode.id, newNodes[0]!.id))
      }
    }
    allEdges.push(...chainEdges(newNodes))
    const laidOut = layoutNodes(allNodes, allEdges)
    onUpdateGraph(laidOut, allEdges)
    setEditingCardId(newCard.id)
    onSelectCard(newCard.id)
  }, [selectedSceneId, nodes, edges, cards, onSelectCard, onUpdateGraph, addCard])

  // 快速续接后自动填充台词
  useEffect(() => {
    if (pendingQuickText !== null && cards.length > 0) {
      const lastCard = cards[cards.length - 1]
      if (lastCard && lastCard.text === '') {
        updateCard(lastCard.id, { text: pendingQuickText })
      }
      setPendingQuickText(null)
    }
  }, [pendingQuickText, cards, updateCard])

  // 快速输入提交：解析 "角色名：台词" 格式
  const handleQuickInputSubmit = useCallback(() => {
    const text = quickInput.trim()
    if (!text) return
    const match = text.match(/^(.+?)[:：](.*)$/)
    if (match) {
      const speakerName = match[1]!.trim()
      const dialogue = match[2]!.trim()
      const char = characters.find(c => c.name === speakerName || c.id === speakerName.toLowerCase())
      if (char) {
        quickAppendDialogue(char.id)
        setPendingQuickText(dialogue)
      } else {
        setPendingQuickText(null)
        toast.error(`未找到角色「${speakerName}」，请检查角色名`)
        return
      }
    } else {
      // 无冒号：旁白文本
      quickAppendDialogue('旁白')
      setPendingQuickText(text)
    }
    setQuickInput('')
  }, [quickInput, characters, quickAppendDialogue])

  const importManuscript = useCallback((text: string) => {
    if (!selectedSceneId) return 0
    const sceneStart = findSceneStartNode(selectedSceneId, nodes, edges)
    const sceneCode = sceneStart ? getNodeSceneCode(sceneStart) || '1-1' : '1-1'
    const existingBg = cards[0]?.background || 'bg-classroom'
    const importedCards = parseManuscriptToShotCards(text, {
      sceneGroupId: selectedSceneId,
      sceneCode,
      background: existingBg,
      characters,
    })
    if (importedCards.length === 0) return 0

    const sceneNodesList = sceneStart ? getSceneGroupNodes(sceneStart, nodes, edges) : []
    const lastSceneNode = sceneNodesList[sceneNodesList.length - 1]
    const allNodes = [...nodes]
    const allEdges = [...edges]
    const oldOutgoing = lastSceneNode ? edges.find((e) => e.source === lastSceneNode.id && !e.sourceHandle) : undefined
    if (oldOutgoing) {
      const oldIndex = allEdges.findIndex((edge) => edge.id === oldOutgoing.id)
      if (oldIndex >= 0) allEdges.splice(oldIndex, 1)
    }

    let previousTail = lastSceneNode
    let firstImportedCardId = ''
    importedCards.forEach((card) => {
      const normalized = normalizeShotCard(card)
      const { nodes: newNodes } = createSceneNodes(normalized, selectedSceneId)
      if (!firstImportedCardId) firstImportedCardId = card.id
      allNodes.push(...newNodes)
      if (previousTail) allEdges.push(normalEdge(previousTail.id, newNodes[0]!.id))
      allEdges.push(...chainEdges(newNodes))
      previousTail = newNodes[newNodes.length - 1]
    })
    if (oldOutgoing && previousTail) allEdges.push(normalEdge(previousTail.id, oldOutgoing.target))

    const laidOut = layoutNodes(allNodes, allEdges)
    onUpdateGraph(laidOut, allEdges)
    if (firstImportedCardId) {
      setEditingCardId(null)
      onSelectCard(firstImportedCardId)
    }
    return importedCards.length
  }, [selectedSceneId, nodes, edges, cards, characters, onSelectCard, onUpdateGraph])

  const deleteCard = useCallback((cardId: string) => {
    const card = cards.find((c) => c.id === cardId)
    if (!card) return

    // 按 type 分类旧节点
    const cardNodes = card.nodeIds
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is Node => Boolean(n))
    const bgNode = cardNodes.find((n) => n.type === 'background')
    const textNode = cardNodes.find((n) => n.type !== 'background' && n.type !== 'character')
    const charIds = new Set(cardNodes.filter((n) => n.type === 'character').map((n) => n.id))

    // 检查 bg 是否被其他卡片共享（groupNodesToCards 的 lastBg 机制）
    const otherCards = cards.filter((c) => c.id !== cardId)
    const bgIsShared = bgNode ? otherCards.some((c) => c.nodeIds.includes(bgNode.id)) : false

    // 需要删除的节点：text + chars，bg 仅在不被共享时删除
    const idsToDelete = new Set<string>()
    if (textNode) idsToDelete.add(textNode.id)
    charIds.forEach((id) => idsToDelete.add(id))
    if (bgNode && !bgIsShared) idsToDelete.add(bgNode.id)

    const remainingNodes = nodes.filter((n) => !idsToDelete.has(n.id))
    const remainingEdges = edges.filter((e) => !idsToDelete.has(e.source) && !idsToDelete.has(e.target))

    // 重连边
    const outgoingEdge = textNode
      ? edges.find((e) => e.source === textNode.id && !e.sourceHandle)
      : undefined

    if (bgNode && bgIsShared && outgoingEdge) {
      // bg 保留，连接 bg → 下一个节点
      remainingEdges.push(normalEdge(bgNode.id, outgoingEdge.target))
    } else if (bgNode && !bgIsShared) {
      // bg 也删除，连接入边 → 出边
      const incomingEdge = edges.find((e) => e.target === bgNode.id)
      if (incomingEdge && outgoingEdge) {
        remainingEdges.push(normalEdge(incomingEdge.source, outgoingEdge.target))
      }
    }

    const laidOut = layoutNodes(remainingNodes, remainingEdges)
    onUpdateGraph(laidOut, remainingEdges)
  }, [cards, nodes, edges, onUpdateGraph])

  const duplicateCard = useCallback((cardId: string) => {
    const card = cards.find((c) => c.id === cardId)
    if (!card) return
    const dupCard: ShotCard = {
      ...card,
      id: `card-${Date.now()}`,
      text: card.text,
      choices: card.choices ? [...card.choices] : undefined,
      nodeIds: [],
    }
    const normalized = normalizeShotCard(dupCard)
    const { nodes: newNodes } = createSceneNodes(normalized, card.sceneGroupId)
    const cardLastNodeId = card.nodeIds[card.nodeIds.length - 1]!

    // 找到当前卡片的出边（指向下一张卡片或场景尾部）
    const outgoingEdge = edges.find(
      (e) => e.source === cardLastNodeId && !e.sourceHandle,
    )

    const allNodes = [...nodes, ...newNodes]
    let allEdges = edges

    // 移除旧出边，在副本后面重新连接
    if (outgoingEdge) {
      allEdges = allEdges.filter((e) => e.id !== outgoingEdge.id)
    }

    // 原卡片尾部 → 副本头部 → 副本尾部 → 原出边目标
    allEdges.push(normalEdge(cardLastNodeId, newNodes[0]!.id))
    allEdges.push(...chainEdges(newNodes))
    if (outgoingEdge) {
      allEdges.push(normalEdge(newNodes[newNodes.length - 1]!.id, outgoingEdge.target))
    }

    const laidOut = layoutNodes(allNodes, allEdges)
    onUpdateGraph(laidOut, allEdges)
    setEditingCardId(dupCard.id)
    onSelectCard(dupCard.id)
  }, [cards, nodes, edges, onSelectCard, onUpdateGraph])

  const moveCard = useCallback((cardId: string, direction: 'up' | 'down') => {
    const index = cards.findIndex((c) => c.id === cardId)
    if (index < 0) return
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= cards.length) return

    const cardA = cards[index]!
    const cardB = cards[targetIndex]!

    const cardANodeIds = new Set(cardA.nodeIds)
    const cardBNodeIds = new Set(cardB.nodeIds)
    const allMovedIds = new Set([...cardANodeIds, ...cardBNodeIds])

    const cardAFirstNodeId = cardA.nodeIds[0]!
    const cardALastNodeId = cardA.nodeIds[cardA.nodeIds.length - 1]!
    const cardBFirstNodeId = cardB.nodeIds[0]!
    const cardBLastNodeId = cardB.nodeIds[cardB.nodeIds.length - 1]!

    // 检测是否共享 bg（groupNodesToCards 的 lastBg 机制）
    const sharedBg = cardAFirstNodeId === cardBFirstNodeId

    // 确定排列顺序：上移 → B在前A在后；下移 → A在前B在后
    const firstCard = direction === 'up' ? cardB : cardA
    const secondCard = direction === 'up' ? cardA : cardB
    const firstNodeIds = firstCard.nodeIds
    const secondNodeIds = secondCard.nodeIds
    const firstFirstNodeId = firstNodeIds[0]!
    const firstTailNodeId = firstNodeIds[firstNodeIds.length - 1]!
    const secondTailNodeId = secondNodeIds[secondNodeIds.length - 1]!

    // 找到进入这对卡片区域的入边（来自区域外的源）
    const incomingEdge = edges.find((e) =>
      e.target === (direction === 'up' ? cardAFirstNodeId : cardBFirstNodeId) &&
      !e.sourceHandle &&
      !allMovedIds.has(e.source),
    )
    // 找到离开这对卡片区域的出边（指向区域外的目标）
    const outgoingEdge = edges.find((e) =>
      e.source === (direction === 'up' ? cardBLastNodeId : cardALastNodeId) &&
      !e.sourceHandle &&
      !allMovedIds.has(e.target),
    )

    // 移除涉及移动节点的所有普通边（保留 choice 边）
    const newEdges = edges.filter((e) => {
      if (e.sourceHandle?.startsWith('choice-')) return true
      if (!allMovedIds.has(e.source) && !allMovedIds.has(e.target)) return true
      return false
    })

    // 获取节点对象用于构建内部链
    const firstNodes = firstNodeIds.map((id) => nodes.find((n) => n.id === id)).filter(Boolean) as Node[]
    const secondNodes = secondNodeIds.map((id) => nodes.find((n) => n.id === id)).filter(Boolean) as Node[]

    // 入边 → 第一张卡片头部
    if (incomingEdge && incomingEdge.target !== firstFirstNodeId) {
      newEdges.push(normalEdge(incomingEdge.source, firstFirstNodeId))
    } else if (incomingEdge && incomingEdge.target === firstFirstNodeId) {
      // 入边已指向正确节点，保留
      newEdges.push(incomingEdge)
    }

    // 第一张卡片内部链
    newEdges.push(...chainEdges(firstNodes))

    // 第一张卡片尾部 → 第二张卡片头部
    if (sharedBg) {
      // 共享 bg 时，第二张卡片跳过 bg 节点
      const secondNodesAfterBg = secondNodes.slice(1)
      if (secondNodesAfterBg.length > 0) {
        newEdges.push(normalEdge(firstTailNodeId, secondNodesAfterBg[0]!.id))
        newEdges.push(...chainEdges(secondNodesAfterBg))
      }
    } else {
      newEdges.push(normalEdge(firstTailNodeId, secondNodeIds[0]!))
      newEdges.push(...chainEdges(secondNodes))
    }

    // 第二张卡片尾部 → 出边目标
    if (outgoingEdge && outgoingEdge.target !== secondTailNodeId) {
      newEdges.push(normalEdge(secondTailNodeId, outgoingEdge.target))
    }

    const laidOut = layoutNodes(nodes, newEdges)
    onUpdateGraph(laidOut, newEdges)
  }, [cards, nodes, edges, onUpdateGraph])

  /** 设置选项的分支去向 */
  const setChoiceTarget = useCallback((cardId: string, choiceIndex: number, targetSceneId: string) => {
    const card = cards.find((c) => c.id === cardId)
    if (!card || card.type !== 'choice') return
    // 找到 choice 节点
    const choiceNodeId = card.nodeIds.find((id) => {
      const n = nodes.find((nn) => nn.id === id)
      return n?.type === 'choice'
    })
    if (!choiceNodeId) return

    // 移除该选项的旧边
    const oldEdge = edges.find((e) => e.source === choiceNodeId && e.sourceHandle === `choice-${choiceIndex}`)
    let newEdges = edges
    if (oldEdge) {
      newEdges = edges.filter((e) => e.id !== oldEdge.id)
    }
    // 找到目标场景的第一个节点
    const targetScene = scenes.find((s) => s.id === targetSceneId)
    if (targetScene && targetScene.nodeIds.length > 0) {
      const choices = card.choices || []
      const label = choices[choiceIndex] || `选项 ${choiceIndex + 1}`
      newEdges = [...newEdges, choiceEdge(choiceNodeId, targetScene.nodeIds[0]!, choiceIndex, label)]
    }
    onUpdateGraph(nodes, newEdges)
  }, [cards, nodes, edges, scenes, onUpdateGraph])

  // 场景出口信息：当前场景尾节点的跨场景出边目标
  const sceneExitInfo = useMemo(() => {
    if (!selectedSceneId) return null
    const sceneStart = findSceneStartNode(selectedSceneId, nodes, edges)
    if (!sceneStart) return null
    const sceneNodes = getSceneGroupNodes(sceneStart, nodes, edges)
    const tailNode = sceneNodes[sceneNodes.length - 1]
    if (!tailNode) return null

    const exitEdge = edges.find(e =>
      e.source === tailNode.id && !e.sourceHandle &&
      getNodeSceneGroupId(nodes.find(n => n.id === e.target)!) !== selectedSceneId
    )
    const targetSceneId = exitEdge
      ? getNodeSceneGroupId(nodes.find(n => n.id === exitEdge.target)!)
      : null
    const targetScene = targetSceneId ? scenes.find(s => s.id === targetSceneId) : null
    const isEnding = !exitEdge && sceneNodes.length > 0
    const isConvergence = targetSceneId ? convergenceMap.has(targetSceneId) : false

    return { targetSceneId, targetScene, isEnding, isConvergence }
  }, [selectedSceneId, nodes, edges, scenes, convergenceMap])

  if (!selectedSceneId) {
    return (
      <div className="flex h-full items-center justify-center bg-dream-50/30">
        <div className="text-center">
          <ImageIcon className="mx-auto mb-3 h-12 w-12 text-dream-300" />
          <p className="text-sm text-dream-400">从左侧选择一个场景开始编辑</p>
          <p className="mt-1 text-xs text-dream-300">或点击左侧"新建场景"按钮</p>
        </div>
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="flex h-full flex-col bg-dream-50/30">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MessageSquare className="mx-auto mb-3 h-12 w-12 text-dream-300" />
            <p className="text-sm text-dream-400">这个场景还没有镜头</p>
            <div className="mt-4 flex justify-center gap-2">
              <button onClick={() => addCard('dialogue')} className="rounded-lg bg-dream-600 px-4 py-2 text-sm text-white transition hover:bg-dream-700">
                + 对话
              </button>
              <button onClick={() => addCard('narration')} className="rounded-lg border border-dream-200 bg-white px-4 py-2 text-sm text-dream-600 transition hover:bg-dream-50">
                + 旁白
              </button>
              <button onClick={() => addCard('choice')} className="rounded-lg border border-dream-200 bg-white px-4 py-2 text-sm text-dream-600 transition hover:bg-dream-50">
                + 选项
              </button>
              <button onClick={() => setShowImporter(true)} className="rounded-lg border border-dream-200 bg-white px-4 py-2 text-sm text-dream-600 transition hover:bg-dream-50">
                导入长文
              </button>
            </div>
          </div>
        </div>
        {showImporter && (
          <ManuscriptImporter
            characters={characters}
            onClose={() => setShowImporter(false)}
            onImport={(text) => {
              const count = importManuscript(text)
              if (count > 0) setShowImporter(false)
              return count
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-dream-50/30">
      <div className="flex-1 overflow-y-auto p-4">
        <div className={compactMode ? 'mx-auto max-w-3xl space-y-1.5' : 'mx-auto max-w-2xl space-y-3'}>
          {/* 场景出口设置面板 */}
          {sceneExitInfo && cards.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-dream-100 bg-white/60 px-3 py-2 text-xs">
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-dream-400" />
              <span className="shrink-0 text-dream-500">场景出口：</span>
              {sceneExitInfo.targetScene ? (
                <>
                  <span className="font-medium text-dream-700">
                    {sceneExitInfo.targetScene.title || sceneExitInfo.targetScene.code}
                  </span>
                  {sceneExitInfo.isConvergence && (
                    <span className="flex items-center gap-0.5 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-600">
                      <GitMerge className="h-2.5 w-2.5" /> 汇合点
                    </span>
                  )}
                </>
              ) : sceneExitInfo.isEnding ? (
                <span className="font-medium text-amber-600">结局</span>
              ) : (
                <span className="text-dream-400">未连接</span>
              )}
              <select
                value={sceneExitInfo.targetSceneId || ''}
                onChange={(e) => {
                  e.stopPropagation()
                  const val = e.target.value
                  onSetSceneExit(selectedSceneId, val || null)
                }}
                onClick={(e) => e.stopPropagation()}
                className="ml-auto rounded border border-dream-200 bg-white px-2 py-1 text-xs text-dream-600 focus:border-dream-400 focus:outline-none"
              >
                <option value="">— 选择出口 —</option>
                {scenes.filter(s => s.id !== selectedSceneId).map(s => (
                  <option key={s.id} value={s.id}>{s.title || s.code}</option>
                ))}
              </select>
              <button
                onClick={(e) => { e.stopPropagation(); onSetSceneExit(selectedSceneId, null) }}
                className={`shrink-0 rounded px-2 py-1 text-xs transition ${
                  sceneExitInfo.isEnding
                    ? 'bg-amber-100 text-amber-700'
                    : 'border border-dream-200 text-dream-500 hover:bg-dream-50'
                }`}
                title="设为结局"
              >
                结局
              </button>
            </div>
          )}
          {cards.map((card, index) => (
            <ShotCardItem
              key={card.id}
              card={card}
              index={index}
              total={cards.length}
              isSelected={selectedCardId === card.id}
              isEditing={editingCardId === card.id}
              isContinuation={continuityFlags[index]}
              compactMode={compactMode}
              characters={characters}
              libraryScenes={libraryScenes}
              storyTemplates={storyTemplates}
              allScenes={scenes}
              allEdges={edges}
              convergenceMap={convergenceMap}
              onSelect={() => { onSelectCard(card.id); if (editingCardId !== card.id) setEditingCardId(null) }}
              onEdit={() => setEditingCardId(editingCardId === card.id ? null : card.id)}
              onUpdate={(updates) => updateCard(card.id, updates)}
              onDelete={() => deleteCard(card.id)}
              onDuplicate={() => duplicateCard(card.id)}
              onMove={(dir) => moveCard(card.id, dir)}
              onSetChoiceTarget={(choiceIndex, targetSceneId) => setChoiceTarget(card.id, choiceIndex, targetSceneId)}
              onCreateBranch={(choiceIndex, choiceText) => onCreateBranch(card.id, choiceIndex, choiceText)}
              onNavigateToScene={onNavigateToScene}
              onRequestAI={onRequestAI}
              onOpenAssetPicker={(cardId, field) => onOpenAssetPicker({ cardId, field })}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-dream-100 bg-white/80 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
          {/* 快速续接：台上角色头像按钮 */}
          {cards.length > 0 && (() => {
            const lastCard = cards[cards.length - 1]
            const stageChars = lastCard.characters.filter(c => c.action !== 'hide')
            if (stageChars.length === 0 && lastCard.type !== 'choice') return null
            return (
              <>
                <span className="text-xs text-dream-400">快速续接：</span>
                {stageChars.map((slot) => {
                  const char = characters.find(c => c.id === slot.characterId)
                  if (!char) return null
                  return (
                    <button
                      key={slot.characterId}
                      onClick={(e) => { e.stopPropagation(); quickAppendDialogue(slot.characterId) }}
                      className="flex items-center gap-1 rounded-full border border-dream-200 bg-white px-2 py-1 text-xs transition hover:border-dream-300 hover:bg-dream-50"
                      title={`${char.name} 继续说话`}
                    >
                      <span
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: char.color || '#a78bfa' }}
                      />
                      {char.name}
                    </button>
                  )
                })}
                <button
                  onClick={(e) => { e.stopPropagation(); quickAppendDialogue('旁白') }}
                  className="flex items-center gap-1 rounded-full border border-dream-200 bg-white px-2 py-1 text-xs text-dream-500 transition hover:border-dream-300 hover:bg-dream-50"
                  title="旁白续接"
                >
                  <MessageSquare className="h-3 w-3" /> 旁白
                </button>
                <span className="mx-1 h-5 w-px bg-dream-100" />
              </>
            )
          })()}
          {/* 快速输入框 */}
          {cards.length > 0 && (
            <input
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleQuickInputSubmit() } }}
              placeholder="角色名：台词（回车续接）"
              className="min-w-[200px] flex-1 rounded-lg border border-dream-200 bg-white px-3 py-1.5 text-xs text-dream-700 placeholder:text-dream-300 focus:border-dream-400 focus:outline-none"
            />
          )}
          {cards.length > 0 && quickInput.trim() && (
            <button
              onClick={(e) => { e.stopPropagation(); handleQuickInputSubmit() }}
              className="flex items-center gap-1 rounded-lg bg-dream-600 px-2 py-1.5 text-xs text-white transition hover:bg-dream-700"
              title="提交续接"
            >
              <Send className="h-3 w-3" />
            </button>
          )}
          <span className="mx-1 h-5 w-px bg-dream-100" />
          <span className="text-xs text-dream-400">添加镜头：</span>
          <button onClick={() => addCard('dialogue')} className="flex items-center gap-1.5 rounded-lg bg-dream-600 px-3 py-1.5 text-xs text-white transition hover:bg-dream-700">
            <MessageSquare className="h-3 w-3" /> 对话
          </button>
          <button onClick={() => addCard('narration')} className="flex items-center gap-1.5 rounded-lg border border-dream-200 bg-white px-3 py-1.5 text-xs text-dream-600 transition hover:bg-dream-50">
            <Type className="h-3 w-3" /> 旁白
          </button>
          <button onClick={() => addCard('choice')} className="flex items-center gap-1.5 rounded-lg border border-dream-200 bg-white px-3 py-1.5 text-xs text-dream-600 transition hover:bg-dream-50">
            <GitBranch className="h-3 w-3" /> 选项
          </button>
          <span className="mx-1 h-5 w-px bg-dream-100" />
          <button onClick={() => setShowImporter(true)} className="flex items-center gap-1.5 rounded-lg border border-dream-200 bg-white px-3 py-1.5 text-xs text-dream-600 transition hover:bg-dream-50">
            <FileText className="h-3 w-3" /> 导入长文
          </button>
          <button onClick={() => setCompactMode((value) => !value)} className={`rounded-lg px-3 py-1.5 text-xs transition ${compactMode ? 'bg-dream-600 text-white' : 'border border-dream-200 bg-white text-dream-600 hover:bg-dream-50'}`}>
            {compactMode ? '宽松视图' : '紧凑视图'}
          </button>
        </div>
      </div>
      {showImporter && (
        <ManuscriptImporter
          characters={characters}
          onClose={() => setShowImporter(false)}
          onImport={(text) => {
            const count = importManuscript(text)
            if (count > 0) setShowImporter(false)
            return count
          }}
        />
      )}
    </div>
  )
}
