import { useMemo, useState } from 'react'
import { useConfirm } from '../components/FeedbackProvider'
import type { Edge, Node } from '@xyflow/react'
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  GitBranch,
  Image as ImageIcon,
  MessageSquare,
  Plus,
  Save,
  Trash2,
  Type,
  User,
  Users,
  X,
} from 'lucide-react'
import { useEditorStore } from '../stores/editorStore'
import { loadLibraryCharacters, loadLibraryScenes } from '../lib/libraryData'
import {
  getNodeData,
  getNodeSceneGroupId,
  getNodeSceneCode,
  getNodeCharacterId,
} from './sceneGraph'

type Tab = 'story' | 'characters' | 'scenes'
type BranchInfo = { index: number; label: string; start?: Node; chain: Node[]; merge?: Node }
type LensType = 'dialogue' | 'narration' | 'thought' | 'memory' | 'system'
type SceneCharacterDraft = {
  characterId: string
  expression: string
  position: 'left' | 'center' | 'right'
  action?: 'show' | 'hide' | 'keep'
}
type SceneDraft = {
  sceneCode: string
  lensType: LensType
  backgroundId: string
  characters: SceneCharacterDraft[]
  speakerRole: string
  speakerExpression: string
  speakerPosition: 'left' | 'center' | 'right'
  autoStageSpeaker: boolean
  text: string
}
type SceneComposerTarget =
  | { kind: 'main' }
  | { kind: 'branch'; choiceNode: Node; branch: BranchInfo }
  | { kind: 'edit'; sceneGroupId: string }
type StoryItem =
  | { kind: 'node'; node: Node }
  | { kind: 'choice'; node: Node; branches: BranchInfo[]; merge?: Node }

interface WorkbenchPanelProps {
  onSave: () => void
}

const NODE_LABEL: Record<string, string> = {
  dialogue: '对话',
  subtitle: '旁白',
  choice: '选项',
  background: '背景',
  character: '角色',
  transition: '转场',
  delay: '等待',
  condition: '条件',
  setVariable: '变量',
  jump: '跳转',
}

const QUICK_TYPES = [
  { type: 'dialogue', label: '对话', icon: MessageSquare },
  { type: 'subtitle', label: '旁白', icon: Type },
  { type: 'choice', label: '选项', icon: GitBranch },
  { type: 'background', label: '背景', icon: ImageIcon },
  { type: 'character', label: '角色', icon: User },
]

const BRANCH_TYPES = [
  { type: 'dialogue', label: '对话', icon: MessageSquare },
  { type: 'subtitle', label: '旁白', icon: Type },
  { type: 'background', label: '背景', icon: ImageIcon },
  { type: 'character', label: '角色', icon: User },
  { type: 'choice', label: '选项', icon: GitBranch },
]

const LENS_TYPES: Array<{ id: LensType; label: string; desc: string }> = [
  { id: 'dialogue', label: '角色对话', desc: '角色登场、换表情并说话' },
  { id: 'narration', label: '旁白', desc: '叙述动作、环境和剧情推进' },
  { id: 'thought', label: '心理描写', desc: '角色内心独白，可带立绘状态' },
  { id: 'memory', label: '回忆镜头', desc: '插入过去片段、闪回或梦境' },
  { id: 'system', label: '系统提示', desc: 'Meta 提示、节点异常和界面信息' },
]

const LENS_LABEL: Record<LensType, string> = Object.fromEntries(LENS_TYPES.map((item) => [item.id, item.label])) as Record<LensType, string>

export default function WorkbenchPanel({ onSave }: WorkbenchPanelProps) {
  const [tab, setTab] = useState<Tab>('story')

  return (
    <div className="flex h-full flex-col bg-dream-50/30">
      <div className="flex border-b border-dream-200 bg-white/90 px-4 pt-3 backdrop-blur-sm">
        <TabButton active={tab === 'story'} onClick={() => setTab('story')} icon={BookOpen} label="故事线" />
        <TabButton active={tab === 'characters'} onClick={() => setTab('characters')} icon={Users} label="角色" />
        <TabButton active={tab === 'scenes'} onClick={() => setTab('scenes')} icon={ImageIcon} label="场景" />
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === 'story' && <StoryEditor onSave={onSave} />}
        {tab === 'characters' && <CharacterOverview />}
        {tab === 'scenes' && <SceneOverview />}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
        active ? 'border-dream-600 text-dream-700' : 'border-transparent text-dream-400 hover:text-dream-600'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

function StoryEditor({ onSave }: { onSave: () => void }) {
  const confirm = useConfirm()
  const { nodes, edges, setNodes, setEdges, setSelectedNodeId, updateNodeData } = useEditorStore()
  const [sceneComposerTarget, setSceneComposerTarget] = useState<SceneComposerTarget | null>(null)
  const [activeChapter, setActiveChapter] = useState('all')
  const [activeSceneGroupId, setActiveSceneGroupId] = useState('all')
  const storyItems = useMemo(() => buildStoryItems(nodes, edges), [nodes, edges])
  const chapters = useMemo(() => getChapterOptions(nodes), [nodes])
  const sceneOutline = useMemo(() => getSceneOutline(nodes, edges), [nodes, edges])
  const visibleStoryItems = useMemo(
    () => storyItems.filter((item) => {
      const chapterMatched = activeChapter === 'all' || storyItemHasChapter(item, activeChapter)
      const sceneMatched = activeSceneGroupId === 'all' || storyItemHasSceneGroup(item, activeSceneGroupId)
      return chapterMatched && sceneMatched
    }),
    [activeChapter, activeSceneGroupId, storyItems],
  )
  const flatMainNodes = storyItems.flatMap((item) => (item.kind === 'choice' ? [item.node, ...(item.merge ? [item.merge] : [])] : [item.node]))

  const updateGraph = (nextNodes: Node[], nextEdges: Edge[]) => {
    const layout = layoutNodes(nextNodes, nextEdges)
    setNodes(layout)
    setEdges(nextEdges)
  }

  const addNode = (type: string) => {
    const tail = getMainTail(storyItems, nodes)
    const newNode = createNode(type)
    const nextNodes = [...nodes, newNode]
    const nextEdges = tail && tail.type !== 'choice'
      ? [...edges, normalEdge(tail.id, newNode.id)]
      : edges
    updateGraph(nextNodes, nextEdges)
    setSelectedNodeId(newNode.id)
  }

  const insertSceneToMain = (draft: SceneDraft) => {
    const tail = getMainTail(storyItems, nodes)
    const sceneNodes = createSceneNodes(ensureSceneCode(draft, nodes, activeChapter === 'all' ? undefined : activeChapter))
    if (sceneNodes.length === 0) return
    const sceneEdges = chainEdges(sceneNodes)
    const nextEdges = tail && tail.type !== 'choice'
      ? [...edges, normalEdge(tail.id, sceneNodes[0].id), ...sceneEdges]
      : [...edges, ...sceneEdges]
    updateGraph([...nodes, ...sceneNodes], nextEdges)
    setActiveSceneGroupId(getNodeSceneGroupId(sceneNodes[0]) || 'all')
    setSelectedNodeId(sceneNodes[sceneNodes.length - 1].id)
  }

  const insertSceneToBranch = (choiceNode: Node, branch: BranchInfo, draft: SceneDraft) => {
    const sceneNodes = createSceneNodes(ensureSceneCode(draft, nodes, activeChapter === 'all' ? undefined : activeChapter))
    if (sceneNodes.length === 0) return
    const nextNodes = [...nodes, ...sceneNodes]
    const nextEdges = [...edges, ...chainEdges(sceneNodes)]

    if (!branch.start) {
      nextEdges.push(choiceEdge(choiceNode.id, sceneNodes[0].id, branch.index, branch.label))
      if (branch.merge) nextEdges.push(normalEdge(sceneNodes[sceneNodes.length - 1].id, branch.merge.id))
    } else {
      const tail = branch.chain[branch.chain.length - 1]
      if (branch.merge) {
        removeEdge(nextEdges, tail.id, branch.merge.id)
        nextEdges.push(normalEdge(tail.id, sceneNodes[0].id))
        nextEdges.push(normalEdge(sceneNodes[sceneNodes.length - 1].id, branch.merge.id))
      } else {
        nextEdges.push(normalEdge(tail.id, sceneNodes[0].id))
      }
    }

    updateGraph(nextNodes, nextEdges)
    setActiveSceneGroupId(getNodeSceneGroupId(sceneNodes[0]) || 'all')
    setSelectedNodeId(sceneNodes[sceneNodes.length - 1].id)
  }

  const handleInsertScene = (draft: SceneDraft) => {
    if (!sceneComposerTarget) return
    if (sceneComposerTarget.kind === 'main') {
      insertSceneToMain(draft)
    } else if (sceneComposerTarget.kind === 'branch') {
      insertSceneToBranch(sceneComposerTarget.choiceNode, sceneComposerTarget.branch, draft)
    } else {
      updateSceneGroup(sceneComposerTarget.sceneGroupId, draft)
    }
    setSceneComposerTarget(null)
  }

  const updateSceneGroup = (sceneGroupId: string, draft: SceneDraft) => {
    const groupNodes = nodes.filter((node) => getNodeSceneGroupId(node) === sceneGroupId)
    if (groupNodes.length === 0) return
    const replacement = createSceneNodes({ ...draft, sceneCode: draft.sceneCode || getSceneCode(groupNodes), }, sceneGroupId)
    const groupIds = new Set(groupNodes.map((node) => node.id))
    const incomingEdges = edges.filter((edge) => groupIds.has(edge.target) && !groupIds.has(edge.source))
    const outgoingEdges = edges.filter((edge) => groupIds.has(edge.source) && !groupIds.has(edge.target))
    const keptNodes = nodes.filter((node) => !groupIds.has(node.id))
    const keptEdges = edges.filter((edge) => !groupIds.has(edge.source) && !groupIds.has(edge.target))
    const nextEdges = [
      ...keptEdges,
      ...incomingEdges.map((edge) => ({ ...edge, target: replacement[0].id })),
      ...chainEdges(replacement),
      ...outgoingEdges.map((edge) => ({ ...edge, source: replacement[replacement.length - 1].id })),
    ]
    updateGraph([...keptNodes, ...replacement], nextEdges)
    setActiveSceneGroupId(sceneGroupId)
    setSelectedNodeId(replacement[replacement.length - 1].id)
  }

  const deleteSceneGroup = async (sceneGroupId: string) => {
    if (!await confirm({ message: '确定删除这个场景吗？场景里的背景、角色和文本都会删除。', danger: true })) return
    const groupIds = new Set(nodes.filter((node) => getNodeSceneGroupId(node) === sceneGroupId).map((node) => node.id))
    const nextNodes = nodes.filter((node) => !groupIds.has(node.id))
    const nextEdges = edges.filter((edge) => !groupIds.has(edge.source) && !groupIds.has(edge.target))
    updateGraph(nextNodes, nextEdges)
  }

  const moveMainNode = (nodeId: string, direction: -1 | 1) => {
    const index = flatMainNodes.findIndex((node) => node.id === nodeId)
    const targetIndex = index + direction
    if (index < 0 || targetIndex < 0 || targetIndex >= flatMainNodes.length) return
    const nextOrder = [...flatMainNodes]
    const [item] = nextOrder.splice(index, 1)
    nextOrder.splice(targetIndex, 0, item)
    const mainEdges = nextOrder.slice(0, -1).map((node, itemIndex) => normalEdge(node.id, nextOrder[itemIndex + 1].id, `main-${node.id}-${nextOrder[itemIndex + 1].id}`))
    const branchEdges = edges.filter((edge) => edge.sourceHandle?.startsWith('choice-') || isBranchInternalEdge(edge, storyItems))
    updateGraph(nodes, [...branchEdges, ...mainEdges])
  }

  const deleteNode = async (nodeId: string) => {
    if (!await confirm({ message: '确定删除这个节点吗？相关连线也会删除。', danger: true })) return
    const nextNodes = nodes.filter((node) => node.id !== nodeId)
    const nextEdges = edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
    updateGraph(nextNodes, nextEdges)
  }

  const createChoiceBranches = (choiceNode: Node) => {
    const choices = getChoices(choiceNode)
    if (choices.length === 0) return
    const existing = getChoiceBranches(choiceNode, nodes, edges)
    const timestamp = Date.now()
    const branchNodes: Node[] = []
    const branchEdges: Edge[] = []

    choices.forEach((choice, index) => {
      const exists = existing[index]?.start
      if (exists) return
      const branchNode = {
        id: `branch-${choiceNode.id}-${index}-${timestamp}`,
        type: 'dialogue',
        position: { x: choiceNode.position.x + 380, y: choiceNode.position.y + index * 190 },
        data: { role: '旁白', text: `沿着“${choice}”继续写这一支。` },
      }
      branchNodes.push(branchNode)
      branchEdges.push(choiceEdge(choiceNode.id, branchNode.id, index, choice))
    })

    const nextEdges = [
      ...edges.filter((edge) => !(edge.source === choiceNode.id && !edge.sourceHandle)),
      ...branchEdges,
    ]
    updateGraph([...nodes, ...branchNodes], nextEdges)
  }

  const addMergePoint = (choiceNode: Node) => {
    const branches = getChoiceBranches(choiceNode, nodes, edges)
    const existingMerge = findCommonMerge(branches)
    if (existingMerge) {
      setSelectedNodeId(existingMerge.id)
      return
    }

    const mergeNode: Node = {
      id: `merge-${choiceNode.id}-${Date.now()}`,
      type: 'subtitle',
      position: { x: choiceNode.position.x + 760, y: choiceNode.position.y },
      data: { text: '分支在这里汇合，继续进入下一段主线。', position: 'bottom', duration: 0 },
    }
    const mergeEdges = branches
      .filter((branch) => branch.chain.length > 0)
      .map((branch) => normalEdge(branch.chain[branch.chain.length - 1].id, mergeNode.id))

    updateGraph([...nodes, mergeNode], [...edges, ...mergeEdges])
    setSelectedNodeId(mergeNode.id)
  }

  const addNodeToBranch = (choiceNode: Node, branch: BranchInfo, type: string) => {
    const newNode = createNode(type, {
      role: type === 'dialogue' ? '旁白' : undefined,
      text: type === 'dialogue' || type === 'subtitle' ? `继续写“${branch.label}”这条分支。` : undefined,
      choices: type === 'choice' ? [`继续${branch.label}`, `反转${branch.label}`] : undefined,
    })
    const nextNodes = [...nodes, newNode]
    const nextEdges = [...edges]

    if (!branch.start) {
      nextEdges.push(choiceEdge(choiceNode.id, newNode.id, branch.index, branch.label))
      if (branch.merge) nextEdges.push(normalEdge(newNode.id, branch.merge.id))
    } else {
      const tail = branch.chain[branch.chain.length - 1]
      if (branch.merge) {
        removeEdge(nextEdges, tail.id, branch.merge.id)
        nextEdges.push(normalEdge(tail.id, newNode.id))
        nextEdges.push(normalEdge(newNode.id, branch.merge.id))
      } else {
        nextEdges.push(normalEdge(tail.id, newNode.id))
      }
    }

    updateGraph(nextNodes, nextEdges)
    setSelectedNodeId(newNode.id)
  }

  const addChoice = (choiceNode: Node) => {
    const choices = [...getChoices(choiceNode), `新选项 ${getChoices(choiceNode).length + 1}`]
    updateNodeData(choiceNode.id, { choices })
  }

  const deleteChoiceFromNode = (choiceNode: Node, choiceIndex: number) => {
    const choices = getChoices(choiceNode)
    const nextChoices = choices.filter((_, index) => index !== choiceIndex)
    const branches = getChoiceBranches(choiceNode, nodes, edges)
    const removedBranchIds = new Set(branches[choiceIndex]?.chain.map((node) => node.id) || [])
    const nextNodes = nodes
      .filter((node) => !removedBranchIds.has(node.id))
      .map((node) => node.id === choiceNode.id
        ? { ...node, data: { ...node.data, choices: nextChoices.length > 0 ? nextChoices : ['继续'] } }
        : node)
    const nextEdges = edges
      .filter((edge) => !removedBranchIds.has(edge.source) && !removedBranchIds.has(edge.target))
      .filter((edge) => !(edge.source === choiceNode.id && edge.sourceHandle === `choice-${choiceIndex}`))
      .map((edge) => {
        if (edge.source !== choiceNode.id || !edge.sourceHandle?.startsWith('choice-')) return edge
        const index = Number(edge.sourceHandle.replace('choice-', ''))
        if (index <= choiceIndex) return edge
        const nextIndex = index - 1
        return {
          ...edge,
          id: `e-${choiceNode.id}-${edge.target}`,
          sourceHandle: `choice-${nextIndex}`,
          label: nextChoices[nextIndex] || edge.label,
        }
      })
    updateGraph(nextNodes, nextEdges)
  }

  const createOpeningTemplate = () => {
    const stamp = Date.now()
    const openingNodes: Node[] = [
      {
        id: `tpl-bg-${stamp}`,
        type: 'background',
        position: { x: 260, y: 120 },
        data: { backgroundId: '/assets/backgrounds/bg-sakura.png' },
      },
      {
        id: `tpl-yuki-${stamp}`,
        type: 'character',
        position: { x: 260, y: 260 },
        data: { characterId: 'yuki', action: 'show', expression: 'normal', position: 'left' },
      },
      {
        id: `tpl-opening-${stamp}`,
        type: 'subtitle',
        position: { x: 260, y: 400 },
        data: { text: '樱花坡道上，雪第一次看见了只有自己能触碰的发光节点。', position: 'bottom', duration: 0 },
      },
      {
        id: `tpl-choice-${stamp}`,
        type: 'choice',
        position: { x: 260, y: 540 },
        data: { choices: ['追问影的真实身份', '先去找宫确认现实'] },
      },
      {
        id: `tpl-branch-shadow-${stamp}`,
        type: 'dialogue',
        position: { x: 650, y: 690 },
        data: { role: 'ren', text: '影低声说：“你看到的不是幻觉，是被删掉的世界还在呼吸。”' },
      },
      {
        id: `tpl-branch-miya-${stamp}`,
        type: 'dialogue',
        position: { x: 980, y: 690 },
        data: { role: 'miya', text: '宫握着便签，困惑地看向雪：“我不知道为什么写下这句话，但它好像是给你的。”' },
      },
    ]
    const openingEdges: Edge[] = [
      normalEdge(openingNodes[0].id, openingNodes[1].id),
      normalEdge(openingNodes[1].id, openingNodes[2].id),
      normalEdge(openingNodes[2].id, openingNodes[3].id),
      choiceEdge(openingNodes[3].id, openingNodes[4].id, 0, '追问影的真实身份'),
      choiceEdge(openingNodes[3].id, openingNodes[5].id, 1, '先去找宫确认现实'),
    ]
    updateGraph(openingNodes, openingEdges)
    setSelectedNodeId(openingNodes[2].id)
  }

  const updateChoiceNode = (choiceNode: Node, data: Record<string, unknown>) => {
    updateNodeData(choiceNode.id, data)
    if (!Array.isArray(data.choices)) return
    const choices = data.choices.map((choice) => String(choice))
    const nextEdges = edges.filter((edge) => {
      if (edge.source !== choiceNode.id || !edge.sourceHandle?.startsWith('choice-')) return true
      const index = Number(edge.sourceHandle.replace('choice-', ''))
      return index < choices.length
    }).map((edge) => {
      if (edge.source !== choiceNode.id || !edge.sourceHandle?.startsWith('choice-')) return edge
      const index = Number(edge.sourceHandle.replace('choice-', ''))
      return { ...edge, label: choices[index] || edge.label }
    })
    setEdges(nextEdges)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dream-900">故事工作台</h2>
          <p className="text-xs text-dream-500">主线向下写。遇到选项后，每个选项会展开独立分支列，可以在对应分支下面继续新增剧情。</p>
        </div>
        <button onClick={onSave} className="inline-flex items-center gap-1.5 rounded-lg bg-dream-600 px-4 py-2 text-sm font-medium text-white hover:bg-dream-700">
          <Save className="h-4 w-4" />
          保存
        </button>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <GuidePill title="1. 主线" text="对话、旁白、背景和角色节点按阅读顺序向下排列。" />
        <GuidePill title="2. 分支" text="选项不会默认汇合，玩家选哪项就进入哪条分支。" />
        <GuidePill title="3. 合流" text="剧情需要重新回到同一主线时，再给这个选项添加汇合点。" />
      </div>

      <ChapterNavigator
        chapters={chapters}
        activeChapter={activeChapter}
        onChange={(chapter) => {
          setActiveChapter(chapter)
          setActiveSceneGroupId('all')
        }}
      />

      <SceneOutline
        scenes={sceneOutline.filter((scene) => activeChapter === 'all' || scene.chapter === activeChapter)}
        activeSceneGroupId={activeSceneGroupId}
        onChange={setActiveSceneGroupId}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {nodes.length === 0 && (
          <button
            onClick={createOpeningTemplate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-dream-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-dream-700"
          >
            <Plus className="h-3.5 w-3.5" />
            套入开场模板
          </button>
        )}
        <button
          onClick={() => setSceneComposerTarget({ kind: 'main' })}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dream-200 bg-white px-3 py-1.5 text-xs font-medium text-dream-700 hover:bg-dream-50"
        >
          <Plus className="h-3.5 w-3.5" />
          <ImageIcon className="h-3.5 w-3.5" />
          场景
        </button>
        {QUICK_TYPES.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.type}
              onClick={() => addNode(item.type)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dream-200 bg-white px-3 py-1.5 text-xs font-medium text-dream-700 hover:bg-dream-50"
            >
              <Plus className="h-3.5 w-3.5" />
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          )
        })}
      </div>

      {nodes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-dream-200 bg-white/70 p-12 text-center">
          <h3 className="text-base font-semibold text-dream-900">还没有故事节点</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-dream-500">
            可以从一个空白对话开始，也可以套入 DreamChord 开场模板：背景、角色登场、旁白、选项和两条独立分支会一次生成。
          </p>
          <button
            onClick={createOpeningTemplate}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-dream-600 px-4 py-2 text-sm font-medium text-white hover:bg-dream-700"
          >
            <Plus className="h-4 w-4" />
            套入开场模板
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleStoryItems.length === 0 && (
            <div className="rounded-2xl border border-dashed border-dream-200 bg-white/70 p-10 text-center">
              <h3 className="text-sm font-semibold text-dream-900">这一章还没有场景</h3>
              <p className="mt-2 text-sm text-dream-500">点击上方“场景”，会按当前章节自动生成新的场景编号。</p>
            </div>
          )}
          {visibleStoryItems.map((item, index) => {
            if (item.kind !== 'choice') {
              const sceneGroupId = getNodeSceneGroupId(item.node)
              const previousInSameScene = sceneGroupId && edges.some((edge) => {
                if (edge.target !== item.node.id) return false
                const source = nodes.find((node) => node.id === edge.source)
                return source && getNodeSceneGroupId(source) === sceneGroupId
              })
              if (sceneGroupId && previousInSameScene) return null
              if (sceneGroupId) {
                const sceneNodes = getSceneGroupNodes(item.node, nodes, edges)
                return (
                  <SceneCard
                    key={sceneGroupId}
                    sceneNodes={sceneNodes}
                    index={index}
                    onEdit={() => setSceneComposerTarget({ kind: 'edit', sceneGroupId })}
                    onDelete={() => deleteSceneGroup(sceneGroupId)}
                  />
                )
              }
            }

            return item.kind === 'choice' ? (
              <ChoiceWorkbench
                key={item.node.id}
                node={item.node}
                branches={item.branches}
                merge={item.merge}
                index={index}
                allNodes={nodes}
                edges={edges}
                onJumpToScene={(choiceIndex, targetNodeId) => {
                  const choices = getChoices(item.node)
                  const label = choices[choiceIndex] || `选项 ${choiceIndex + 1}`
                  const nextEdges = [
                    ...edges.filter((edge) => !(edge.source === item.node.id && edge.sourceHandle === `choice-${choiceIndex}`)),
                    choiceEdge(item.node.id, targetNodeId, choiceIndex, label),
                  ]
                  updateGraph(nodes, nextEdges)
                }}
                onSelect={() => setSelectedNodeId(item.node.id)}
                onDelete={() => deleteNode(item.node.id)}
                onUpdate={(data) => updateChoiceNode(item.node, data)}
                onDeleteChoice={(choiceIndex) => deleteChoiceFromNode(item.node, choiceIndex)}
                onCreateBranches={() => createChoiceBranches(item.node)}
                onAddMerge={() => addMergePoint(item.node)}
                onAddChoice={() => addChoice(item.node)}
                onAddBranchNode={(branch, type) => addNodeToBranch(item.node, branch, type)}
                onAddBranchScene={(branch) => setSceneComposerTarget({ kind: 'branch', choiceNode: item.node, branch })}
                onSelectNode={setSelectedNodeId}
                onDeleteNode={deleteNode}
                onUpdateNode={updateNodeData}
              />
            ) : (
              <BeatCard
                key={item.node.id}
                node={item.node}
                index={index}
                total={visibleStoryItems.length}
                onSelect={() => setSelectedNodeId(item.node.id)}
                onMoveUp={() => moveMainNode(item.node.id, -1)}
                onMoveDown={() => moveMainNode(item.node.id, 1)}
                onDelete={() => deleteNode(item.node.id)}
                onUpdate={(data) => updateNodeData(item.node.id, data)}
              />
            )
          })}
        </div>
      )}
      {sceneComposerTarget && (
        <SceneComposerModal
          title={
            sceneComposerTarget.kind === 'main'
              ? '添加主线场景'
              : sceneComposerTarget.kind === 'branch'
                ? `添加“${sceneComposerTarget.branch.label}”分支场景`
                : '编辑场景'
          }
          initialDraft={sceneComposerTarget.kind === 'edit' ? draftFromSceneNodes(nodes.filter((node) => getNodeSceneGroupId(node) === sceneComposerTarget.sceneGroupId)) : undefined}
          onCancel={() => setSceneComposerTarget(null)}
          onConfirm={handleInsertScene}
        />
      )}
    </div>
  )
}

function GuidePill({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-dream-100 bg-white/80 px-3 py-2 shadow-sm">
      <p className="text-xs font-semibold text-dream-800">{title}</p>
      <p className="mt-1 text-[11px] leading-5 text-dream-500">{text}</p>
    </div>
  )
}

function ChapterNavigator({
  chapters,
  activeChapter,
  onChange,
}: {
  chapters: Array<{ id: string; label: string; count: number }>
  activeChapter: string
  onChange: (chapter: string) => void
}) {
  return (
    <div className="mb-5 rounded-2xl border border-dream-100 bg-white/85 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-dream-900">章节画布</p>
          <p className="text-xs text-dream-500">用场景编号分章：第一章写 1-1、1-2；第二章写 2-1、2-2。跨章时在节点图里连线即可。</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onChange('all')}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            activeChapter === 'all'
              ? 'border-dream-500 bg-dream-600 text-white'
              : 'border-dream-200 bg-white text-dream-700 hover:bg-dream-50'
          }`}
        >
          全篇
        </button>
        {chapters.map((chapter) => (
          <button
            key={chapter.id}
            onClick={() => onChange(chapter.id)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              activeChapter === chapter.id
                ? 'border-dream-500 bg-dream-600 text-white'
                : 'border-dream-200 bg-white text-dream-700 hover:bg-dream-50'
            }`}
          >
            {chapter.label} · {chapter.count} 场
          </button>
        ))}
      </div>
    </div>
  )
}

function SceneOutline({
  scenes,
  activeSceneGroupId,
  onChange,
}: {
  scenes: Array<{ sceneGroupId: string; code: string; chapter: string; lensType: LensType; title: string; characterCount: number; preview: string }>
  activeSceneGroupId: string
  onChange: (sceneGroupId: string) => void
}) {
  return (
    <div className="mb-5 rounded-2xl border border-cyan-100 bg-white/85 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-dream-900">场景索引</p>
          <p className="text-xs text-dream-500">长篇剧情按场景管理。点一个场景后，只编辑这一场的镜头卡和相关分支。</p>
        </div>
        <button
          onClick={() => onChange('all')}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
            activeSceneGroupId === 'all'
              ? 'border-cyan-500 bg-cyan-500 text-white'
              : 'border-cyan-100 bg-white text-cyan-700 hover:bg-cyan-50'
          }`}
        >
          全部场景
        </button>
      </div>
      {scenes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-cyan-100 bg-cyan-50/40 px-3 py-4 text-center text-xs text-cyan-600">
          当前章节还没有镜头卡。点击上方“场景”开始写第一场。
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {scenes.map((scene) => (
            <button
              key={scene.sceneGroupId}
              onClick={() => onChange(scene.sceneGroupId)}
              className={`rounded-xl border px-3 py-2 text-left transition ${
                activeSceneGroupId === scene.sceneGroupId
                  ? 'border-cyan-400 bg-cyan-50 text-cyan-900'
                  : 'border-cyan-100 bg-white text-slate-700 hover:bg-cyan-50/60'
              }`}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-700">{scene.code}</span>
                <span className="rounded-full bg-dream-50 px-2 py-0.5 text-[11px] font-semibold text-dream-700">{LENS_LABEL[scene.lensType]}</span>
                <span className="text-[11px] text-slate-400">{scene.characterCount} 角色</span>
              </div>
              <p className="truncate text-sm font-medium">{scene.title}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{scene.preview || '暂无文本'}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ChoiceWorkbench({
  node,
  branches,
  merge,
  index,
  allNodes,
  edges,
  onJumpToScene,
  onDeleteChoice,
  onSelect,
  onDelete,
  onUpdate,
  onCreateBranches,
  onAddMerge,
  onAddChoice,
  onAddBranchNode,
  onAddBranchScene,
  onSelectNode,
  onDeleteNode,
  onUpdateNode,
}: {
  node: Node
  branches: BranchInfo[]
  merge?: Node
  index: number
  allNodes: Node[]
  edges: Edge[]
  onJumpToScene: (choiceIndex: number, targetNodeId: string) => void
  onDeleteChoice: (choiceIndex: number) => void
  onSelect: () => void
  onDelete: () => void
  onUpdate: (data: Record<string, unknown>) => void
  onCreateBranches: () => void
  onAddMerge: () => void
  onAddChoice: () => void
  onAddBranchNode: (branch: BranchInfo, type: string) => void
  onAddBranchScene: (branch: BranchInfo) => void
  onSelectNode: (id: string) => void
  onDeleteNode: (id: string) => void
  onUpdateNode: (id: string, data: Record<string, unknown>) => void
}) {
  const choices = getChoices(node)
  const connected = branches.filter((branch) => branch.start).length
  const sceneOptions = getSceneOptions(allNodes, edges)
  const sceneLabelByNodeId = new Map(sceneOptions.map((scene) => [scene.nodeId, scene.label]))

  return (
    <section className="rounded-2xl border border-pink-100 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <button onClick={onSelect} className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-100 text-xs font-mono text-pink-700">
          {index + 1}
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-pink-50 px-2 py-0.5 text-xs font-medium text-pink-700">选项分支</span>
            <span className="text-xs text-pink-600">{connected}/{choices.length} 个出口已连接</span>
          </div>
          <EditableSummary node={node} onUpdate={onUpdate} onDeleteChoice={onDeleteChoice} />
          <div className="mt-3 grid gap-2">
            {choices.map((choice, choiceIndex) => {
              const connectedEdge = edges.find((edge) => edge.source === node.id && edge.sourceHandle === `choice-${choiceIndex}`)
              const branch = branches[choiceIndex] || { index: choiceIndex, label: choice, chain: [] }
              const connectedLabel = connectedEdge?.target
                ? sceneLabelByNodeId.get(connectedEdge.target) || getNodeDisplayLabel(allNodes.find((item) => item.id === connectedEdge.target))
                : ''
              return (
                <div key={`${choice}-${choiceIndex}`} className="rounded-xl border border-pink-100 bg-pink-50/55 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-pink-700">{choiceIndex + 1}. {choice || '未命名选项'}</p>
                      <p className="mt-0.5 text-[11px] text-pink-500">
                        {connectedLabel ? `当前出口：${connectedLabel}` : '当前出口：还没有连接，玩家选到这里会中断。'}
                      </p>
                    </div>
                    <button
                      onClick={() => onAddBranchScene(branch)}
                      className="rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-pink-700"
                    >
                      顺着这条写
                    </button>
                  </div>
                  <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                    <select
                      value={connectedEdge?.target || ''}
                      onChange={(event) => event.target.value && onJumpToScene(choiceIndex, event.target.value)}
                      className="w-full rounded-md border border-pink-100 bg-white px-2 py-1.5 text-xs text-pink-700"
                    >
                      <option value="">跳转到已有场景...</option>
                      {sceneOptions.map((scene) => (
                        <option key={scene.nodeId} value={scene.nodeId}>{scene.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => onSelectNode(connectedEdge?.target || node.id)}
                      className="rounded-md border border-pink-100 bg-white px-3 py-1.5 text-xs text-pink-700 hover:bg-pink-50"
                    >
                      定位
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={onCreateBranches} className="rounded-lg border border-pink-200 px-3 py-1.5 text-xs text-pink-700 hover:bg-pink-50">
              生成/补齐独立分支
            </button>
            <button onClick={onAddMerge} className="rounded-lg border border-dream-200 px-3 py-1.5 text-xs text-dream-700 hover:bg-dream-50">
              添加汇合点
            </button>
            <button onClick={onAddChoice} className="rounded-lg border border-dream-200 px-3 py-1.5 text-xs text-dream-700 hover:bg-dream-50">
              添加选项
            </button>
          </div>
        </div>
        <button onClick={onDelete} className="rounded p-1 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[760px] gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(branches.length, 1)}, minmax(230px, 1fr))` }}>
          {branches.map((branch) => (
            <div key={`${node.id}-${branch.index}`} className="rounded-xl border border-pink-100 bg-pink-50/45 p-3">
              <div className="mb-3 rounded-lg bg-white px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-pink-700">{branch.index + 1}. {branch.label}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    branch.chain.length > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-pink-50 text-pink-500'
                  }`}>
                    {branch.chain.length > 0 ? `${branch.chain.length} 节点` : '待续写'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  {merge ? '这条分支写完后会进入汇合点。' : '这条分支会独立发展，直到你手动接到汇合点或其他场景。'}
                </p>
              </div>
              <div className="space-y-2">
                {branch.chain.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-pink-200 bg-white/70 p-4 text-center text-xs text-pink-500">
                    这一支还没有剧情。
                  </div>
                ) : (
                  branch.chain.map((branchNode, branchIndex) => (
                    <MiniBeatCard
                      key={branchNode.id}
                      node={branchNode}
                      index={branchIndex}
                      onSelect={() => onSelectNode(branchNode.id)}
                      onDelete={() => onDeleteNode(branchNode.id)}
                      onUpdate={(data) => onUpdateNode(branchNode.id, data)}
                    />
                  ))
                )}
              </div>
              <div className="mt-3 rounded-lg border border-pink-100 bg-white/75 p-2">
                <p className="mb-2 text-[11px] font-medium text-pink-500">继续这一支</p>
                <div className="grid grid-cols-6 gap-1.5">
                  <button
                    onClick={() => onAddBranchScene(branch)}
                    className="flex flex-col items-center gap-1 rounded-md border border-pink-100 bg-white px-1.5 py-1.5 text-[11px] text-pink-700 hover:bg-pink-50"
                    title="添加场景"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    场景
                  </button>
                  {BRANCH_TYPES.map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={item.type}
                        onClick={() => onAddBranchNode(branch, item.type)}
                        className="flex flex-col items-center gap-1 rounded-md border border-pink-100 bg-white px-1.5 py-1.5 text-[11px] text-pink-700 hover:bg-pink-50"
                        title={`添加${item.label}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {merge && (
        <div className="mt-4 border-t border-dream-100 pt-4">
          <p className="mb-2 text-xs font-medium text-dream-500">这些分支在这里汇合，之后继续同一条主线</p>
          <MiniBeatCard
            node={merge}
            index={0}
            onSelect={() => onSelectNode(merge.id)}
            onDelete={() => onDeleteNode(merge.id)}
            onUpdate={(data) => onUpdateNode(merge.id, data)}
          />
        </div>
      )}
      {!merge && (
        <div className="mt-4 rounded-lg border border-dashed border-pink-200 bg-pink-50/40 px-3 py-2 text-xs leading-5 text-pink-600">
          当前是独立分支结构：玩家选择哪一项，就沿着对应分支一直往下读。需要合流时再点击“添加汇合点”。
        </div>
      )}
    </section>
  )
}

function BeatCard({
  node,
  index,
  total,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDelete,
  onUpdate,
}: {
  node: Node
  index: number
  total: number
  onSelect: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  onUpdate: (data: Record<string, unknown>) => void
}) {
  return (
    <div className="rounded-xl border border-dream-100 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <button onClick={onSelect} className="flex h-8 w-8 items-center justify-center rounded-lg bg-dream-100 text-xs font-mono text-dream-700">
          {index + 1}
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-full bg-dream-50 px-2 py-0.5 text-xs font-medium text-dream-700">{NODE_LABEL[node.type || 'dialogue'] || node.type}</span>
          </div>
          <EditableSummary node={node} onUpdate={onUpdate} />
        </div>
        <div className="flex items-center gap-1">
          <button disabled={index === 0} onClick={onMoveUp} className="rounded p-1 text-dream-500 hover:bg-dream-50 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
          <button disabled={index === total - 1} onClick={onMoveDown} className="rounded p-1 text-dream-500 hover:bg-dream-50 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
          <button onClick={onDelete} className="rounded p-1 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  )
}

function MiniBeatCard({
  node,
  index,
  onSelect,
  onDelete,
  onUpdate,
}: {
  node: Node
  index: number
  onSelect: () => void
  onDelete: () => void
  onUpdate: (data: Record<string, unknown>) => void
}) {
  return (
    <div className="rounded-lg border border-dream-100 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button onClick={onSelect} className="rounded-md bg-dream-50 px-2 py-1 text-xs font-medium text-dream-700">
          {index + 1}. {NODE_LABEL[node.type || 'dialogue'] || node.type}
        </button>
        <button onClick={onDelete} className="rounded p-1 text-red-500 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      <EditableSummary node={node} onUpdate={onUpdate} />
    </div>
  )
}

function SceneCard({
  sceneNodes,
  index,
  onEdit,
  onDelete,
}: {
  sceneNodes: Node[]
  index: number
  onEdit: () => void
  onDelete: () => void
}) {
  const draft = draftFromSceneNodes(sceneNodes)
  const scenes = loadLibraryScenes()
  const characters = loadLibraryCharacters()
  const scene = scenes.find((item) => item.url === draft.backgroundId || item.id === draft.backgroundId)
  const speaker = draft.speakerRole === '旁白'
    ? '旁白'
    : characters.find((character) => character.id === draft.speakerRole)?.name || draft.speakerRole

  return (
    <section className="rounded-xl border border-cyan-100 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <button onClick={onEdit} className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-100 text-xs font-mono text-cyan-700">
          {index + 1}
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-700">场景 {draft.sceneCode}</span>
            <span className="rounded-full bg-dream-50 px-2 py-0.5 text-xs font-medium text-dream-700">{LENS_LABEL[draft.lensType]}</span>
            <span className="text-xs text-cyan-600">{scene?.name || '未命名背景'}</span>
            <span className="text-xs text-cyan-500">{draft.characters.length} 个角色</span>
          </div>
          <div className="grid gap-3 md:grid-cols-[140px_1fr]">
            <div className="overflow-hidden rounded-lg border border-cyan-100 bg-slate-50">
              <img src={draft.backgroundId} alt={scene?.name || '场景背景'} className="h-20 w-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-xs text-cyan-600">
                角色：{draft.characters.map((item) => {
                  const character = characters.find((candidate) => candidate.id === item.characterId)
                  return `${character?.name || item.characterId}/${item.expression}/${positionLabel(item.position)}`
                }).join('、') || '无'}
              </p>
              <p className="rounded-lg border border-cyan-100 bg-cyan-50/40 px-3 py-2 text-sm leading-6 text-slate-700">
                <span className="font-semibold text-cyan-800">{draft.lensType === 'narration' || draft.lensType === 'memory' || draft.lensType === 'system' ? LENS_LABEL[draft.lensType] : speaker}：</span>
                {draft.text || '暂无文本'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="rounded-lg border border-cyan-100 px-3 py-1.5 text-xs text-cyan-700 hover:bg-cyan-50">编辑</button>
          <button onClick={onDelete} className="rounded p-1 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
    </section>
  )
}

function EditableSummary({
  node,
  onUpdate,
  onDeleteChoice,
}: {
  node: Node
  onUpdate: (data: Record<string, unknown>) => void
  onDeleteChoice?: (index: number) => void
}) {
  const data = getNodeData(node)
  const libraryCharacters = loadLibraryCharacters()
  const libraryScenes = loadLibraryScenes()
  if (node.type === 'choice') {
    const choices = getChoices(node)
    return (
      <div className="space-y-2">
        {choices.map((choice, index) => (
          <div key={`choice-${index}`} className="flex gap-2">
            <input
              value={choice}
              onChange={(event) => {
                const next = [...choices]
                next[index] = event.target.value
                onUpdate({ choices: next })
              }}
              className="min-w-0 flex-1 rounded-lg border border-dream-200 px-3 py-1.5 text-sm focus:border-dream-500 focus:outline-none"
            />
            {onDeleteChoice && choices.length > 1 && (
              <button
                onClick={() => onDeleteChoice(index)}
                className="rounded-lg border border-red-100 px-2 text-red-500 hover:bg-red-50"
                title="删除选项"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    )
  }
  if (node.type === 'dialogue') {
    return (
      <div className="grid gap-2 md:grid-cols-[120px_1fr]">
        <select value={String(data.role || '')} onChange={(event) => onUpdate({ role: event.target.value })} className="rounded-lg border border-dream-200 px-3 py-1.5 text-sm">
          <option value="旁白">旁白</option>
          {libraryCharacters.map((character) => (
            <option key={character.id} value={character.id}>{character.name}</option>
          ))}
        </select>
        <input value={String(data.text || '')} onChange={(event) => onUpdate({ text: event.target.value })} className="rounded-lg border border-dream-200 px-3 py-1.5 text-sm" />
      </div>
    )
  }
  if (node.type === 'subtitle') {
    return <input value={String(data.text || '')} onChange={(event) => onUpdate({ text: event.target.value })} className="w-full rounded-lg border border-dream-200 px-3 py-1.5 text-sm" />
  }
  if (node.type === 'background') {
    return (
      <select value={String(data.backgroundId || '')} onChange={(event) => onUpdate({ backgroundId: event.target.value })} className="w-full rounded-lg border border-dream-200 px-3 py-1.5 text-sm">
        {libraryScenes.map((scene) => (
          <option key={scene.id} value={scene.url}>{scene.name}</option>
        ))}
      </select>
    )
  }
  if (node.type === 'character') {
    const activeCharacter = libraryCharacters.find((character) => character.id === data.characterId)
    return (
      <div className="grid gap-2 md:grid-cols-3">
        <select value={String(data.characterId || '')} onChange={(event) => {
          const character = libraryCharacters.find((item) => item.id === event.target.value)
          onUpdate({ characterId: event.target.value, expression: character?.defaultExpression || 'normal' })
        }} className="rounded-lg border border-dream-200 px-3 py-1.5 text-sm">
          {libraryCharacters.map((character) => (
            <option key={character.id} value={character.id}>{character.name}</option>
          ))}
        </select>
        <select value={String(data.expression || activeCharacter?.defaultExpression || 'normal')} onChange={(event) => onUpdate({ expression: event.target.value })} className="rounded-lg border border-dream-200 px-3 py-1.5 text-sm">
          {(activeCharacter?.expressions || [{ id: 'normal', label: 'normal' }]).map((expression) => (
            <option key={expression.id} value={expression.id}>{expression.label}</option>
          ))}
        </select>
        <select value={String(data.position || 'center')} onChange={(event) => onUpdate({ position: event.target.value })} className="rounded-lg border border-dream-200 px-3 py-1.5 text-sm">
          <option value="left">左</option>
          <option value="center">中</option>
          <option value="right">右</option>
        </select>
      </div>
    )
  }
  return <p className="text-sm text-dream-500">{JSON.stringify(data)}</p>
}

function SceneComposerModal({
  title,
  initialDraft,
  onCancel,
  onConfirm,
}: {
  title: string
  initialDraft?: SceneDraft
  onCancel: () => void
  onConfirm: (draft: SceneDraft) => void
}) {
  const scenes = loadLibraryScenes()
  const characters = loadLibraryCharacters()
  const firstCharacter = characters[0]
  const [draft, setDraft] = useState<SceneDraft>(() => ({
    sceneCode: initialDraft?.sceneCode || '',
    lensType: initialDraft?.lensType || 'dialogue',
    backgroundId: scenes[0]?.url || '/assets/backgrounds/bg-classroom.png',
    characters: firstCharacter
      ? [{ characterId: firstCharacter.id, expression: firstCharacter.defaultExpression, position: 'left', action: 'show' }]
      : [],
    speakerRole: firstCharacter?.id || '旁白',
    speakerExpression: firstCharacter?.defaultExpression || 'normal',
    speakerPosition: 'left',
    autoStageSpeaker: true,
    text: '这一幕发生了新的变化。',
    ...initialDraft,
  }))

  const updateCharacter = (index: number, patch: Partial<SceneCharacterDraft>) => {
    setDraft((current) => ({
      ...current,
      characters: current.characters.map((character, itemIndex) => {
        if (itemIndex !== index) return character
        const next = { ...character, ...patch }
        if (patch.characterId) {
          const libraryCharacter = characters.find((item) => item.id === patch.characterId)
          next.expression = libraryCharacter?.defaultExpression || 'normal'
        }
        return next
      }),
    }))
  }

  const addCharacter = () => {
    if (!firstCharacter) return
    const usedPositions = new Set(draft.characters.map((character) => character.position))
    const position = (['left', 'center', 'right'].find((item) => !usedPositions.has(item as SceneCharacterDraft['position'])) || 'center') as SceneCharacterDraft['position']
    setDraft((current) => ({
      ...current,
      characters: [
        ...current.characters,
        {
          characterId: firstCharacter.id,
          expression: firstCharacter.defaultExpression,
          position,
        },
      ],
    }))
  }

  const removeCharacter = (index: number) => {
    setDraft((current) => ({
      ...current,
      characters: current.characters.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  const canSubmit = Boolean(draft.backgroundId && draft.text.trim())
  const speakerCharacter = characters.find((item) => item.id === draft.speakerRole)
  const isCharacterLens = draft.lensType === 'dialogue' || draft.lensType === 'thought'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm">
      <section className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-xl border border-dream-100 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-dream-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-dream-600">镜头卡</p>
            <h2 className="text-xl font-bold text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">一次写清楚背景、角色、立绘状态和文本类型，系统会自动生成可预览节点。</p>
          </div>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" title="关闭">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid max-h-[calc(88vh-140px)] gap-5 overflow-y-auto p-5 md:grid-cols-[1fr_230px]">
          <div className="space-y-5">
            <section>
              <p className="mb-2 text-xs font-medium text-dream-700">镜头类型</p>
              <div className="grid gap-2 md:grid-cols-5">
                {LENS_TYPES.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setDraft((current) => ({
                      ...current,
                      lensType: item.id,
                      speakerRole: item.id === 'narration' || item.id === 'memory' ? '旁白' : current.speakerRole,
                    }))}
                    className={`rounded-lg border px-2.5 py-2 text-left transition ${
                      draft.lensType === item.id
                        ? 'border-dream-500 bg-dream-50 text-dream-800'
                        : 'border-dream-100 bg-white text-slate-600 hover:bg-dream-50/60'
                    }`}
                  >
                    <span className="block text-xs font-semibold">{item.label}</span>
                    <span className="mt-1 block text-[10px] leading-4 opacity-70">{item.desc}</span>
                  </button>
                ))}
              </div>
            </section>

            <div className="grid gap-3 md:grid-cols-[160px_1fr]">
              <FieldBlock label="场景编号">
                <input
                  value={draft.sceneCode}
                  onChange={(event) => setDraft((current) => ({ ...current, sceneCode: event.target.value }))}
                  placeholder="例如 2-8"
                  className={sceneControlClass}
                />
              </FieldBlock>
              <FieldBlock label="背景">
                <select
                  value={draft.backgroundId}
                  onChange={(event) => setDraft((current) => ({ ...current, backgroundId: event.target.value }))}
                  className={sceneControlClass}
                >
                  {scenes.map((scene) => (
                    <option key={scene.id} value={scene.url}>{scene.name} · {scene.type}</option>
                  ))}
                </select>
              </FieldBlock>
            </div>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium text-dream-700">出现角色</label>
                <button onClick={addCharacter} className="inline-flex items-center gap-1 rounded-lg border border-dream-200 px-2.5 py-1 text-xs text-dream-700 hover:bg-dream-50">
                  <Plus className="h-3.5 w-3.5" />
                  添加角色
                </button>
              </div>
              <div className="space-y-2">
                {draft.characters.map((character, index) => {
                  const activeCharacter = characters.find((item) => item.id === character.characterId) || firstCharacter
                  return (
                    <div key={`${character.characterId}-${index}`} className="grid gap-2 rounded-lg border border-dream-100 bg-dream-50/45 p-3 md:grid-cols-[1fr_1fr_88px_88px_32px]">
                      <select
                        value={character.characterId}
                        onChange={(event) => updateCharacter(index, { characterId: event.target.value })}
                        className={sceneControlClass}
                      >
                        {characters.map((item) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                      <select
                        value={character.expression}
                        onChange={(event) => updateCharacter(index, { expression: event.target.value })}
                        className={sceneControlClass}
                      >
                        <option value="__random">随机表情</option>
                        {(activeCharacter?.expressions || []).map((expression) => (
                          <option key={expression.id} value={expression.id}>{expression.label}</option>
                        ))}
                      </select>
                      <select
                        value={character.position}
                        onChange={(event) => updateCharacter(index, { position: event.target.value as SceneCharacterDraft['position'] })}
                        className={sceneControlClass}
                      >
                        <option value="left">左</option>
                        <option value="center">中</option>
                        <option value="right">右</option>
                      </select>
                      <select
                        value={character.action || 'show'}
                        onChange={(event) => updateCharacter(index, { action: event.target.value as SceneCharacterDraft['action'] })}
                        className={sceneControlClass}
                      >
                        <option value="show">显示</option>
                        <option value="keep">保持</option>
                        <option value="hide">隐藏</option>
                      </select>
                      <button onClick={() => removeCharacter(index)} className="rounded-lg text-red-500 hover:bg-red-50" title="删除角色">
                        <Trash2 className="mx-auto h-4 w-4" />
                      </button>
                    </div>
                  )
                })}
                {draft.characters.length === 0 && (
                  <div className="rounded-lg border border-dashed border-dream-200 bg-white p-5 text-center text-xs text-dream-500">
                    这一幕暂时没有角色。可以只显示背景和旁白，也可以添加多个角色。
                  </div>
                )}
              </div>
            </section>

            <div className="grid gap-3 md:grid-cols-[160px_1fr]">
              <FieldBlock label={isCharacterLens ? '说话角色' : '文本来源'}>
                <select
                  value={draft.speakerRole}
                  onChange={(event) => {
                    const role = event.target.value
                    const character = characters.find((item) => item.id === role)
                    setDraft((current) => ({
                      ...current,
                      speakerRole: role,
                      speakerExpression: character?.defaultExpression || current.speakerExpression,
                    }))
                  }}
                  className={sceneControlClass}
                >
                  <option value="旁白">旁白</option>
                  <option value="ghost">系统幽灵</option>
                  {characters.map((character) => (
                    <option key={character.id} value={character.id}>{character.name}</option>
                  ))}
                </select>
              </FieldBlock>
              {isCharacterLens && speakerCharacter ? (
                <div className="grid gap-2 md:grid-cols-[1fr_110px_100px]">
                  <select
                    value={draft.speakerExpression}
                    onChange={(event) => setDraft((current) => ({ ...current, speakerExpression: event.target.value }))}
                    className={sceneControlClass}
                  >
                    <option value="__random">随机表情</option>
                    {speakerCharacter.expressions.map((expression) => (
                      <option key={expression.id} value={expression.id}>{expression.label}</option>
                    ))}
                  </select>
                  <select
                    value={draft.speakerPosition}
                    onChange={(event) => setDraft((current) => ({ ...current, speakerPosition: event.target.value as SceneDraft['speakerPosition'] }))}
                    className={sceneControlClass}
                  >
                    <option value="left">左</option>
                    <option value="center">中</option>
                    <option value="right">右</option>
                  </select>
                  <label className="flex items-center gap-2 rounded-lg border border-dream-200 bg-white px-3 py-2 text-xs text-dream-700">
                    <input
                      type="checkbox"
                      checked={draft.autoStageSpeaker}
                      onChange={(event) => setDraft((current) => ({ ...current, autoStageSpeaker: event.target.checked }))}
                    />
                    自动登场
                  </label>
                </div>
              ) : (
                <div className="rounded-lg border border-dream-100 bg-dream-50/50 px-3 py-2 text-xs leading-5 text-dream-600">
                  {draft.lensType === 'memory'
                    ? '回忆镜头会以旁白方式播放，可用于过去片段、梦境、闪回。'
                    : draft.lensType === 'system'
                      ? '系统提示适合 Meta 信息、节点异常、存档提示。'
                      : '旁白适合描述动作、环境、时间跳转和镜头过渡。'}
                </div>
              )}
            </div>

            <FieldBlock label={draft.lensType === 'thought' ? '心理描写' : draft.lensType === 'memory' ? '回忆内容' : '文本'}>
              <textarea
                value={draft.text}
                onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))}
                rows={5}
                className={`${sceneControlClass} resize-none leading-6`}
                placeholder={draft.lensType === 'thought' ? '例如：雪忽然意识到，自己害怕的不是遗忘，而是被故事留下。' : '写下这一镜头要播放的内容。'}
              />
            </FieldBlock>
          </div>

          <aside className="space-y-3">
            <div className="overflow-hidden rounded-lg border border-dream-100 bg-slate-50">
              <img src={draft.backgroundId} alt="场景背景预览" className="h-32 w-full object-cover" />
              <div className="p-3">
                <p className="text-xs font-semibold text-dream-800">生成节点</p>
                <p className="mt-1 text-xs leading-5 text-dream-500">
                  1 个背景节点，{normalizedSceneDraft(draft).characters.length} 个角色节点，1 个{LENS_LABEL[draft.lensType]}文本节点。
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-dream-100 bg-white p-3">
              <p className="mb-2 text-xs font-semibold text-dream-800">角色预览</p>
              <div className="flex flex-wrap gap-2">
                {draft.characters.map((character, index) => {
                  const activeCharacter = characters.find((item) => item.id === character.characterId)
                  const expression = activeCharacter?.expressions.find((item) => item.id === character.expression)
                  return (
                    <div key={`${character.characterId}-preview-${index}`} className="w-[64px] rounded-md bg-dream-50 p-1 text-center">
                      {expression && <img src={expression.url} alt={activeCharacter?.name || character.characterId} className="mx-auto h-16 object-contain" />}
                      <p className="truncate text-[10px] text-dream-600">{activeCharacter?.name}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </aside>
        </div>

        <footer className="flex justify-end gap-2 border-t border-dream-100 px-5 py-4">
          <button onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">取消</button>
          <button
            onClick={() => canSubmit && onConfirm(draft)}
            disabled={!canSubmit}
            className="rounded-lg bg-dream-600 px-4 py-2 text-sm font-medium text-white hover:bg-dream-700 disabled:opacity-50"
          >
            插入场景
          </button>
        </footer>
      </section>
    </div>
  )
}

const sceneControlClass = 'w-full rounded-lg border border-dream-200 bg-white px-3 py-2 text-sm focus:border-dream-500 focus:outline-none focus:ring-2 focus:ring-dream-500/20'

function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-dream-700">{label}</span>
      {children}
    </label>
  )
}

function CharacterOverview() {
  const characters = loadLibraryCharacters()
  return (
    <div className="mx-auto grid max-w-4xl gap-4 px-4 py-6 md:grid-cols-2">
      {characters.map((character) => (
        <div key={character.id} className="rounded-xl border border-dream-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-dream-900">{character.name}</h3>
            <span className="text-xs text-dream-400">{character.id}</span>
          </div>
          <p className="mt-2 text-xs text-dream-500">可用立绘：{character.expressions.map((item) => item.label).join(' / ')}</p>
          <p className="mt-2 line-clamp-3 text-xs leading-5 text-dream-600">{character.outline}</p>
        </div>
      ))}
    </div>
  )
}

function SceneOverview() {
  const scenes = loadLibraryScenes()
  return (
    <div className="mx-auto grid max-w-4xl gap-4 px-4 py-6 md:grid-cols-2">
      {scenes.map((scene) => (
        <div key={scene.id} className="overflow-hidden rounded-xl border border-dream-100 bg-white shadow-sm">
          <img src={scene.url} alt={scene.name} className="h-36 w-full object-cover" />
          <div className="p-3">
            <p className="text-sm font-medium text-dream-800">{scene.name}</p>
            <p className="mt-1 text-xs text-dream-500">{scene.usage}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function buildStoryItems(nodes: Node[], edges: Edge[]): StoryItem[] {
  if (nodes.length === 0) return []
  const consumed = new Set<string>()
  const items: StoryItem[] = []
  let current: Node | undefined = findStartNode(nodes, edges)

  while (current && !consumed.has(current.id)) {
    consumed.add(current.id)
    if (current.type === 'choice') {
      const branches = getChoiceBranches(current, nodes, edges)
      const merge = findCommonMerge(branches)
      branches.forEach((branch) => branch.chain.forEach((node) => consumed.add(node.id)))
      if (merge) consumed.add(merge.id)
      items.push({ kind: 'choice', node: current, branches, merge })
      current = merge ? findNormalTarget(merge, nodes, edges) : undefined
    } else {
      items.push({ kind: 'node', node: current })
      current = findNormalTarget(current, nodes, edges)
    }
  }

  nodes.forEach((node) => {
    if (!consumed.has(node.id)) items.push({ kind: 'node', node })
  })
  return items
}

function getChoiceBranches(choiceNode: Node, nodes: Node[], edges: Edge[]): BranchInfo[] {
  return getChoices(choiceNode).map((label, index) => {
    const edge = edges.find((item) => item.source === choiceNode.id && item.sourceHandle === `choice-${index}`)
    const start = edge ? nodes.find((node) => node.id === edge.target) : undefined
    const { chain, merge } = start ? walkBranch(start, nodes, edges) : { chain: [], merge: undefined }
    return { index, label, start, chain, merge }
  })
}

function walkBranch(start: Node, nodes: Node[], edges: Edge[]) {
  const chain: Node[] = []
  const visited = new Set<string>()
  let current: Node | undefined = start
  let merge: Node | undefined

  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    const incomingCount = edges.filter((edge) => edge.target === current!.id).length
    if (incomingCount > 1 && chain.length > 0) {
      merge = current
      break
    }
    chain.push(current)
    const next = findNormalTarget(current, nodes, edges)
    if (next && edges.filter((edge) => edge.target === next.id).length > 1) {
      merge = next
      break
    }
    current = next
  }

  return { chain, merge }
}

function findCommonMerge(branches: BranchInfo[]) {
  const mergeIds = branches.map((branch) => branch.merge?.id).filter(Boolean)
  const first = mergeIds[0]
  if (first && mergeIds.every((id) => id === first)) return branches.find((branch) => branch.merge?.id === first)?.merge
  return branches.find((branch) => branch.merge)?.merge
}

function layoutNodes(nodes: Node[], edges: Edge[]) {
  const items = buildStoryItems(nodes, edges)
  const positioned = new Map<string, Node>()
  let y = 120

  items.forEach((item) => {
    if (item.kind === 'node') {
      positioned.set(item.node.id, { ...item.node, position: { x: 260, y } })
      y += 150
      return
    }

    positioned.set(item.node.id, { ...item.node, position: { x: 260, y } })
    const branchBaseY = y + 150
    item.branches.forEach((branch, branchIndex) => {
      const x = 650 + branchIndex * 330
      branch.chain.forEach((node, nodeIndex) => {
        positioned.set(node.id, { ...node, position: { x, y: branchBaseY + nodeIndex * 130 } })
      })
    })
    const maxBranchLength = Math.max(1, ...item.branches.map((branch) => branch.chain.length))
    if (item.merge) {
      positioned.set(item.merge.id, { ...item.merge, position: { x: 650 + Math.max(0, item.branches.length - 1) * 165, y: branchBaseY + maxBranchLength * 130 } })
      y = branchBaseY + maxBranchLength * 130 + 160
    } else {
      y = branchBaseY + maxBranchLength * 130 + 60
    }
  })

  return nodes.map((node) => positioned.get(node.id) || node)
}

function findStartNode(nodes: Node[], edges: Edge[]) {
  const targets = new Set(edges.map((edge) => edge.target))
  return nodes.find((node) => !targets.has(node.id)) || nodes[0]
}

function findNormalTarget(node: Node, nodes: Node[], edges: Edge[]) {
  const edge = edges.find((item) => item.source === node.id && !item.sourceHandle)
  return edge ? nodes.find((item) => item.id === edge.target) : undefined
}

function getMainTail(items: StoryItem[], nodes: Node[]) {
  const last = items[items.length - 1]
  if (!last) return nodes[nodes.length - 1]
  if (last.kind === 'choice') return last.merge || last.node
  return last.node
}

function getChoices(node: Node) {
  const data = getNodeData(node)
  const choices = Array.isArray(data.choices) ? (data.choices as string[]) : []
  return choices.length > 0 ? choices : ['继续']
}

function getSceneCode(nodes: Node[]) {
  return nodes[0] ? getNodeSceneCode(nodes[0]) : '1-1'
}

function getChapterFromSceneCode(sceneCode: string) {
  const chapter = sceneCode.trim().split('-')[0]
  return chapter || '1'
}

function getNodeChapter(node: Node) {
  const data = getNodeData(node)
  const sceneCode = String(data.sceneCode || '')
  return sceneCode ? getChapterFromSceneCode(sceneCode) : ''
}

function getChapterOptions(nodes: Node[]) {
  const counts = new Map<string, number>()
  const seenScenes = new Set<string>()
  nodes.forEach((node) => {
    const sceneGroupId = getNodeSceneGroupId(node)
    const chapter = getNodeChapter(node)
    if (!sceneGroupId || !chapter || seenScenes.has(sceneGroupId)) return
    seenScenes.add(sceneGroupId)
    counts.set(chapter, (counts.get(chapter) || 0) + 1)
  })

  const sorted = Array.from(counts.entries()).sort(([a], [b]) => Number(a) - Number(b))
  if (sorted.length === 0) return [{ id: '1', label: '第 1 章', count: 0 }]
  return sorted.map(([id, count]) => ({ id, label: `第 ${id} 章`, count }))
}

function storyItemHasChapter(item: StoryItem, chapter: string) {
  if (item.kind === 'node') return getNodeChapter(item.node) === chapter
  if (getNodeChapter(item.node) === chapter) return true
  if (item.merge && getNodeChapter(item.merge) === chapter) return true
  return item.branches.some((branch) => branch.chain.some((node) => getNodeChapter(node) === chapter))
}

function storyItemHasSceneGroup(item: StoryItem, sceneGroupId: string) {
  if (item.kind === 'node') return getNodeSceneGroupId(item.node) === sceneGroupId
  if (getNodeSceneGroupId(item.node) === sceneGroupId) return true
  if (item.merge && getNodeSceneGroupId(item.merge) === sceneGroupId) return true
  return item.branches.some((branch) => branch.chain.some((node) => getNodeSceneGroupId(node) === sceneGroupId))
}

function getSceneOutline(nodes: Node[], edges: Edge[]) {
  const outline: Array<{ sceneGroupId: string; code: string; chapter: string; lensType: LensType; title: string; characterCount: number; preview: string }> = []
  const seen = new Set<string>()

  nodes.forEach((node) => {
    const sceneGroupId = getNodeSceneGroupId(node)
    if (!sceneGroupId || seen.has(sceneGroupId)) return
    const incomingFromSameScene = edges.some((edge) => {
      if (edge.target !== node.id) return false
      const source = nodes.find((candidate) => candidate.id === edge.source)
      return source && getNodeSceneGroupId(source) === sceneGroupId
    })
    if (incomingFromSameScene) return

    seen.add(sceneGroupId)
    const groupNodes = getSceneGroupNodes(node, nodes, edges)
    const draft = draftFromSceneNodes(groupNodes)
    const firstCharacter = draft.characters[0]
    const character = firstCharacter ? loadLibraryCharacters().find((item) => item.id === firstCharacter.characterId) : undefined
    outline.push({
      sceneGroupId,
      code: draft.sceneCode,
      chapter: getChapterFromSceneCode(draft.sceneCode),
      lensType: draft.lensType,
      title: character ? `${character.name} · ${LENS_LABEL[draft.lensType]}` : LENS_LABEL[draft.lensType],
      characterCount: draft.characters.length,
      preview: draft.text,
    })
  })

  return outline.sort((a, b) => compareSceneCode(a.code, b.code))
}

function compareSceneCode(a: string, b: string) {
  const [aChapter, aScene] = a.split('-').map((value) => Number(value))
  const [bChapter, bScene] = b.split('-').map((value) => Number(value))
  if (Number.isFinite(aChapter) && Number.isFinite(bChapter) && aChapter !== bChapter) return aChapter - bChapter
  if (Number.isFinite(aScene) && Number.isFinite(bScene) && aScene !== bScene) return aScene - bScene
  return a.localeCompare(b)
}

function ensureSceneCode(draft: SceneDraft, nodes: Node[], preferredChapter = '1'): SceneDraft {
  if (draft.sceneCode.trim()) return draft
  const existingSceneNumbers = nodes
    .map((node) => getNodeSceneCode(node))
    .filter((sceneCode) => getChapterFromSceneCode(sceneCode) === preferredChapter)
    .map((sceneCode) => Number(sceneCode.split('-')[1]))
    .filter((value) => Number.isFinite(value))
  const nextScene = Math.max(0, ...existingSceneNumbers) + 1
  return { ...draft, sceneCode: `${preferredChapter}-${nextScene}` }
}

function getSceneGroupNodes(start: Node, nodes: Node[], edges: Edge[]) {
  const sceneGroupId = getNodeSceneGroupId(start)
  const group: Node[] = []
  const visited = new Set<string>()
  let current: Node | undefined = start
  while (current && !visited.has(current.id) && getNodeSceneGroupId(current) === sceneGroupId) {
    group.push(current)
    visited.add(current.id)
    current = findNormalTarget(current, nodes, edges)
  }
  return group
}

function getSceneOptions(nodes: Node[], edges: Edge[]) {
  const options: Array<{ nodeId: string; label: string }> = []
  const seen = new Set<string>()
  nodes.forEach((node) => {
    const sceneGroupId = getNodeSceneGroupId(node)
    if (!sceneGroupId || seen.has(sceneGroupId)) return
    const incomingFromSameScene = edges.some((edge) => {
      if (edge.target !== node.id) return false
      const source = nodes.find((candidate) => candidate.id === edge.source)
      return source && getNodeSceneGroupId(source) === sceneGroupId
    })
    if (incomingFromSameScene) return
    seen.add(sceneGroupId)
    const draft = draftFromSceneNodes(getSceneGroupNodes(node, nodes, edges))
    options.push({ nodeId: node.id, label: `场景 ${draft.sceneCode}` })
  })
  return options
}

function getNodeDisplayLabel(node?: Node) {
  if (!node) return '未知节点'
  const data = getNodeData(node)
  const sceneCode = String(data.sceneCode || '')
  const prefix = sceneCode ? `场景 ${sceneCode}` : NODE_LABEL[node.type || 'dialogue'] || node.type || '节点'
  const text = String(data.text || data.role || data.characterId || data.backgroundId || '')
  return text ? `${prefix} · ${text.slice(0, 18)}` : prefix
}

function draftFromSceneNodes(sceneNodes: Node[]): SceneDraft {
  const backgroundNode = sceneNodes.find((node) => node.type === 'background')
  const textNode = sceneNodes.find((node) => node.type === 'dialogue' || node.type === 'subtitle')
  const characterNodes = sceneNodes.filter((node) => node.type === 'character')
  const backgroundData = getNodeData(backgroundNode)
  const textData = getNodeData(textNode)
  const lensType = String(textData.lensType || (textNode?.type === 'subtitle' ? 'narration' : 'dialogue')) as LensType
  const speakerRole = textNode?.type === 'subtitle' ? String(textData.role || '旁白') : String(textData.role || '旁白')
  const speakerCharacter = characterNodes.find((node) => getNodeCharacterId(node) === speakerRole)
  const speakerData = getNodeData(speakerCharacter)
  return {
    sceneCode: getSceneCode(sceneNodes),
    lensType,
    backgroundId: String(backgroundData.backgroundId || '/assets/backgrounds/bg-classroom.png'),
    characters: characterNodes.map((node) => {
      const data = getNodeData(node)
      return {
        characterId: String(data.characterId || 'yuki'),
        expression: String(data.expression || 'normal'),
        position: (String(data.position || 'center') as SceneCharacterDraft['position']),
        action: (String(data.action || 'show') as SceneCharacterDraft['action']),
      }
    }),
    speakerRole,
    speakerExpression: String(speakerData.expression || 'normal'),
    speakerPosition: (String(speakerData.position || 'left') as SceneDraft['speakerPosition']),
    autoStageSpeaker: true,
    text: String(textData.text || ''),
  }
}

function positionLabel(position: SceneCharacterDraft['position']) {
  return ({ left: '左', center: '中', right: '右' } as Record<SceneCharacterDraft['position'], string>)[position]
}

function createSceneNodes(draft: SceneDraft, reuseGroupId?: string): Node[] {
  const preparedDraft = normalizedSceneDraft(draft)
  const stamp = Date.now()
  const sceneGroupId = reuseGroupId || `scene-${stamp}-${Math.random().toString(36).slice(2, 6)}`
  const sceneCode = preparedDraft.sceneCode || '1-1'
  const nodes: Node[] = []
  nodes.push({
    id: `scene-bg-${stamp}`,
    type: 'background',
    position: { x: 260, y: 120 },
    data: { backgroundId: preparedDraft.backgroundId, sceneGroupId, sceneCode },
  })
  preparedDraft.characters.filter((character) => character.action !== 'keep').forEach((character, index) => {
    nodes.push({
      id: `scene-character-${stamp}-${index}`,
      type: 'character',
      position: { x: 260, y: 120 + (index + 1) * 130 },
      data: {
        characterId: character.characterId,
        action: character.action === 'hide' ? 'hide' : 'show',
        expression: character.expression,
        position: character.position,
        sceneGroupId,
        sceneCode,
      },
    })
  })
  const text = preparedDraft.text.trim()
  if (text) {
    const isSubtitle = preparedDraft.lensType !== 'dialogue' && preparedDraft.lensType !== 'thought'
    const role = preparedDraft.lensType === 'thought' ? preparedDraft.speakerRole : (isSubtitle ? (preparedDraft.speakerRole === 'ghost' ? 'ghost' : '旁白') : preparedDraft.speakerRole)
    nodes.push({
      id: `scene-text-${stamp}`,
      type: isSubtitle ? 'subtitle' : 'dialogue',
      position: { x: 260, y: 120 + (preparedDraft.characters.length + 1) * 130 },
      data: isSubtitle
        ? { role, text, position: 'bottom', duration: 0, sceneGroupId, sceneCode, lensType: preparedDraft.lensType }
        : { role, text, sceneGroupId, sceneCode, lensType: preparedDraft.lensType },
    })
  }
  return nodes
}

function normalizedSceneDraft(draft: SceneDraft): SceneDraft {
  const characters = loadLibraryCharacters()
  const preparedCharacters = draft.characters.map((character) => ({
    ...character,
    action: character.action || 'show',
    expression: resolveExpression(character.characterId, character.expression),
  }))

  if ((draft.lensType === 'dialogue' || draft.lensType === 'thought') && draft.autoStageSpeaker && draft.speakerRole !== '旁白') {
    const speakerIndex = preparedCharacters.findIndex((character) => character.characterId === draft.speakerRole)
    const speakerExpression = resolveExpression(draft.speakerRole, draft.speakerExpression)
    if (speakerIndex >= 0) {
      preparedCharacters[speakerIndex] = {
        ...preparedCharacters[speakerIndex],
        expression: speakerExpression,
        position: draft.speakerPosition,
        action: 'show',
      }
    } else if (characters.some((character) => character.id === draft.speakerRole)) {
      preparedCharacters.push({
        characterId: draft.speakerRole,
        expression: speakerExpression,
        position: draft.speakerPosition,
        action: 'show',
      })
    }
  }

  return {
    ...draft,
    characters: preparedCharacters,
  }
}

function resolveExpression(characterId: string, expression: string) {
  if (expression !== '__random') return expression || 'normal'
  const character = loadLibraryCharacters().find((item) => item.id === characterId)
  const expressions = character?.expressions || []
  if (expressions.length === 0) return character?.defaultExpression || 'normal'
  const index = Math.floor(Math.random() * expressions.length)
  return expressions[index]?.id || character?.defaultExpression || 'normal'
}

function chainEdges(nodes: Node[]) {
  return nodes.slice(0, -1).map((node, index) => normalEdge(node.id, nodes[index + 1].id))
}

function normalEdge(source: string, target: string, id = `e-${source}-${target}`): Edge {
  return { id, source, target, animated: true }
}

function choiceEdge(source: string, target: string, index: number, label: string): Edge {
  return { id: `e-${source}-${target}`, source, sourceHandle: `choice-${index}`, target, label, animated: true }
}

function removeEdge(edges: Edge[], source: string, target: string) {
  const index = edges.findIndex((edge) => edge.source === source && edge.target === target && !edge.sourceHandle)
  if (index >= 0) edges.splice(index, 1)
}

function isBranchInternalEdge(edge: Edge, items: StoryItem[]) {
  return items.some((item) => item.kind === 'choice' && item.branches.some((branch) => {
    const ids = new Set(branch.chain.map((node) => node.id))
    if (branch.merge) ids.add(branch.merge.id)
    return ids.has(edge.source) || ids.has(edge.target)
  }))
}

function createNode(type: string, data: Record<string, unknown> = {}): Node {
  return {
    id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    position: { x: 260, y: 120 },
    data: { ...defaultNodeData(type), ...cleanUndefined(data) },
  }
}

function cleanUndefined(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined))
}

function defaultNodeData(type: string) {
  switch (type) {
    case 'dialogue':
      return { role: 'yuki', text: '新的台词。' }
    case 'subtitle':
      return { text: '新的旁白。', position: 'bottom', duration: 0 }
    case 'choice':
      return { choices: ['选项一', '选项二'] }
    case 'background':
      return { backgroundId: '/assets/backgrounds/bg-classroom.png' }
    case 'character':
      return { characterId: 'yuki', action: 'show', expression: 'normal', position: 'center' }
    default:
      return {}
  }
}
