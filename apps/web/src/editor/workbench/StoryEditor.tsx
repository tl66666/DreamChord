import { useMemo, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { Image as ImageIcon, Plus, Save } from 'lucide-react'
import { useConfirm } from '../../components/FeedbackProvider'
import { useEditorStore } from '../../stores/editorStore'
import { getNodeSceneGroupId } from '../sceneGraph'
import { QUICK_TYPES } from './workbenchConstants'
import type { BranchInfo, SceneComposerTarget, SceneDraft, StageState } from './workbenchTypes'
import { BeatCard, ChapterNavigator, ChoiceWorkbench, GuidePill, SceneCard, SceneOutline } from './StoryEditorParts'
import SceneComposerModal from './SceneComposerModal'
import {
  buildStoryItems, chainEdges, choiceEdge, createInheritedSceneDraft, createNode, createOpeningTemplateGraph, createSceneNodes,
  draftFromSceneNodes, ensureSceneCode, findCommonMerge, getChapterOptions, getChoiceBranches,
  getChoices, getMainTail, getSceneCode, getSceneGroupNodes, getSceneOutline, isBranchInternalEdge,
  layoutNodes, normalEdge, removeChoiceBranchFromGraph, removeEdge, resolveStageStateAfterNode, storyItemHasChapter,
  storyItemHasSceneGroup,
} from './storyEditorGraph'

export default function StoryEditor({ onSave }: { onSave: () => void }) {
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

  const composerStage = useMemo<StageState | undefined>(() => {
    if (!sceneComposerTarget || sceneComposerTarget.kind === 'edit') return undefined
    if (sceneComposerTarget.kind === 'main') {
      const tail = getMainTail(storyItems, nodes)
      return resolveStageStateAfterNode(nodes, edges, tail?.id)
    }
    const branchTail = sceneComposerTarget.branch.chain.at(-1) || sceneComposerTarget.choiceNode
    return resolveStageStateAfterNode(nodes, edges, branchTail.id)
  }, [edges, nodes, sceneComposerTarget, storyItems])

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
    const result = removeChoiceBranchFromGraph(choiceNode, choiceIndex, nodes, edges)
    updateGraph(result.nodes, result.edges)
  }

  const createOpeningTemplate = () => {
    const result = createOpeningTemplateGraph()
    updateGraph(result.nodes, result.edges)
    const opening = result.nodes.find((node) => node.type === 'subtitle')
    if (opening) setSelectedNodeId(opening.id)
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
                    stage={resolveStageStateAfterNode(nodes, edges, sceneNodes.at(-1)?.id)}
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
          initialDraft={sceneComposerTarget.kind === 'edit'
            ? draftFromSceneNodes(nodes.filter((node) => getNodeSceneGroupId(node) === sceneComposerTarget.sceneGroupId))
            : composerStage ? createInheritedSceneDraft(composerStage) : undefined}
          inheritedStage={sceneComposerTarget.kind === 'edit' ? undefined : composerStage}
          onCancel={() => setSceneComposerTarget(null)}
          onConfirm={handleInsertScene}
        />
      )}
    </div>
  )
}

