/**
 * FlowEditor.tsx — 主编辑器容器
 *
 * 三栏布局：场景树 | 镜头卡编辑器 | 实时预览
 * 逻辑图降级为次要视图，仅用于检查分支结构。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Play, Save, Sparkles, Image, Settings, Eye, EyeOff, ArrowLeft,
  LayoutGrid, GitBranch, Copy, Check, ListChecks, Plus, Trash2, Undo2, Redo2,
} from 'lucide-react'
import AgentPanel from '../agent/AgentPanel'
import type { AgentScope, AppliedPatchDto } from '../agent/agentTypes'
import type { StoryNodeType } from '@dreamchord/story-domain'
import AssetPanel from './AssetPanel'
import ProjectSettingsModal from './ProjectSettingsModal'
import SceneTree from './SceneTree'
import ShotCardEditor from './ShotCardEditor'
import MiniPreview from './MiniPreview'
import StoryFlowchart from './StoryFlowchart'
import {
  buildSceneList,
  getNodeSceneGroupId, getNodeSceneCode, getNodeData,
  findSceneStartNode, getSceneGroupNodes, createSceneNodes, normalizeShotCard,
  ensureSceneCode, layoutNodes, normalEdge, chainEdges, choiceEdge,
  groupNodesToCards, toChineseNumber, normalizeChapterTitle,
  findConvergenceScenes,
  getSceneFlowPosition, setSceneFlowPosition,
  type ShotCard,
} from './sceneGraph'
import { useEditorStore } from '../stores/editorStore'
import { useToast, useConfirm } from '../components/FeedbackProvider'
import {
  getProject, createChapter, saveChapter, updateProject, deleteChapter,
  type SaveChapterPayload,
  type Asset, type ProjectDetail,
} from '../api/client'
import { getApiError, convertServerNodes, convertServerEdges, ensureLegacySceneGroups } from './flowEditorUtils'
import { ProjectHealthPanel } from './ProjectHealthPanel'
import { editorPaneClasses } from './responsiveLayout'
import { SaveCoordinator, type SaveState } from './saveCoordinator'

export default function FlowEditor() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()

  // 面板状态
  const [showAI, setShowAI] = useState(false)
  const [showAssets, setShowAssets] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showHealth, setShowHealth] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [viewMode, setViewMode] = useState<'scene' | 'flow'>('scene')
  const [assetTarget, setAssetTarget] = useState<{ nodeId: string; field: 'backgroundId' | 'characterId'; type: 'BACKGROUND' | 'CG' } | null>(null)
  const [agentTask, setAgentTask] = useState<{ id: number; prompt: string; scope: AgentScope }>()

  // 场景/卡片选择
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [autoEditCardId, setAutoEditCardId] = useState<string | null>(null)

  const store = useEditorStore()
  const nodes = store.nodes
  const edges = store.edges
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('clean')
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastRef = useRef(toast)
  toastRef.current = toast
  const saveCoordinator = useMemo(() => new SaveCoordinator<SaveChapterPayload>({
    readLatest: () => {
      const state = useEditorStore.getState()
      return {
        chapterId: state.chapterId || '', baseVersion: state.chapterVersion,
        nodes: state.nodes.map((node) => ({ nodeId: node.id, type: node.type || 'dialogue', positionX: node.position.x, positionY: node.position.y, data: JSON.stringify(node.data) })),
        edges: state.edges.map((edge) => ({ edgeId: edge.id, source: edge.source, target: edge.target, label: typeof edge.label === 'string' ? edge.label : undefined, sourceHandle: typeof edge.sourceHandle === 'string' ? edge.sourceHandle : undefined, animated: edge.animated ?? true })),
      }
    },
    save: async (payload) => {
      if (!projectId || projectId === 'new' || !payload.chapterId) throw new Error('当前章节不可保存')
      const saved = await saveChapter(projectId, payload)
      useEditorStore.getState().setChapterVersion(saved.version)
      useEditorStore.getState().setLastSavedAt(new Date())
    },
    onStateChange: (state) => { setSaveState(state); useEditorStore.getState().setSaving(state === 'saving') },
    onError: (error, state) => toastRef.current.error(state === 'conflict' ? '章节已发生变化，请重新打开项目后再继续编辑。' : getApiError(error, '保存失败')),
  }), [projectId])

  // 组件卸载时清理自动保存定时器，防止引用已卸载组件状态
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!projectId || projectId === 'new') return
    store.setLoading(true)
    getProject(projectId)
      .then((project) => syncProjectToStore(project))
      .catch((err) => {
        console.error(err)
        if (err.response?.status === 401 || err.response?.status === 403) {
          toast.error('请先登录')
          navigate('/login')
        }
      })
      .finally(() => store.setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, navigate])

  const syncProjectToStore = (project: ProjectDetail) => {
    setProject(project)
    const chapter = project.chapters.find((item) => item.id === activeChapterId) || project.chapters[0]
    store.setProject({
      id: project.id, title: project.title, description: project.description || undefined,
      cover: project.cover, isPublic: project.isPublic, isPublished: project.isPublished,
    })
    if (chapter) loadChapterIntoEditor(chapter)
  }

  const loadChapterIntoEditor = (chapter: ProjectDetail['chapters'][number]) => {
    setActiveChapterId(chapter.id)
    store.setChapterId(chapter.id)
    store.setChapterVersion(chapter.version || 1)
    const flowNodes = ensureLegacySceneGroups(convertServerNodes(chapter.nodes))
    const flowEdges = convertServerEdges(chapter.edges)
    store.hydrateGraph(flowNodes, flowEdges)
    saveCoordinator.reset()
    store.setSelectedNodeId(null)
    // 自动选中第一个场景
    const scenes = buildSceneList(flowNodes, flowEdges)
    if (scenes.length > 0) setSelectedSceneId(scenes[0]!.id)
  }

  // === 场景操作 ===

  const handleSelectScene = (sceneId: string) => {
    setSelectedSceneId(sceneId)
    setSelectedCardId(null)
  }

  /** 从卡片编辑器请求 AI 助手 */
  const handleRequestAI = (mode: 'polish' | 'continue' | 'choices' | 'branchReplies' | 'storyGraph') => {
    const tasks: Record<typeof mode, { prompt: string; scope: AgentScope }> = {
      polish: { prompt: '润色当前镜头，保持角色语言习惯和原意。', scope: 'card' },
      continue: { prompt: '承接当前场景续写一组有推进作用的镜头。', scope: 'scene' },
      choices: { prompt: '为当前冲突生成三个会导向不同后果的选择，并连接合理后续。', scope: 'scene' },
      branchReplies: { prompt: '为当前选项的每条分支补充符合人物动机的回应。', scope: 'scene' },
      storyGraph: { prompt: '根据当前章节与故事圣经，生成一段结构完整且可播放的节点草案。', scope: 'chapter' },
    }
    setAgentTask({ id: Date.now(), ...tasks[mode] })
    setShowAI(true)
    setShowAssets(false)
  }

  /** 从选项创建新分支场景 */
  const handleCreateBranch = (_cardId: string, choiceIndex: number, choiceText: string) => {
    const card = selectedCard
    if (!card) return

    // 找到 choice 节点
    const choiceNodeId = card.nodeIds.find((id) => {
      const n = nodes.find((nn) => nn.id === id)
      return n?.type === 'choice'
    })
    if (!choiceNodeId) return

    // 创建新场景
    const stamp = Date.now()
    const rnd = Math.random().toString(36).slice(2, 6)
    const newSceneGroupId = `scene-${stamp}-${rnd}`
    const chapter = card.sceneCode ? card.sceneCode.split('-')[0] : '1'
    const sceneCode = ensureSceneCode(
      { sceneCode: '', sceneGroupId: '', } as ShotCard,
      nodes,
      chapter,
    )

    const draft: ShotCard = {
      id: `card-${stamp}`,
      sceneId: newSceneGroupId,
      type: 'dialogue',
      lensType: 'dialogue',
      background: card.background,
      characters: [],
      speaker: '旁白',
      speakerExpression: 'normal',
      speakerPosition: 'center',
      autoStageSpeaker: false,
      text: `（分支：${choiceText}）`,
      sceneCode,
      sceneGroupId: newSceneGroupId,
      nodeIds: [],
    }

    const normalized = normalizeShotCard(draft)
    const { nodes: newNodes } = createSceneNodes(normalized, newSceneGroupId)

    const allNodes = [...nodes, ...newNodes]
    const allEdges = [...edges]

    // 移除该选项的旧边
    const oldEdge = edges.find((e) => e.source === choiceNodeId && e.sourceHandle === `choice-${choiceIndex}`)
    if (oldEdge) {
      const idx = allEdges.indexOf(oldEdge)
      if (idx >= 0) allEdges.splice(idx, 1)
    }
    // 添加新的 choice 边
    allEdges.push(choiceEdge(choiceNodeId, newNodes[0]!.id, choiceIndex, choiceText))

    const laidOut = layoutNodes(allNodes, allEdges)
    handleUpdateGraph(laidOut, allEdges)

    // 自动跳转到新场景
    setSelectedSceneId(newSceneGroupId)
    setSelectedCardId(draft.id)
  }

  const handleAddScene = (chapter: string) => {
    const sceneCode = ensureSceneCode(
      { sceneCode: '', sceneGroupId: '', } as ShotCard,
      nodes,
      chapter,
    )
    const stamp = Date.now()
    const rnd = Math.random().toString(36).slice(2, 6)
    const sceneGroupId = `scene-${stamp}-${rnd}`

    // 检查前一个场景是否有角色，如果有则在场景切换时清空舞台
    let prevCharacters: { characterId: string; expression: string; position: 'left' | 'center' | 'right'; action: 'show' | 'hide' | 'change' | 'keep' }[] = []
    if (selectedSceneId) {
      const prevSceneStart = findSceneStartNode(selectedSceneId, nodes, edges)
      if (prevSceneStart) {
        const prevSceneNodes = getSceneGroupNodes(prevSceneStart, nodes, edges)
        const prevCards = groupNodesToCards(prevSceneNodes)
        const lastCardWithChars = [...prevCards].reverse().find((c) => c.characters.length > 0)
        if (lastCardWithChars) {
          prevCharacters = lastCardWithChars.characters.map((c) => ({
            characterId: c.characterId,
            expression: c.expression,
            position: c.position,
            action: 'hide' as const,
          }))
        }
      }
    }

    const draft: ShotCard = {
      id: `card-${stamp}`,
      sceneId: sceneGroupId,
      type: 'dialogue',
      lensType: prevCharacters.length > 0 ? 'narration' : 'dialogue',
      background: '',
      characters: prevCharacters,
      speaker: '旁白',
      speakerExpression: 'normal',
      speakerPosition: 'center',
      autoStageSpeaker: false,
      text: prevCharacters.length > 0 ? '——场景切换，角色退场——' : '新场景开始...',
      sceneCode,
      sceneGroupId,
      nodeIds: [],
    }

    const normalized = normalizeShotCard(draft)
    const { nodes: newNodes } = createSceneNodes(normalized, sceneGroupId)

    const allNodes = [...nodes, ...newNodes]
    const allEdges = [...edges]

    if (selectedSceneId) {
      const selectedSceneStart = findSceneStartNode(selectedSceneId, nodes, edges)
      const selectedSceneNodes = selectedSceneStart ? getSceneGroupNodes(selectedSceneStart, nodes, edges) : []
      const selectedSceneTail = selectedSceneNodes[selectedSceneNodes.length - 1]
      if (selectedSceneTail) {
        const oldOutgoing = edges.find((e) => e.source === selectedSceneTail.id && !e.sourceHandle)
        if (oldOutgoing) {
          const index = allEdges.findIndex((edge) => edge.id === oldOutgoing.id)
          if (index >= 0) allEdges.splice(index, 1)
        }
        allEdges.push(normalEdge(selectedSceneTail.id, newNodes[0]!.id))
        if (oldOutgoing) {
          allEdges.push(normalEdge(newNodes[newNodes.length - 1]!.id, oldOutgoing.target))
        }
      }
    } else {
      const outgoing = new Set(edges.map((e) => e.source))
      const endings = nodes.filter((n) => n.type !== 'choice' && !outgoing.has(n.id))
      if (endings.length === 1) {
        allEdges.push(normalEdge(endings[0]!.id, newNodes[0]!.id))
      }
    }
    allEdges.push(...chainEdges(newNodes))

    const laidOut = layoutNodes(allNodes, allEdges)
    handleUpdateGraph(laidOut, allEdges)
    setSelectedSceneId(sceneGroupId)
    setSelectedCardId(draft.id)
    setAutoEditCardId(draft.id)
  }

  const handleAddChapter = () => {
    if (!projectId || projectId === 'new') {
      toast.info('请先创建正式故事项目，再新增章节。')
      return
    }
    handleCreateChapter()
  }

  const handleDeleteScene = (sceneId: string) => {
    const sceneNodes = nodes.filter((n) => getNodeSceneGroupId(n) === sceneId)
    if (sceneNodes.length === 0) return
    const nodeIds = new Set(sceneNodes.map((n) => n.id))
    const remainingNodes = nodes.filter((n) => !nodeIds.has(n.id))
    const remainingEdges = edges.filter((e) => !nodeIds.has(e.source) && !nodeIds.has(e.target))

    // 重新连接前驱和后继
    const incomingEdge = edges.find((e) => e.target === sceneNodes[0]!.id)
    const lastSceneNode = sceneNodes[sceneNodes.length - 1]!
    const outgoingEdge = edges.find((e) => e.source === lastSceneNode.id && !e.sourceHandle)
    if (incomingEdge && outgoingEdge) {
      remainingEdges.push(normalEdge(incomingEdge.source, outgoingEdge.target))
    }

    handleUpdateGraph(remainingNodes, remainingEdges)
    if (selectedSceneId === sceneId) {
      const scenes = buildSceneList(remainingNodes, remainingEdges)
      setSelectedSceneId(scenes[0]?.id || null)
    }
  }

  const handleRenameScene = (sceneId: string, title: string) => {
    const nextTitle = title.trim()
    if (!nextTitle) return
    const renamedNodes = nodes.map((node) => {
      if (getNodeSceneGroupId(node) !== sceneId) return node
      return {
        ...node,
        data: {
          ...getNodeData(node),
          sceneTitle: nextTitle,
        },
      }
    })
    handleUpdateGraph(renamedNodes, edges)
  }

  /** 设置场景出口：指向目标场景（汇合/跳转）或设为结局（null） */
  const handleSetSceneExit = (sceneId: string, targetSceneId: string | null) => {
    const sceneStart = findSceneStartNode(sceneId, nodes, edges)
    if (!sceneStart) return
    const sceneNodes = getSceneGroupNodes(sceneStart, nodes, edges)
    const tailNode = sceneNodes[sceneNodes.length - 1]
    if (!tailNode) return

    // 移除该场景尾节点的旧跨场景出边（流程边）
    const oldExitEdges = edges.filter(e =>
      e.source === tailNode.id && !e.sourceHandle &&
      getNodeSceneGroupId(nodes.find(n => n.id === e.target)!) !== sceneId
    )
    const newEdges = edges.filter(e => !oldExitEdges.includes(e))

    if (targetSceneId) {
      const targetStart = findSceneStartNode(targetSceneId, nodes, edges)
      if (targetStart) {
        newEdges.push(normalEdge(tailNode.id, targetStart.id))
      }
    }
    handleUpdateGraph(nodes, newEdges)
  }

  /** 拖拽场景卡片：持久化位置到 background 节点 data.flowPosition */
  const handleRepositionScene = (sceneId: string, x: number, y: number) => {
    const updated = setSceneFlowPosition(sceneId, { x, y }, nodes)
    handleUpdateGraph(updated, edges)
  }

  /** 拖拽创建场景间连接（普通出口） */
  const handleCreateConnection = (sourceSceneId: string, targetSceneId: string) => {
    const srcStart = findSceneStartNode(sourceSceneId, nodes, edges)
    const srcNodes = srcStart ? getSceneGroupNodes(srcStart, nodes, edges) : []
    const tail = srcNodes[srcNodes.length - 1]
    const tgtStart = findSceneStartNode(targetSceneId, nodes, edges)
    if (!tail || !tgtStart) return

    // 移除源场景尾节点的旧跨场景出边（普通出口）
    const newEdges = edges.filter(e =>
      !(e.source === tail.id && !e.sourceHandle &&
        getNodeSceneGroupId(nodes.find(n => n.id === e.target)!) !== sourceSceneId)
    )
    newEdges.push(normalEdge(tail.id, tgtStart.id))
    handleUpdateGraph(nodes, newEdges)
  }

  /** 断开场景间连接 */
  const handleDisconnectConnection = (sourceSceneId: string, targetSceneId: string) => {
    const newEdges = edges.filter(e => {
      const src = nodes.find(n => n.id === e.source)
      const tgt = nodes.find(n => n.id === e.target)
      if (!src || !tgt) return true
      return !(getNodeSceneGroupId(src) === sourceSceneId && getNodeSceneGroupId(tgt) === targetSceneId)
    })
    handleUpdateGraph(nodes, newEdges)
  }

  const handleRenameChapter = (chapterId: string, title: string) => {
    const nextTitle = title.trim()
    if (!nextTitle) return
    // 将章节标题写入该章节下所有节点的 chapterTitle 字段
    const renamedNodes = nodes.map((node) => {
      const sceneCode = getNodeSceneCode(node)
      const chapter = sceneCode.split('-')[0] || '1'
      if (chapter !== chapterId) return node
      return {
        ...node,
        data: {
          ...getNodeData(node),
          chapterTitle: nextTitle,
        },
      }
    })
    handleUpdateGraph(renamedNodes, edges)
  }

  const handleUpdateGraph = (newNodes: Node[], newEdges: Edge[]) => {
    store.commitGraph(newNodes, newEdges)
    triggerAutoSave()
  }

  // 获取当前选中的卡片
  const sceneList = useMemo(() => buildSceneList(nodes, edges), [nodes, edges])
  const convergenceMap = useMemo(() => findConvergenceScenes(nodes, edges, sceneList), [nodes, edges, sceneList])
  const flowPositionOverrides = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>()
    sceneList.forEach(s => { const p = getSceneFlowPosition(s.id, nodes); if (p) m.set(s.id, p) })
    return m
  }, [sceneList, nodes])

  // 当前激活的章节对象（用于左栏显示正确的章节名）
  const activeChapter = useMemo(() => {
    if (!project) return null
    return project.chapters.find((ch) => ch.id === activeChapterId) || project.chapters[0] || null
  }, [project, activeChapterId])

  const selectedCard = useMemo(() => {
    if (!selectedSceneId || !selectedCardId) return null
    const sceneStart = findSceneStartNode(selectedSceneId, nodes, edges)
    if (!sceneStart) return null
    const sceneNodes = getSceneGroupNodes(sceneStart, nodes, edges)
    const cards = groupNodesToCards(sceneNodes)
    return cards.find((c) => c.id === selectedCardId) || cards[0] || null
  }, [selectedSceneId, selectedCardId, nodes, edges])

  // === 保存/预览/发布 ===

  const handleSave = async () => {
    if (!projectId || projectId === 'new') { toast.info('请先从首页新建故事项目，再保存编辑内容。'); return false }
    if (!store.chapterId) { toast.info('当前项目还没有可保存的章节，请重新打开项目后再试。'); return false }
    saveCoordinator.markDirty()
    await saveCoordinator.flush()
    return saveCoordinator.state === 'saved'
  }

  const triggerAutoSave = () => {
    if (!projectId || projectId === 'new') return
    saveCoordinator.markDirty()
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => { void saveCoordinator.flush() }, 3000)
  }

  const handlePreview = async () => {
    if (projectId && projectId !== 'new') {
      const saved = await handleSave()
      if (!saved) return
      navigate(`/play/${projectId}?preview=${Date.now()}`)
      return
    }
    toast.info('请先从首页新建故事项目并保存，再进入预览。')
  }

  const handleSwitchChapter = async (chapterId: string) => {
    if (!project) return
    if (chapterId === store.chapterId) return

    // 正式项目：先保存当前章节，再从服务器获取最新数据
    if (projectId && projectId !== 'new') {
      const saved = await handleSave()
      if (!saved) return
      try {
        const freshProject = await getProject(projectId)
        setProject(freshProject)
        const chapter = freshProject.chapters.find((item) => item.id === chapterId)
        if (chapter) {
          loadChapterIntoEditor(chapter)
        } else {
          console.warn('切换章节失败：服务器返回的项目中找不到章节', chapterId)
        }
      } catch (err) {
        console.error('切换章节失败：', err)
        toast.error('切换章节失败，请重试')
      }
    } else {
      // 草稿模式：直接从本地 project 数据中加载
      const chapter = project.chapters.find((item) => item.id === chapterId)
      if (chapter) {
        loadChapterIntoEditor(chapter)
      }
    }
  }

  const handleCreateChapter = async () => {
    if (!projectId || projectId === 'new') { toast.info('请先创建正式故事项目，再新增章节。'); return }
    const saved = await handleSave()
    if (!saved) return
    const nextIndex = (project?.chapters.length || 0) + 1
    const created = await createChapter(projectId, { title: `第${toChineseNumber(nextIndex)}章` })
    const freshProject = await getProject(projectId)
    setProject(freshProject)
    const chapter = freshProject.chapters.find((item) => item.id === created.id) || freshProject.chapters[freshProject.chapters.length - 1]
    if (chapter) loadChapterIntoEditor(chapter)
  }

  const handleDeleteChapter = async (chapterId: string) => {
    if (!projectId || projectId === 'new' || !project) return
    if (project.chapters.length <= 1) {
      toast.error('至少保留一个章节，无法删除。')
      return
    }
    const chapter = project.chapters.find((c) => c.id === chapterId)
    if (!chapter) return
    if (!await confirm({ message: `确定删除「${chapter.title}」吗？该章节下的所有场景和镜头卡都会被删除。`, danger: true })) return
    try {
      await deleteChapter(projectId, chapterId)
      const freshProject = await getProject(projectId)
      setProject(freshProject)
      // 切换到剩余的第一个章节
      const remainingChapter = freshProject.chapters[0]
      if (remainingChapter) {
        loadChapterIntoEditor(remainingChapter)
      } else {
        store.hydrateGraph([], [])
        saveCoordinator.reset()
        setSelectedSceneId(null)
      }
    } catch (err: unknown) {
      toast.error(getApiError(err, '删除章节失败'))
    }
  }

  const handleTogglePublish = async () => {
    if (!projectId || projectId === 'new') { toast.info('请先保存为正式故事项目，再发布。'); return }
    try {
      const saved = await handleSave()
      if (!saved) return
      const updated = await updateProject(projectId, { isPublished: !store.project?.isPublished, isPublic: !store.project?.isPublished ? true : store.project?.isPublic })
      store.setProject({ id: updated.id, title: updated.title, description: updated.description || undefined, cover: updated.cover, isPublic: updated.isPublic, isPublished: updated.isPublished })
    } catch (err: unknown) { toast.error(getApiError(err, '操作失败')) }
  }

  const handleCopyShareLink = async () => {
    if (!projectId || projectId === 'new') return
    const url = `${window.location.origin}/play/${projectId}`
    try { await navigator.clipboard.writeText(url) } catch {
      // clipboard API 不可用时静默失败，用户可手动复制
    }
    setShareCopied(true)
    window.setTimeout(() => setShareCopied(false), 1800)
  }

  const handleSelectAsset = (asset: Asset) => {
    if (!assetTarget) return
    if (assetTarget.field === 'backgroundId') store.updateNodeData(assetTarget.nodeId, { backgroundId: asset.url })
    else store.updateNodeData(assetTarget.nodeId, { characterId: asset.url })
    setAssetTarget(null)
    triggerAutoSave()
  }

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveCoordinator.isDirty) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [saveCoordinator, saveState])

  const undoGraph = () => {
    if (!store.canUndo) return
    store.undo()
    triggerAutoSave()
  }
  const redoGraph = () => {
    if (!store.canRedo) return
    store.redo()
    triggerAutoSave()
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return
      if (!(event.ctrlKey || event.metaKey)) return
      if (event.key.toLocaleLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redoGraph(); else undoGraph() }
      else if (event.key.toLocaleLowerCase() === 'y') { event.preventDefault(); redoGraph() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const navigateHome = async () => {
    if (saveCoordinator.isDirty && !await confirm({ title: '离开编辑器', message: '仍有内容尚未保存，确定离开吗？', danger: true, confirmText: '离开' })) return
    navigate('/')
  }

  const paneClasses = editorPaneClasses(showAssets || showAI)

  return (
    <div className="flex h-full flex-col">
      {/* === 顶部工具栏 === */}
      <div className="z-20 flex flex-wrap items-center justify-between gap-3 border-b border-dream-100 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={() => void navigateHome()} title="返回首页" className="inline-flex items-center gap-1 rounded-lg border border-dream-200 bg-white px-2.5 py-1.5 text-sm font-medium text-dream-700 transition hover:bg-dream-50">
            <ArrowLeft className="h-4 w-4" /> 首页
          </button>
          <h1 className="min-w-0 max-w-[200px] truncate font-semibold text-dream-900" title={store.project?.title || '未命名项目'}>
            {store.project?.title || '未命名项目'}
          </h1>
          {projectId === 'new' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">未保存草稿</span>}
          {store.project?.isPublished && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">已发布</span>}
          {store.isLoading && <span className="text-xs text-dream-500">加载中...</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex border border-dream-200 bg-white p-0.5">
            <button type="button" aria-label="撤销图谱修改" title="撤销 (Ctrl/Cmd+Z)" disabled={!store.canUndo} onClick={undoGraph} className="flex h-7 w-7 items-center justify-center text-dream-700 hover:bg-dream-50 disabled:opacity-30"><Undo2 className="h-4 w-4" /></button>
            <button type="button" aria-label="重做图谱修改" title="重做 (Ctrl/Cmd+Shift+Z)" disabled={!store.canRedo} onClick={redoGraph} className="flex h-7 w-7 items-center justify-center text-dream-700 hover:bg-dream-50 disabled:opacity-30"><Redo2 className="h-4 w-4" /></button>
          </div>
          {/* 章节切换 */}
          {project && project.chapters.length > 0 && (
            <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-dream-200 bg-white p-0.5">
              {project.chapters.map((chapter) => (
                <div key={chapter.id} className="group/chap relative flex items-center">
                  <button
                    onClick={() => handleSwitchChapter(chapter.id)}
                    className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition ${chapter.id === store.chapterId ? 'bg-dream-600 text-white' : 'text-dream-600 hover:bg-dream-50'}`}
                  >
                    {normalizeChapterTitle(chapter.title, (chapter.order ?? 0))}
                  </button>
                  {project.chapters.length > 1 && (
                    <button
                      onClick={() => handleDeleteChapter(chapter.id)}
                      title="删除章节"
                      className="ml-0.5 rounded p-0.5 text-dream-300 opacity-60 transition hover:bg-red-50 hover:text-red-500 hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={handleCreateChapter} className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium text-dream-600 hover:bg-dream-50" title="新建章节">
                <Plus className="h-3.5 w-3.5" /> 新章节
              </button>
            </div>
          )}

          {/* 视图切换 */}
          <div className="flex rounded-lg border border-dream-200 bg-white p-0.5">
            <button onClick={() => setViewMode('scene')} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${viewMode === 'scene' ? 'bg-dream-600 text-white' : 'text-dream-600 hover:bg-dream-50'}`} title="场景编辑：章节→场景→镜头卡">
              <LayoutGrid className="h-3.5 w-3.5" /> 场景编辑
            </button>
            <button onClick={() => setViewMode('flow')} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${viewMode === 'flow' ? 'bg-dream-600 text-white' : 'text-dream-600 hover:bg-dream-50'}`} title="剧情流程图：总览全部场景和分支关系">
              <GitBranch className="h-3.5 w-3.5" /> 剧情流程图
            </button>
          </div>

          <button onClick={() => setShowSettings(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-dream-200 bg-white px-3 py-1.5 text-sm font-medium text-dream-700 transition hover:bg-dream-50">
            <Settings className="h-4 w-4" />
          </button>
          <button onClick={() => setShowHealth(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-dream-200 bg-white px-3 py-1.5 text-sm font-medium text-dream-700 transition hover:bg-dream-50" title="项目体检">
            <ListChecks className="h-4 w-4" />
          </button>
          <button onClick={handleTogglePublish} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${store.project?.isPublished ? 'border border-dream-200 bg-white text-dream-700 hover:bg-dream-50' : 'bg-dream-600 text-white hover:bg-dream-700'}`}>
            {store.project?.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {store.project?.isPublished ? '取消发布' : '发布'}
          </button>
          {store.project?.isPublished && (
            <button onClick={handleCopyShareLink} className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 transition hover:bg-green-100" title="复制分享链接">
              {shareCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {shareCopied ? '已复制' : '分享'}
            </button>
          )}
          <button onClick={() => { const next = !showAssets; setShowAssets(next); if (next) setShowAI(false) }} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${showAssets ? 'bg-dream-600 text-white' : 'border border-dream-200 bg-white text-dream-700 hover:bg-dream-50'}`}>
            <Image className="h-4 w-4" /> 素材库
          </button>
          <button onClick={() => { const next = !showAI; setShowAI(next); if (next) setShowAssets(false) }} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${showAI ? 'bg-dream-600 text-white' : 'border border-dream-200 bg-white text-dream-700 hover:bg-dream-50'}`}>
            <Sparkles className="h-4 w-4" /> 创作 Agent
          </button>
          <button onClick={handlePreview} className="inline-flex items-center gap-1.5 rounded-lg bg-dream-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-dream-700">
            <Play className="h-4 w-4" /> 预览
          </button>
          <button onClick={handleSave} disabled={store.isSaving} className="inline-flex items-center gap-1.5 rounded-lg border border-dream-200 bg-white px-3 py-1.5 text-sm font-medium text-dream-700 transition hover:bg-dream-50 disabled:opacity-50">
            <Save className={`h-4 w-4 ${store.isSaving ? 'animate-spin' : ''}`} />
            {saveState === 'saving' ? '保存中' : saveState === 'conflict' ? '版本冲突' : saveState === 'error' ? '重试保存' : store.lastSavedAt ? '已保存' : '保存'}
          </button>
        </div>
      </div>

      {/* === 主体内容 === */}
      {viewMode === 'flow' ? (
        /* 剧情流程图视图 — galgame 风格总览 */
        <StoryFlowchart
          nodes={nodes}
          edges={edges}
          scenes={sceneList}
          selectedSceneId={selectedSceneId}
          onSelectScene={(sceneId) => { handleSelectScene(sceneId); setViewMode('scene') }}
          onEditScene={(sceneId) => { handleSelectScene(sceneId); setViewMode('scene') }}
          onAddScene={handleAddScene}
          onDeleteScene={handleDeleteScene}
          onRenameScene={handleRenameScene}
          onAddChapter={handleAddChapter}
          chapters={project?.chapters.map(ch => ({ id: ch.id, title: ch.title, order: ch.order ?? 0 }))}
          positionOverrides={flowPositionOverrides}
          onRepositionScene={handleRepositionScene}
          onCreateConnection={handleCreateConnection}
          onDisconnectConnection={handleDisconnectConnection}
        />
      ) : (
        /* 场景编辑三栏布局 */
        <div className="flex flex-1 overflow-hidden">
          {/* 左栏：场景树 */}
          <div className={paneClasses.tree}>
            <SceneTree
              nodes={nodes}
              edges={edges}
              selectedSceneId={selectedSceneId}
              onSelectScene={handleSelectScene}
              onAddScene={handleAddScene}
              onAddChapter={handleAddChapter}
              onDeleteScene={handleDeleteScene}
              onRenameScene={handleRenameScene}
              onRenameChapter={handleRenameChapter}
              onDeleteChapter={handleDeleteChapter}
              canDeleteChapter={project ? project.chapters.length > 1 : false}
              projectChapters={activeChapter ? [{ id: activeChapter.id, title: activeChapter.title || `第${toChineseNumber((activeChapter.order ?? 0) + 1)}章`, order: (activeChapter.order ?? 0) + 1 }] : undefined}
            />
          </div>

          {/* 中栏：镜头卡编辑器 */}
          <div className={paneClasses.center}>
            <ShotCardEditor
              nodes={nodes}
              edges={edges}
              selectedSceneId={selectedSceneId}
              selectedCardId={selectedCardId}
              autoEditCardId={autoEditCardId}
              onConsumeAutoEdit={() => setAutoEditCardId(null)}
              onSelectCard={setSelectedCardId}
              onUpdateGraph={handleUpdateGraph}
              scenes={sceneList}
              onCreateBranch={handleCreateBranch}
              onNavigateToScene={handleSelectScene}
              onRequestAI={handleRequestAI}
              onSetSceneExit={handleSetSceneExit}
              convergenceMap={convergenceMap}
            />
          </div>

          {/* 右栏：根据面板状态切换 MiniPreview / 素材库 / AI助手 */}
          <div className={paneClasses.side}>
            {showAssets ? (
              <AssetPanel
                selectedType={assetTarget?.type}
                onSelect={handleSelectAsset}
                onClose={() => setShowAssets(false)}
              />
            ) : showAI ? (
              <AgentPanel
                projectId={projectId || ''}
                chapterId={store.chapterId || ''}
                chapterVersion={store.chapterVersion}
                selectedNodeId={store.selectedNodeId}
                selectedSceneId={selectedSceneId}
                taskRequest={agentTask}
                graph={{
                  nodes: nodes.map((node) => ({ id: node.id, type: (node.type || 'dialogue') as StoryNodeType, position: node.position, data: { ...node.data } })),
                  edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, label: typeof edge.label === 'string' ? edge.label : undefined, sourceHandle: edge.sourceHandle || undefined, animated: edge.animated ?? true })),
                }}
                onApplyGraph={(result: AppliedPatchDto) => {
                  store.commitGraph(result.graph.nodes, result.graph.edges)
                  store.setChapterVersion(result.version)
                  store.setLastSavedAt(new Date())
                  saveCoordinator.reset()
                  toast.success('章节图已更新，可以继续编辑。')
                }}
                onSelectNode={(nodeId) => {
                  store.setSelectedNodeId(nodeId)
                  const node = nodes.find((item) => item.id === nodeId)
                  const sceneId = node && typeof node.data.sceneGroupId === 'string' ? node.data.sceneGroupId : null
                  if (sceneId) handleSelectScene(sceneId)
                }}
                onClose={() => setShowAI(false)}
              />
            ) : (
              <MiniPreview card={selectedCard} onFullScreen={handlePreview} />
            )}
          </div>
        </div>
      )}

      {/* === 模态浮层（设置/体检） === */}
      {showSettings && (
        <ProjectSettingsModal
          project={store.project}
          characters={project?.characters.map((character) => ({ id: character.id, name: character.name }))}
          onClose={() => setShowSettings(false)}
          onUpdate={(data) => {
            if (!projectId || projectId === 'new') return
            updateProject(projectId, data)
              .then((updated) => {
                store.setProject({ id: updated.id, title: updated.title, description: updated.description || undefined, cover: updated.cover, isPublic: updated.isPublic, isPublished: updated.isPublished })
                setShowSettings(false)
              })
              .catch((err: unknown) => toast.error(getApiError(err, '更新失败')))
          }}
        />
      )}
      {showHealth && (
        <ProjectHealthPanel
          projectTitle={store.project?.title || '未命名项目'}
          isPublished={Boolean(store.project?.isPublished)}
          nodes={store.nodes}
          edges={store.edges}
          onClose={() => setShowHealth(false)}
        />
      )}
    </div>
  )
}
