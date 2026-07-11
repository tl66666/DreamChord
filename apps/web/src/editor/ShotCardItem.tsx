/**
 * ShotCardItem.tsx — 单张镜头卡组件
 *
 * 从 ShotCardEditor.tsx 中提取，负责渲染单张镜头卡的折叠/展开视图。
 */

import type { Edge } from '@xyflow/react'
import {
  Trash2, ChevronUp, ChevronDown, MessageSquare, GitBranch,
  Copy, Eye, ArrowRight, ChevronRight, AlertTriangle,
} from 'lucide-react'
import type { ShotCard, Scene } from './sceneGraph'
import { loadLibraryCharacters, loadLibraryScenes, type StoryTemplate } from '../lib/libraryData'
import { resolveBgUrl } from './storyFlowchart/bgUrl'
import { CardEditor } from './CardEditor'

/** 从 choice 节点的边中提取分支去向信息 */
function getChoiceTargetFromEdges(choiceNodeId: string, index: number, edges: Edge[]): { action: string; targetSceneId?: string } {
  const edge = edges.find((e) => e.source === choiceNodeId && e.sourceHandle === `choice-${index}`)
  if (!edge) return { action: 'new_branch' }
  return { action: 'jump', targetSceneId: edge.target }
}

export interface ShotCardItemProps {
  card: ShotCard
  index: number
  total: number
  isSelected: boolean
  isEditing: boolean
  isContinuation: boolean
  compactMode: boolean
  characters: ReturnType<typeof loadLibraryCharacters>
  libraryScenes: ReturnType<typeof loadLibraryScenes>
  storyTemplates: StoryTemplate[]
  allScenes: Scene[]
  allEdges: Edge[]
  convergenceMap: Map<string, string[]>
  onSelect: () => void
  onEdit: () => void
  onUpdate: (updates: Partial<ShotCard>) => void
  onDelete: () => void
  onDuplicate: () => void
  onMove: (dir: 'up' | 'down') => void
  onSetChoiceTarget: (choiceIndex: number, targetSceneId: string) => void
  onCreateBranch: (choiceIndex: number, choiceText: string) => void
  onNavigateToScene: (sceneId: string) => void
  onRequestAI: (mode: 'polish' | 'continue' | 'choices' | 'branchReplies' | 'storyGraph') => void
  onOpenAssetPicker: (cardId: string, field: 'background') => void
}

export function ShotCardItem({
  card, index, total, isSelected, isEditing, isContinuation,
  compactMode,
  characters, libraryScenes, storyTemplates, allScenes, allEdges, convergenceMap,
  onSelect, onEdit, onUpdate, onDelete, onDuplicate, onMove,
  onSetChoiceTarget, onCreateBranch, onNavigateToScene, onRequestAI, onOpenAssetPicker,
}: ShotCardItemProps) {
  const typeIcon = card.type === 'choice' ? <GitBranch className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />
  const typeLabel = card.type === 'choice' ? '选项' : card.lensType === 'narration' ? '旁白' : card.lensType === 'thought' ? '心理' : card.lensType === 'memory' ? '回忆' : card.lensType === 'system' ? '系统' : '对话'

  // 计算未设置去向的选项数量（仅 choice 类型）
  const untargetedCount = card.type === 'choice'
    ? (card.choices || []).filter((_, i) => {
        const choiceNodeId = card.nodeIds.find(id => allEdges.some(e => e.source === id && e.sourceHandle === `choice-${i}`))
          || card.nodeIds[card.nodeIds.length - 1] || ''
        return !getChoiceTargetFromEdges(choiceNodeId, i, allEdges).targetSceneId
      }).length
    : 0

  return (
    <div
      onClick={onSelect}
      onDoubleClick={(e) => { e.stopPropagation(); if (!isEditing) onEdit() }}
      className={`group rounded-xl border transition ${
        isSelected ? 'border-dream-400 bg-white shadow-md ring-1 ring-dream-200' : 'border-dream-150 bg-white/60 hover:border-dream-200'
      } ${isContinuation ? 'ml-3 border-l-2' : ''}`}
      style={isContinuation ? { borderLeftColor: characters.find((c) => c.id === card.speaker)?.color || '#c4b5fd' } : undefined}
    >
      <div className={`flex items-center justify-between border-b border-dream-50 ${isContinuation ? 'px-4 py-1' : 'px-4 py-2.5'}`}>
        <div className="flex items-center gap-2">
          {isContinuation ? (
            <>
              <ChevronRight className="h-3 w-3 text-dream-300" />
              <span className="text-xs text-dream-400">续</span>
            </>
          ) : (
            <>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-dream-100 text-xs font-bold text-dream-600">
                {index + 1}
              </span>
              <span className="flex items-center gap-1 text-sm font-medium text-dream-700">
                {typeIcon} {typeLabel}
              </span>
              {untargetedCount > 0 && (
                <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-600" title={`${untargetedCount} 个选项未设置去向`}>
                  <AlertTriangle className="h-2.5 w-2.5" /> {untargetedCount} 未设置
                </span>
              )}
              <span className="text-xs text-dream-300">·</span>
              <span className="text-xs font-mono text-dream-400">{card.sceneCode}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
          <button onClick={(e) => { e.stopPropagation(); onMove('up') }} disabled={index === 0} title="上移" className="rounded p-1 text-dream-400 transition hover:bg-dream-50 disabled:opacity-30">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onMove('down') }} disabled={index === total - 1} title="下移" className="rounded p-1 text-dream-400 transition hover:bg-dream-50 disabled:opacity-30">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDuplicate() }} title="复制卡片" className="rounded p-1 text-dream-400 transition hover:bg-dream-50">
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onEdit() }} title="展开/折叠" className={`rounded p-1 transition hover:bg-dream-50 ${isEditing ? 'text-dream-600 bg-dream-50' : 'text-dream-400'}`}>
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete() }} title="删除" className="rounded p-1 text-dream-400 transition hover:bg-red-50 hover:text-red-500">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!isEditing ? (
        isContinuation ? (
          // 连续卡片折叠视图
          <div className="flex items-center gap-2 px-4 py-1.5">
            <div className="min-w-0 flex-1">
              {card.speaker !== '旁白' && (
                <span className="text-xs font-medium" style={{ color: characters.find((c) => c.id === card.speaker)?.color }}>
                  {characters.find((c) => c.id === card.speaker)?.name || card.speaker}：
                </span>
              )}
              <span className={`text-sm text-dream-600 ${card.text ? '' : 'text-dream-300'}`}>
                {card.text || '（空台词）'}
              </span>
            </div>
          </div>
        ) : (
        <div className={compactMode ? 'flex gap-2 px-3 py-2' : 'flex gap-3 px-4 py-3'}>
          <div className={compactMode ? 'h-10 w-16 shrink-0 overflow-hidden rounded-md border border-dream-100' : 'h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-dream-100'}>
            <img src={resolveBgUrl(card.background, libraryScenes)} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2' }} />
          </div>
          <div className="min-w-0 flex-1">
            {card.characters.length > 0 && (
              <div className="mb-1 flex flex-wrap gap-1">
                {card.characters.map((c) => {
                  const char = characters.find((ch) => ch.id === c.characterId)
                  return (
                    <span key={c.characterId} className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: `${char?.color || '#a78bfa'}20`, color: char?.color || '#a78bfa' }}>
                      {char?.name || c.characterId} · {c.expression}
                    </span>
                  )
                })}
              </div>
            )}
            {card.type === 'choice' ? (
              <div className="space-y-0.5">
                {(card.choices || []).map((choice, i) => {
                  // 通过边信息找到 choice 节点：哪个 nodeId 有 choice-{i} 的 sourceHandle 边
                  const choiceNodeId = card.nodeIds.find(id => allEdges.some(e => e.source === id && e.sourceHandle === `choice-${i}`))
                    || card.nodeIds[card.nodeIds.length - 1] || ''
                  const target = getChoiceTargetFromEdges(choiceNodeId, i, allEdges)
                  return (
                    <div key={`choice-${i}`} className="flex items-center gap-1.5 text-xs text-dream-500">
                      <span className="font-bold">{String.fromCharCode(65 + i)}.</span>
                      <span className="truncate">{choice}</span>
                      {target.targetSceneId ? (
                        <span className="flex items-center gap-0.5 rounded bg-dream-50 px-1 text-[10px] text-dream-400">
                          <ArrowRight className="h-2.5 w-2.5" />
                          {allScenes.find(s => s.id === target.targetSceneId)?.code || '?'}
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 rounded bg-amber-50 px-1 text-[10px] text-amber-500">
                          <AlertTriangle className="h-2.5 w-2.5" /> 未设置
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-sm text-dream-700">
                {card.speaker !== '旁白' && <span className="font-medium" style={{ color: characters.find((c) => c.id === card.speaker)?.color }}>{card.speaker}：</span>}
                <span className={card.text ? '' : 'text-dream-300'}>{card.text || '（空台词）'}</span>
              </div>
            )}
          </div>
        </div>
        )
      ) : (
        <div onClick={(e) => e.stopPropagation()}>
          <CardEditor
            card={card}
            characters={characters}
            libraryScenes={libraryScenes}
            storyTemplates={storyTemplates}
            allScenes={allScenes}
            allEdges={allEdges}
            convergenceMap={convergenceMap}
            onUpdate={onUpdate}
            onSetChoiceTarget={onSetChoiceTarget}
            onCreateBranch={onCreateBranch}
            onNavigateToScene={onNavigateToScene}
            onRequestAI={onRequestAI}
            onOpenAssetPicker={onOpenAssetPicker}
          />
        </div>
      )}
    </div>
  )
}
