import { useEffect, useState } from 'react'
import { BookOpen, Save } from 'lucide-react'
import type { StoryBibleCharacterNote, StoryBibleContent } from '../api/client'

export type { StoryBibleContent } from '../api/client'

const EMPTY_NOTE: StoryBibleCharacterNote = { goal: '', secret: '', voice: '', relations: '' }

function splitList(value: string): string[] {
  return value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean)
}

interface StoryBiblePanelProps {
  initialValue: StoryBibleContent
  characters: Array<{ id: string; name: string }>
  onSave: (content: StoryBibleContent) => void | Promise<void>
  isSaving?: boolean
}

export default function StoryBiblePanel({ initialValue, characters, onSave, isSaving = false }: StoryBiblePanelProps) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => setValue(initialValue), [initialValue])

  const updateNote = (characterId: string, changes: Partial<StoryBibleCharacterNote>) => {
    setValue((current) => ({
      ...current,
      characterNotes: {
        ...current.characterNotes,
        [characterId]: { ...(current.characterNotes[characterId] ?? EMPTY_NOTE), ...changes },
      },
    }))
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); void onSave(value) }} className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-sky-100 bg-sky-50 p-3 text-sky-900">
        <BookOpen className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-xs leading-5">这些约束会随项目保存，并在创作 Agent 工作时作为最高优先级的故事上下文。</p>
      </div>

      <TextArea label="世界观摘要" value={value.worldSummary} rows={4} onChange={(worldSummary) => setValue((current) => ({ ...current, worldSummary }))} />
      <TextInput label="叙事主题" hint="用逗号分隔" value={value.themes.join('，')} onChange={(themes) => setValue((current) => ({ ...current, themes: splitList(themes) }))} />
      <TextArea label="文风说明" value={value.styleGuide} rows={3} onChange={(styleGuide) => setValue((current) => ({ ...current, styleGuide }))} />
      <TextArea label="时间与地点规则" value={value.timelineRules} rows={3} onChange={(timelineRules) => setValue((current) => ({ ...current, timelineRules }))} />
      <TextArea label="禁止事项" hint="每行一项，也可用逗号分隔" value={value.forbiddenElements.join('\n')} rows={3} onChange={(raw) => setValue((current) => ({ ...current, forbiddenElements: splitList(raw) }))} />

      {characters.length > 0 && (
        <section className="space-y-3 border-t border-slate-200 pt-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">角色叙事约束</h4>
            <p className="mt-1 text-xs text-slate-500">只补充创作约束，姓名和立绘仍由角色库管理。</p>
          </div>
          {characters.map((character) => {
            const note = value.characterNotes[character.id] ?? EMPTY_NOTE
            return (
              <fieldset key={character.id} className="space-y-3 border-t border-slate-100 pt-3">
                <legend className="pr-2 text-sm font-medium text-dream-700">{character.name}</legend>
                <TextInput label={`${character.name}的角色目标`} value={note.goal} onChange={(goal) => updateNote(character.id, { goal })} />
                <TextInput label="秘密或未公开信息" value={note.secret} onChange={(secret) => updateNote(character.id, { secret })} />
                <TextInput label="语言习惯" value={note.voice} onChange={(voice) => updateNote(character.id, { voice })} />
                <TextInput label="关键关系" value={note.relations} onChange={(relations) => updateNote(character.id, { relations })} />
              </fieldset>
            )
          })}
        </section>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-lg bg-dream-600 px-4 py-2 text-sm font-medium text-white hover:bg-dream-700 disabled:opacity-50">
          <Save className="h-4 w-4" /> {isSaving ? '保存中' : '保存故事圣经'}
        </button>
      </div>
    </form>
  )
}

function TextInput({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      <span>{label}</span>{hint && <span className="ml-2 text-xs font-normal text-slate-400">{hint}</span>}
      <input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-dream-500 focus:outline-none focus:ring-2 focus:ring-dream-500/20" />
    </label>
  )
}

function TextArea({ label, hint, value, rows, onChange }: { label: string; hint?: string; value: string; rows: number; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      <span>{label}</span>{hint && <span className="ml-2 text-xs font-normal text-slate-400">{hint}</span>}
      <textarea aria-label={label} value={value} rows={rows} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 focus:border-dream-500 focus:outline-none focus:ring-2 focus:ring-dream-500/20" />
    </label>
  )
}
