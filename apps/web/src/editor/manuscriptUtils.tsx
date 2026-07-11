/**
 * manuscriptUtils.tsx — 长文导入与模板工具
 *
 * 从 ShotCardEditor.tsx 中提取的稿件导入相关组件与工具函数。
 */

import { useState, useMemo } from 'react'
import { X } from 'lucide-react'
import { type ShotCard, type LensType } from './sceneGraph'
import { loadLibraryCharacters, type StoryTemplate } from '../lib/libraryData'
import { parseManuscript } from './manuscriptParser'

export function ManuscriptImporter({
  characters,
  onClose,
  onImport,
}: {
  characters: ReturnType<typeof loadLibraryCharacters>
  onClose: () => void
  onImport: (text: string) => number
}) {
  const [text, setText] = useState('')
  const [message, setMessage] = useState('')
  const previewCount = useMemo(() => parseManuscriptTextUnits(text).length, [text])
  const characterNames = characters.slice(0, 8).map((character) => character.name).join('、')

  const handleImport = () => {
    const count = onImport(text)
    if (count <= 0) {
      setMessage('没有识别到可导入的正文。可以粘贴“角色：台词”或普通小说段落。')
      return
    }
    setMessage(`已导入 ${count} 张镜头卡，可以关闭面板继续编辑。`)
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-sm">
      <section className="w-full max-w-2xl overflow-hidden rounded-xl border border-dream-100 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-dream-100 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-dream-900">导入长篇文本</h3>
            <p className="mt-1 text-xs text-dream-500">把小说正文快速拆成视觉小说镜头卡，再逐张精修背景、角色和分支。</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-dream-400 transition hover:bg-dream-50 hover:text-dream-700">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-3 px-5 py-4">
          <div className="grid gap-2 rounded-lg border border-dream-100 bg-dream-50/40 p-3 text-xs text-dream-600 sm:grid-cols-2">
            <p>识别规则：<span className="font-medium text-dream-800">角色：台词</span> 会变成角色对话。</p>
            <p>普通段落会变成旁白，含“心想/回忆”等词会自动标记镜头类型。</p>
            <p>当前素材角色：{characterNames || '暂无角色素材'}</p>
            <p>预计生成：<span className="font-semibold text-dream-700">{previewCount}</span> 张镜头卡</p>
          </div>
          <textarea
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              setMessage('')
            }}
            rows={13}
            placeholder={'示例：\n雪：我好像又听见那个声音了。\n\n她伸手碰向空气中微亮的节点，街道的喧闹突然像被拉远。\n\n影：不是你认识的人。是你还没删掉的人。'}
            className="w-full resize-none rounded-xl border border-dream-200 bg-white px-3 py-2.5 text-sm leading-7 text-dream-900 outline-none transition focus:border-dream-500"
          />
          {message && <p className="rounded-lg bg-dream-50 px-3 py-2 text-xs text-dream-600">{message}</p>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-dream-100 px-5 py-4">
          <button onClick={onClose} className="rounded-lg border border-dream-200 bg-white px-4 py-2 text-sm text-dream-600 transition hover:bg-dream-50">
            关闭
          </button>
          <button onClick={handleImport} className="rounded-lg bg-dream-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-dream-700">
            导入为镜头卡
          </button>
        </footer>
      </section>
    </div>
  )
}

export function parseManuscriptToShotCards(text: string, options: {
  sceneGroupId: string
  sceneCode: string
  background: string
  characters: ReturnType<typeof loadLibraryCharacters>
}): ShotCard[] {
  const units = parseManuscript(text, options.characters.flatMap((character) => [character.id, character.name]))
    .chapters.flatMap((chapter) => chapter.scenes).flatMap((scene) => scene.cards).slice(0, 160)
  const timestamp = Date.now()

  return units.map((unit, index) => {
    const rawSpeaker = unit.speaker
    const spokenText = unit.text
    const matchedCharacter = rawSpeaker
      ? options.characters.find((character) => character.name === rawSpeaker || character.id === rawSpeaker)
      : undefined

    if (matchedCharacter && spokenText) {
      return {
        id: `card-import-${timestamp}-${index}`,
        sceneId: options.sceneGroupId,
        type: 'dialogue',
        lensType: 'dialogue',
        background: options.background,
        characters: [],
        speaker: matchedCharacter.id,
        speakerExpression: matchedCharacter.defaultExpression || 'normal',
        speakerPosition: index % 3 === 1 ? 'left' : index % 3 === 2 ? 'right' : 'center',
        autoStageSpeaker: true,
        text: spokenText,
        sceneCode: options.sceneCode,
        sceneGroupId: options.sceneGroupId,
        nodeIds: [],
      }
    }

    return {
      id: `card-import-${timestamp}-${index}`,
      sceneId: options.sceneGroupId,
      type: 'narration',
      lensType: unit.lensType,
      background: options.background,
      characters: [],
      speaker: '旁白',
      speakerExpression: 'normal',
      speakerPosition: 'center',
      autoStageSpeaker: false,
      text: unit.kind === 'dialogue' && rawSpeaker ? `${rawSpeaker}：${unit.text}` : unit.text,
      sceneCode: options.sceneCode,
      sceneGroupId: options.sceneGroupId,
      nodeIds: [],
    }
  })
}

export function parseManuscriptTextUnits(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .flatMap((paragraph) => paragraph.split('\n'))
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => splitLongNarration(line))
    .map((line) => line.trim())
    .filter(Boolean)
}

export function splitLongNarration(line: string) {
  if (line.length <= 90 || /^([^：:\n]{1,16})[：:]/.test(line)) return [line]
  const parts = line.match(/[^。！？!?；;]+[。！？!?；;]?/g)
  if (!parts || parts.length <= 1) return [line]
  const result: string[] = []
  let buffer = ''
  parts.forEach((part) => {
    if ((buffer + part).length > 90 && buffer) {
      result.push(buffer)
      buffer = part
    } else {
      buffer += part
    }
  })
  if (buffer) result.push(buffer)
  return result
}

export function inferNarrationLens(line: string): LensType {
  if (/回忆|想起|那年|曾经|小时候|梦里|过去/.test(line)) return 'memory'
  if (/心想|心里|暗想|自言自语|她想|他想|我想/.test(line)) return 'thought'
  if (/系统|提示|警告|权限|错误/.test(line)) return 'system'
  return 'narration'
}

export function TemplateSelect({ templates, label, onApply }: { templates: StoryTemplate[]; label: string; onApply: (templateId: string) => void }) {
  if (templates.length === 0) return null
  return (
    <select
      defaultValue=""
      onChange={(event) => {
        if (event.target.value) onApply(event.target.value)
        event.currentTarget.value = ''
      }}
      className="max-w-[180px] rounded-md border border-dream-200 bg-white px-2 py-1 text-xs text-dream-600"
      title={label}
    >
      <option value="">{label}</option>
      {templates.map((template) => (
        <option key={template.id} value={template.id}>{template.title}</option>
      ))}
    </select>
  )
}

export function extractChoicesFromTemplate(content: string) {
  const lines = content.split('\n').map((line) => line.trim()).filter(Boolean)
  const choices = lines
    .filter((line) => /^(选项|[A-D][：:、.)]|[-*])/.test(line))
    .map((line) => line.replace(/^(选项\s*)?[A-D]?[：:、.)\-\s]*/, '').slice(0, 42))
    .filter(Boolean)
  if (choices.length > 0) return choices.slice(0, 4)
  return lines.slice(0, 3).map((line) => line.slice(0, 42))
}
