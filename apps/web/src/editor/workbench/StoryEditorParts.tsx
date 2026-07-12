import type { Edge, Node } from '@xyflow/react'
import { ArrowDown, ArrowUp, Image as ImageIcon, Trash2 } from 'lucide-react'
import { loadLibraryCharacters, loadLibraryScenes } from '../../lib/libraryData'
import { getNodeData } from '../sceneGraph'
import { BRANCH_TYPES, LENS_LABEL, NODE_LABEL } from './workbenchConstants'
import type { BranchInfo, LensType, StageState } from './workbenchTypes'
import { draftFromSceneNodes, getChoices, getNodeDisplayLabel, getSceneOptions, positionLabel } from './storyEditorGraph'

export function GuidePill({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-dream-100 bg-white/80 px-3 py-2 shadow-sm">
      <p className="text-xs font-semibold text-dream-800">{title}</p>
      <p className="mt-1 text-[11px] leading-5 text-dream-500">{text}</p>
    </div>
  )
}

export function ChapterNavigator({
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

export function SceneOutline({
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

export function ChoiceWorkbench({
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

export function BeatCard({
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

export function MiniBeatCard({
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

export function SceneCard({
  sceneNodes,
  stage,
  index,
  onEdit,
  onDelete,
}: {
  sceneNodes: Node[]
  stage: StageState
  index: number
  onEdit: () => void
  onDelete: () => void
}) {
  const draft = draftFromSceneNodes(sceneNodes)
  const scenes = loadLibraryScenes()
  const characters = loadLibraryCharacters()
  const scene = scenes.find((item) => item.url === stage.backgroundId || item.id === stage.backgroundId)
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
            <span className="text-xs text-cyan-500">舞台 {stage.characters.length} 个角色</span>
          </div>
          <div className="grid gap-3 md:grid-cols-[140px_1fr]">
            <div className="overflow-hidden rounded-lg border border-cyan-100 bg-slate-50">
              <img src={stage.backgroundId} alt={scene?.name || '场景背景'} className="h-20 w-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-xs text-cyan-600">
                舞台结果：{stage.characters.map((item) => {
                  const character = characters.find((candidate) => candidate.id === item.characterId)
                  return `${character?.name || item.characterId}/${item.expression}/${positionLabel(item.position)}`
                }).join('、') || '无'}
              </p>
              {stage.ambiguous && <p className="mb-1 text-[11px] leading-4 text-amber-700">分支汇合后的舞台不一致，请在此处明确重置背景和角色。</p>}
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

export function EditableSummary({
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
