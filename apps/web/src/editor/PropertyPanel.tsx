import { useMemo } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { loadLibraryCharacters, loadLibraryScenes, loadStoryTemplates } from '../lib/libraryData'
import { getNodeData } from './sceneGraph'

interface PropertyPanelProps {
  onOpenAssetPicker?: (
    nodeId: string,
    field: 'backgroundId' | 'characterId',
  ) => void
}

export default function PropertyPanel({ onOpenAssetPicker }: PropertyPanelProps) {
  const { nodes, selectedNodeId, updateNodeData, setSelectedNodeId } = useEditorStore()
  const selectedNode = nodes.find((node) => node.id === selectedNodeId)
  const characters = useMemo(() => loadLibraryCharacters(), [])
  const scenes = useMemo(() => loadLibraryScenes(), [])
  const storyTemplates = useMemo(() => loadStoryTemplates(), [])

  if (!selectedNode) {
    return (
      <div className="w-80 border-l border-dream-200 bg-white/90 p-4 backdrop-blur-sm">
        <div className="flex h-full flex-col items-center justify-center text-center">
          <img src="/assets/illustrations/empty-nodes.png" alt="未选择节点" className="mb-4 h-32 w-32 object-contain opacity-70" />
          <p className="text-sm text-dream-600">在逻辑图或场景编辑里选择一个节点后，可以在这里编辑属性。</p>
        </div>
      </div>
    )
  }

  const { type, data } = selectedNode
  const activeCharacter = characters.find((character) => character.id === data.characterId || character.name === data.role)
  const activeExpression = activeCharacter?.expressions.find((expression) => expression.id === data.expression) || activeCharacter?.expressions[0]
  const activeScene = scenes.find((scene) => scene.url === data.backgroundId || scene.id === data.backgroundId)

  return (
    <div className="w-80 overflow-y-auto border-l border-dream-200 bg-white/90 p-4 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-dream-800">{nodeLabel(type || '')}</h3>
        <button onClick={() => setSelectedNodeId(null)} className="text-xs text-dream-500 hover:text-dream-700">关闭</button>
      </div>

      {type === 'dialogue' && (
        <div className="space-y-4">
          <Field label="角色">
            <select value={(data.role as string) || ''} onChange={(event) => updateNodeData(selectedNode.id, { role: event.target.value })} className={controlClass}>
              <option value="">选择角色</option>
              {characters.map((character) => <option key={character.id} value={character.id}>{character.name} · {character.role}</option>)}
              <option value="旁白">旁白</option>
            </select>
          </Field>
          {activeCharacter && <LibraryHint title={activeCharacter.name} text={`${activeCharacter.outline}\n${activeCharacter.conflicts.join('\n')}`} />}
          <TemplatePicker
            templates={storyTemplates}
            onApply={(template) => updateNodeData(selectedNode.id, { text: template.content })}
          />
          <Field label="内容">
            <textarea value={(data.text as string) || ''} onChange={(event) => updateNodeData(selectedNode.id, { text: event.target.value })} rows={7} className={`${controlClass} resize-none`} />
          </Field>
        </div>
      )}

      {type === 'choice' && (
        <div className="space-y-4">
          <Field label="选项列表">
            {((data.choices as string[]) || []).map((choice, index) => (
              <div key={`choice-${index}`} className="mb-2 flex items-center gap-2">
                <span className="text-xs text-dream-500">{index + 1}</span>
                <input value={choice} onChange={(event) => {
                  const next = [...((data.choices as string[]) || [])]
                  next[index] = event.target.value
                  updateNodeData(selectedNode.id, { choices: next })
                }} className={controlClass} />
              </div>
            ))}
            <button onClick={() => updateNodeData(selectedNode.id, { choices: [...((data.choices as string[]) || []), '新选项'] })} className="mt-2 w-full rounded-lg border border-dashed border-dream-300 py-1.5 text-xs text-dream-600 hover:border-dream-500">+ 添加选项</button>
          </Field>
          <TemplatePicker templates={storyTemplates} onApply={(template) => updateNodeData(selectedNode.id, { choices: extractChoices(template.content) })} />
        </div>
      )}

      {type === 'background' && (
        <div className="space-y-4">
          <Field label="素材库场景">
            <select value={(data.backgroundId as string) || ''} onChange={(event) => updateNodeData(selectedNode.id, { backgroundId: event.target.value })} className={controlClass}>
              <option value="">选择场景</option>
              {scenes.map((scene) => <option key={scene.id} value={scene.url}>{scene.name} · {scene.type}</option>)}
            </select>
          </Field>
          {activeScene && <LibraryHint title={activeScene.name} text={`${activeScene.description}\n用途：${activeScene.usage}`} />}
          {(data.backgroundId as string) && <img src={data.backgroundId as string} alt="背景预览" className="h-28 w-full rounded-lg object-cover" />}
          <button onClick={() => onOpenAssetPicker?.(selectedNode.id, 'backgroundId')} className="w-full rounded-lg border border-dashed border-dream-300 py-1.5 text-xs text-dream-600">从项目上传素材选择</button>
        </div>
      )}

      {type === 'character' && (
        <div className="space-y-4">
          <Field label="素材库角色">
            <select value={(data.characterId as string) || ''} onChange={(event) => {
              const character = characters.find((item) => item.id === event.target.value)
              updateNodeData(selectedNode.id, { characterId: event.target.value, expression: character?.defaultExpression || 'normal' })
            }} className={controlClass}>
              <option value="">选择角色</option>
              {characters.map((character) => <option key={character.id} value={character.id}>{character.name} · {character.role}</option>)}
            </select>
          </Field>
          {activeCharacter && (
            <>
              <LibraryHint title={activeCharacter.name} text={`${activeCharacter.biography}\n\n大纲：${activeCharacter.outline}`} />
              <Field label="立绘状态">
                <select value={(data.expression as string) || activeCharacter.defaultExpression} onChange={(event) => updateNodeData(selectedNode.id, { expression: event.target.value })} className={controlClass}>
                  {activeCharacter.expressions.map((expression) => <option key={expression.id} value={expression.id}>{expression.label}</option>)}
                </select>
              </Field>
              <img src={activeExpression?.url} alt={activeCharacter.name} className="mx-auto h-40 object-contain" />
            </>
          )}
          <Field label="位置">
            <select value={(data.position as string) || 'center'} onChange={(event) => updateNodeData(selectedNode.id, { position: event.target.value })} className={controlClass}>
              <option value="left">左侧</option>
              <option value="center">中间</option>
              <option value="right">右侧</option>
            </select>
          </Field>
          <Field label="动作">
            <select value={(data.action as string) || 'show'} onChange={(event) => updateNodeData(selectedNode.id, { action: event.target.value })} className={controlClass}>
              <option value="show">登场</option>
              <option value="hide">退场</option>
              <option value="move">移动</option>
            </select>
          </Field>
          <button onClick={() => onOpenAssetPicker?.(selectedNode.id, 'characterId')} className="w-full rounded-lg border border-dashed border-dream-300 py-1.5 text-xs text-dream-600">从项目上传素材选择</button>
        </div>
      )}

      {type === 'subtitle' && (
        <div className="space-y-4">
          <TemplatePicker templates={storyTemplates} onApply={(template) => updateNodeData(selectedNode.id, { text: template.content })} />
          <Field label="旁白内容">
            <textarea value={(data.text as string) || ''} onChange={(event) => updateNodeData(selectedNode.id, { text: event.target.value })} rows={6} className={`${controlClass} resize-none`} />
          </Field>
        </div>
      )}

      {!['dialogue', 'choice', 'background', 'character', 'subtitle'].includes(type || '') && <GenericEditor data={getNodeData(selectedNode)} onUpdate={(patch) => updateNodeData(selectedNode.id, patch)} />}
    </div>
  )
}

const controlClass = 'w-full rounded-lg border border-dream-200 px-3 py-2 text-sm focus:border-dream-500 focus:outline-none focus:ring-2 focus:ring-dream-500/20'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1.5 block text-xs font-medium text-dream-700">{label}</label>{children}</div>
}

function LibraryHint({ title, text }: { title: string; text: string }) {
  return <div className="rounded-lg bg-dream-50 p-3 text-xs leading-5 text-dream-700"><p className="mb-1 font-semibold text-dream-900">{title}</p><p className="whitespace-pre-wrap">{text}</p></div>
}

function TemplatePicker({ templates, onApply }: { templates: ReturnType<typeof loadStoryTemplates>; onApply: (template: ReturnType<typeof loadStoryTemplates>[number]) => void }) {
  return (
    <Field label="套用剧情素材">
      <select defaultValue="" onChange={(event) => {
        const template = templates.find((item) => item.id === event.target.value)
        if (template) onApply(template)
        event.currentTarget.value = ''
      }} className={controlClass}>
        <option value="">选择一个剧情素材套入</option>
        {templates.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}
      </select>
    </Field>
  )
}

function GenericEditor({ data, onUpdate }: { data: Record<string, unknown>; onUpdate: (patch: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-4">
      {Object.entries(data).map(([key, value]) => (
        <Field key={key} label={key}>
          <input value={String(value ?? '')} onChange={(event) => onUpdate({ [key]: event.target.value })} className={controlClass} />
        </Field>
      ))}
    </div>
  )
}

function extractChoices(content: string) {
  const lines = content.split('\n').map((line) => line.trim()).filter(Boolean)
  const choices = lines
    .filter((line) => /^(选项|A|B|C|D|[-*])/.test(line))
    .map((line) => line.replace(/^(选项\s*)?[A-D]?[：:、.)\-\s]*/, '').slice(0, 42))
    .filter(Boolean)
  return choices.length > 0 ? choices.slice(0, 4) : ['相信对方', '保持怀疑', '触碰节点']
}

function nodeLabel(type: string) {
  return ({
    dialogue: '对话节点',
    choice: '选项节点',
    background: '背景节点',
    character: '角色登场',
    transition: '转场节点',
    subtitle: '旁白节点',
    delay: '等待节点',
    condition: '条件判断',
    setVariable: '设置变量',
    jump: '跳转节点',
  } as Record<string, string>)[type] || '节点属性'
}
