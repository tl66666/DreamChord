/**
 * CardEditor.tsx — 镜头卡编辑模式组件
 *
 * 从 ShotCardEditor.tsx 中提取，负责单张镜头卡的详细编辑界面。
 */

import { useState, useEffect } from 'react'
import type { Edge } from '@xyflow/react'
import {
  ImageIcon, Users, X, Wand2, ArrowRight, GitMerge, Plus, Sparkles, GitBranch, AlertTriangle, FolderOpen,
} from 'lucide-react'
import {
  type ShotCard, type CharacterSlot, type Scene,
  LENS_TYPES,
} from './sceneGraph'
import { loadLibraryCharacters, loadLibraryScenes, type StoryTemplate } from '../lib/libraryData'
import { resolveBgUrl } from './storyFlowchart/bgUrl'
import { TemplateSelect, extractChoicesFromTemplate } from './manuscriptUtils'

export function CardEditor({
  card, characters, libraryScenes, storyTemplates, allScenes, allEdges, convergenceMap,
  onUpdate, onSetChoiceTarget, onCreateBranch, onNavigateToScene, onRequestAI, onOpenAssetPicker,
}: {
  card: ShotCard
  characters: ReturnType<typeof loadLibraryCharacters>
  libraryScenes: ReturnType<typeof loadLibraryScenes>
  storyTemplates: StoryTemplate[]
  allScenes: Scene[]
  allEdges: Edge[]
  convergenceMap: Map<string, string[]>
  onUpdate: (updates: Partial<ShotCard>) => void
  onSetChoiceTarget: (choiceIndex: number, targetSceneId: string) => void
  onCreateBranch: (choiceIndex: number, choiceText: string) => void
  onNavigateToScene: (sceneId: string) => void
  onRequestAI: (mode: 'polish' | 'continue' | 'choices' | 'branchReplies' | 'storyGraph') => void
  onOpenAssetPicker: (cardId: string, field: 'background') => void
}) {
  const [newCharId, setNewCharId] = useState('')
  const [localText, setLocalText] = useState(card.text)
  const [localChoices, setLocalChoices] = useState<string[]>(card.choices || [])

  // 当 card.id 或 card.text 变化时（切换卡片、外部更新），同步本地状态
  useEffect(() => {
    setLocalText(card.text)
  }, [card.id, card.text])
  useEffect(() => {
    setLocalChoices(card.choices || [])
  }, [card.id, card.choices])

  const speakerOptions = [
    { id: '旁白', name: '旁白' },
    ...characters.map((c) => ({ id: c.id, name: c.name })),
  ]

  const updateCharacter = (index: number, updates: Partial<CharacterSlot>) => {
    const newChars = [...card.characters]
    newChars[index] = { ...newChars[index]!, ...updates }
    onUpdate({ characters: newChars })
  }

  const addCharacter = (charId: string) => {
    if (!charId) return
    const char = characters.find((c) => c.id === charId)
    if (!char) return
    const activeCount = card.characters.filter((character) => character.action !== 'hide').length
    const position = activeCount === 0 ? 'center' : activeCount === 1 ? 'left' : 'right'
    onUpdate({ characters: [...card.characters, { characterId: charId, expression: char.defaultExpression, position, action: 'show' }] })
    setNewCharId('')
  }

  const removeCharacter = (index: number) => {
    const target = card.characters[index]
    onUpdate({
      characters: target?.action === 'keep'
        ? card.characters.map((character, itemIndex) => itemIndex === index ? { ...character, action: 'hide' } : character)
        : card.characters.filter((_, itemIndex) => itemIndex !== index),
    })
  }

  const updateChoice = (index: number, text: string) => {
    const newChoices = [...localChoices]
    newChoices[index] = text
    setLocalChoices(newChoices)
  }

  const commitChoices = () => {
    if (JSON.stringify(localChoices) !== JSON.stringify(card.choices || [])) {
      onUpdate({ choices: localChoices })
    }
  }

  const addChoice = () => {
    const newChoices = [...localChoices, `选项 ${localChoices.length + 1}`]
    setLocalChoices(newChoices)
    onUpdate({ choices: newChoices })
  }

  const removeChoice = (index: number) => {
    const newChoices = localChoices.filter((_, i) => i !== index)
    setLocalChoices(newChoices)
    onUpdate({ choices: newChoices })
  }

  // 获取选项的当前去向
  const getChoiceTarget = (choiceIndex: number) => {
    const choiceNodeId = card.nodeIds.find((id) => {
      // 从 allEdges 中找到 sourceHandle 为 choice-{index} 的边
      return allEdges.some((e) => e.source === id && e.sourceHandle === `choice-${choiceIndex}`)
    })
    if (!choiceNodeId) return { hasTarget: false, targetSceneId: undefined }
    const edge = allEdges.find((e) => e.source === choiceNodeId && e.sourceHandle === `choice-${choiceIndex}`)
    if (!edge) return { hasTarget: false, targetSceneId: undefined }
    // 查找目标节点所属的场景
    const targetScene = allScenes.find((s) => s.nodeIds.includes(edge.target))
    // 只有当目标场景存在时才算已配置
    return { hasTarget: !!targetScene, targetSceneId: targetScene?.id }
  }

  const applyTemplate = (templateId: string) => {
    const template = storyTemplates.find((item) => item.id === templateId)
    if (!template) return
    if (card.type === 'choice') {
      const choices = extractChoicesFromTemplate(template.content)
      const newChoices = choices.length > 0 ? choices : [template.title, '换一个方向']
      setLocalChoices(newChoices)
      onUpdate({ choices: newChoices })
      return
    }
    setLocalText(template.content)
    onUpdate({ text: template.content })
  }

  return (
    <div className="space-y-3 px-4 py-3">
      {/* 镜头类型选择 */}
      <div>
        <label className="mb-1 block text-xs font-medium text-dream-500">镜头类型</label>
        <div className="flex flex-wrap gap-1.5">
          {LENS_TYPES.map((lens) => (
            <button
              key={lens.id}
              onClick={() => onUpdate({ lensType: lens.id, type: lens.id === 'narration' || lens.id === 'memory' || lens.id === 'system' ? 'narration' : 'dialogue' })}
              title={lens.desc}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                card.lensType === lens.id ? 'bg-dream-600 text-white' : 'bg-dream-50 text-dream-500 hover:bg-dream-100'
              }`}
            >
              {lens.label}
            </button>
          ))}
        </div>
      </div>

      {/* 背景选择 */}
      <div>
        <label className="mb-1 block text-xs font-medium text-dream-500">背景</label>
        <div className="flex items-center gap-2">
          <div className="h-10 w-16 shrink-0 overflow-hidden rounded border border-dream-100">
            {card.background ? (
              <img src={resolveBgUrl(card.background, libraryScenes)} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2' }} />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-dream-50">
                <ImageIcon className="h-4 w-4 text-dream-300" />
              </div>
            )}
          </div>
          <select
            value={card.background}
            onChange={(e) => onUpdate({ background: e.target.value })}
            className="flex-1 rounded-lg border border-dream-200 bg-white px-2.5 py-1.5 text-sm text-dream-800 focus:border-dream-500 focus:outline-none"
          >
            <option value="">请选择背景...</option>
            {libraryScenes.map((scene) => (
              <option key={scene.id} value={scene.id}>{scene.name}</option>
            ))}
          </select>
          <button type="button" aria-label="从项目素材选择背景" title="从项目素材选择背景" onClick={() => onOpenAssetPicker(card.id, 'background')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-dream-200 text-dream-600 hover:bg-dream-50"><FolderOpen className="h-4 w-4" /></button>
        </div>
      </div>

      {/* 角色舞台 */}
      {card.lensType !== 'narration' && card.lensType !== 'system' && (
        <div>
          <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-dream-500">
            <Users className="h-3 w-3" /> 角色舞台
          </label>
          <div className="flex flex-wrap gap-2">
            {card.characters.map((char, i) => {
              const charInfo = characters.find((c) => c.id === char.characterId)
              return (
                <div key={char.characterId} className="flex items-center gap-1.5 rounded-lg border border-dream-150 bg-dream-50/50 px-2 py-1.5">
                  <span className="text-xs font-medium" style={{ color: charInfo?.color }}>{charInfo?.name || char.characterId}</span>
                  <select
                    value={char.expression === '__random' ? '__random' : char.expression}
                    onChange={(e) => updateCharacter(i, { expression: e.target.value })}
                    className="rounded border border-dream-200 bg-white px-1 py-0.5 text-xs"
                  >
                    <option value="__random">随机表情</option>
                    {charInfo?.expressions.map((expr) => (
                      <option key={expr.id} value={expr.id}>{expr.label}</option>
                    ))}
                  </select>
                  <select
                    value={char.position}
                    onChange={(e) => updateCharacter(i, { position: e.target.value as CharacterSlot['position'] })}
                    className="rounded border border-dream-200 bg-white px-1 py-0.5 text-xs"
                  >
                    <option value="left">左</option>
                    <option value="center">中</option>
                    <option value="right">右</option>
                  </select>
                  <select
                    value={char.action}
                    onChange={(e) => updateCharacter(i, { action: e.target.value as CharacterSlot['action'] })}
                    className="rounded border border-dream-200 bg-white px-1 py-0.5 text-xs"
                  >
                    <option value="show">登场 / 更新</option>
                    <option value="change">换表情</option>
                    <option value="keep">保持在场</option>
                    <option value="hide">退场</option>
                  </select>
                  <button onClick={() => removeCharacter(i)} className="text-dream-300 hover:text-red-500" title={char.action === 'keep' ? '让角色退场' : '移除这项舞台变化'}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
            <select
              value={newCharId}
              onChange={(e) => {
                setNewCharId(e.target.value)
                if (e.target.value) addCharacter(e.target.value)
              }}
              className="rounded-lg border border-dashed border-dream-200 bg-white px-2 py-1.5 text-xs text-dream-400"
            >
              <option value="">+ 添加角色</option>
              {characters
                .filter((c) => !card.characters.some((cs) => cs.characterId === c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
          </div>
        </div>
      )}

      {/* 发言人选择 + 自动登场 */}
      {(card.lensType === 'dialogue' || card.lensType === 'thought') && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-dream-500">发言人</label>
              <select
                value={card.speaker}
                onChange={(e) => onUpdate({ speaker: e.target.value, autoStageSpeaker: e.target.value !== '旁白' })}
                className="w-full rounded-lg border border-dream-200 bg-white px-2.5 py-1.5 text-sm text-dream-800 focus:border-dream-500 focus:outline-none"
              >
                {speakerOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.name}</option>
                ))}
              </select>
            </div>
            {card.speaker !== '旁白' && (
              <>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-dream-500">发言位置</label>
                  <select
                    value={card.speakerPosition}
                    onChange={(e) => onUpdate({ speakerPosition: e.target.value as ShotCard['speakerPosition'] })}
                    className="w-full rounded-lg border border-dream-200 bg-white px-2.5 py-1.5 text-sm text-dream-800 focus:border-dream-500 focus:outline-none"
                  >
                    <option value="left">左</option>
                    <option value="center">中</option>
                    <option value="right">右</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-dream-500">发言表情</label>
                  <select
                    value={card.speakerExpression === '__random' ? '__random' : card.speakerExpression}
                    onChange={(e) => onUpdate({ speakerExpression: e.target.value })}
                    className="w-full rounded-lg border border-dream-200 bg-white px-2.5 py-1.5 text-sm text-dream-800 focus:border-dream-500 focus:outline-none"
                  >
                    <option value="__random">随机表情</option>
                    {characters.find((c) => c.id === card.speaker)?.expressions.map((expr) => (
                      <option key={expr.id} value={expr.id}>{expr.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
          {card.speaker !== '旁白' && (
            <label className="flex items-center gap-2 text-xs text-dream-500">
              <input
                type="checkbox"
                checked={card.autoStageSpeaker}
                onChange={(e) => onUpdate({ autoStageSpeaker: e.target.checked })}
                className="rounded border-dream-300 text-dream-600 focus:ring-dream-500"
              />
              <Wand2 className="h-3 w-3" />
              自动登场：该角色未在台上时自动添加到角色舞台
            </label>
          )}
        </div>
      )}

      {/* 台词 / 选项编辑 */}
      {card.type === 'choice' ? (
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="block text-xs font-medium text-dream-500">选项列表与分支去向</label>
            <TemplateSelect templates={storyTemplates} onApply={applyTemplate} label="套用选项模板" />
          </div>
          {/* 批量操作栏 */}
          {(() => {
            const untargetedIndices = localChoices.map((_, i) => i).filter((i) => !getChoiceTarget(i).hasTarget)
            if (untargetedIndices.length === 0) return null
            const jumpScenes = allScenes.filter((s) => s.id !== card.sceneGroupId)
            return (
              <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span className="flex-1 text-xs text-amber-700">
                    {untargetedIndices.length} 个选项未设置去向
                  </span>
                  <button
                    onClick={() => {
                      untargetedIndices.forEach((i) => {
                        const choiceText = localChoices[i] || `选项 ${i + 1}`
                        onCreateBranch(i, choiceText)
                      })
                    }}
                    className="flex items-center gap-1 rounded-md bg-amber-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-amber-700"
                  >
                    <Plus className="h-3 w-3" /> 全部新建分支
                  </button>
                </div>
                {jumpScenes.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-2 pl-5">
                    <span className="text-[11px] text-amber-500">或全部跳转到：</span>
                    <div className="relative flex-1">
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            untargetedIndices.forEach((i) => onSetChoiceTarget(i, e.target.value))
                          }
                        }}
                        className="w-full cursor-pointer appearance-none rounded-md border border-amber-200 bg-white px-2 py-1 pr-6 text-xs text-amber-700 transition hover:border-amber-300"
                      >
                        <option value="">选择目标场景...</option>
                        {jumpScenes.map((s) => (
                          <option key={s.id} value={s.id}>{s.code} · {s.title}</option>
                        ))}
                      </select>
                      <ArrowRight className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-amber-400" />
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
          <div className="space-y-2">
            {localChoices.map((choice, i) => {
              const target = getChoiceTarget(i)
              const targetScene = target.targetSceneId ? allScenes.find((s) => s.id === target.targetSceneId) : null
              return (
                <div key={`choice-${i}`} className={`rounded-lg border p-2.5 transition ${
                  target.hasTarget
                    ? 'border-green-200 bg-green-50/20'
                    : 'border-dream-150 bg-dream-50/30'
                }`}>
                  {/* 选项文本 */}
                  <div className="flex items-center gap-2">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      target.hasTarget ? 'bg-green-100 text-green-600' : 'bg-dream-100 text-dream-600'
                    }`}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    <input
                      type="text"
                      value={choice}
                      onChange={(e) => updateChoice(i, e.target.value)}
                      onBlur={commitChoices}
                      placeholder={`选项 ${i + 1}`}
                      className="flex-1 rounded-lg border border-dream-200 bg-white px-2.5 py-1.5 text-sm focus:border-dream-500 focus:outline-none"
                    />
                    <button onClick={() => removeChoice(i)} className="text-dream-300 hover:text-red-500">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {/* 分支去向：已配置 */}
                  {target.hasTarget && targetScene ? (
                    <div className="mt-2 flex items-center gap-2 pl-8">
                      <div className="flex items-center gap-1.5 rounded-lg bg-green-50 px-2.5 py-1 text-xs">
                        <ArrowRight className="h-3 w-3 text-green-500" />
                        <span className="font-mono text-green-600">{targetScene.code}</span>
                        <span className="text-green-700">{targetScene.title}</span>
                        {convergenceMap.has(targetScene.id) && (
                          <span className="flex items-center gap-0.5 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-600">
                            <GitMerge className="h-2.5 w-2.5" /> 汇合
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => onNavigateToScene(targetScene.id)}
                        className="rounded-md px-2 py-1 text-xs text-dream-500 transition hover:bg-dream-50 hover:text-dream-700"
                      >
                        前往编辑
                      </button>
                      <button
                        onClick={() => onSetChoiceTarget(i, '')}
                        className="rounded-md px-2 py-1 text-xs text-dream-300 transition hover:bg-red-50 hover:text-red-500"
                      >
                        断开
                      </button>
                    </div>
                  ) : (
                    /* 分支去向：未配置 — 双按钮布局 */
                    <div className="mt-2 pl-8">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onCreateBranch(i, choice || `选项 ${i + 1}`)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-dream-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-dream-700"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          新建分支场景
                        </button>
                        <div className="relative">
                          <select
                            value=""
                            onChange={(e) => { if (e.target.value) onSetChoiceTarget(i, e.target.value) }}
                            className="cursor-pointer appearance-none rounded-lg border border-dream-200 bg-white px-3 py-1.5 pr-7 text-xs text-dream-600 transition hover:border-dream-300 hover:bg-dream-50"
                          >
                            <option value="">跳转到已有场景</option>
                            {allScenes
                              .filter((s) => s.id !== card.sceneGroupId)
                              .map((s) => (
                                <option key={s.id} value={s.id}>{s.code} · {s.title}</option>
                              ))}
                          </select>
                          <ArrowRight className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-dream-400" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            <button onClick={addChoice} className="w-full rounded-lg border border-dashed border-dream-200 py-1.5 text-xs text-dream-400 transition hover:border-dream-300 hover:bg-dream-50">
              + 添加选项
            </button>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <button
              onClick={() => onRequestAI('choices')}
              className="flex items-center gap-1 rounded-md bg-dream-100 px-2 py-1 text-xs text-dream-700 transition hover:bg-dream-200"
              title="使用 AI 生成选项"
            >
              <Sparkles className="h-3 w-3" /> AI 生成选项
            </button>
            <button
              onClick={() => onRequestAI('branchReplies')}
              className="flex items-center gap-1 rounded-md bg-dream-100 px-2 py-1 text-xs text-dream-700 transition hover:bg-dream-200"
              title="使用 AI 为每个选项生成后续剧情"
            >
              <GitBranch className="h-3 w-3" /> AI 分支回应
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="block text-xs font-medium text-dream-500">
              {card.lensType === 'narration' ? '旁白文字' : card.lensType === 'thought' ? '心理描写' : card.lensType === 'memory' ? '回忆文字' : card.lensType === 'system' ? '系统提示' : '台词'}
            </label>
            <TemplateSelect templates={storyTemplates} onApply={applyTemplate} label="套用剧情素材" />
          </div>
          <textarea
            value={localText}
            onChange={(e) => setLocalText(e.target.value)}
            onBlur={() => {
              if (localText !== card.text) onUpdate({ text: localText })
            }}
            rows={3}
            placeholder="输入台词内容..."
            className="w-full resize-none rounded-lg border border-dream-200 bg-white px-3 py-2 text-sm text-dream-800 focus:border-dream-500 focus:outline-none"
          />
          <div className="mt-1.5 flex items-center gap-1.5">
            <button
              onClick={() => {
                if (localText !== card.text) onUpdate({ text: localText })
                onRequestAI('polish')
              }}
              className="flex items-center gap-1 rounded-md bg-dream-100 px-2 py-1 text-xs text-dream-700 transition hover:bg-dream-200"
              title="使用 AI 润色当前台词"
            >
              <Wand2 className="h-3 w-3" /> AI 润色
            </button>
            <button
              onClick={() => onRequestAI('continue')}
              className="flex items-center gap-1 rounded-md bg-dream-100 px-2 py-1 text-xs text-dream-700 transition hover:bg-dream-200"
              title="使用 AI 续写下一句"
            >
              <Sparkles className="h-3 w-3" /> AI 续写
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
