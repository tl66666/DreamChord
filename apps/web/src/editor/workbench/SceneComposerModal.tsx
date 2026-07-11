import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { loadLibraryCharacters, loadLibraryScenes } from '../../lib/libraryData'
import { LENS_LABEL, LENS_TYPES } from './workbenchConstants'
import type { SceneCharacterDraft, SceneDraft } from './workbenchTypes'
import { normalizedSceneDraft } from './storyEditorGraph'

export default function SceneComposerModal({
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

export function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-dream-700">{label}</span>
      {children}
    </label>
  )
}
