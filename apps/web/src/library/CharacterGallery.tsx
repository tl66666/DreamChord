import { useEffect, useState, type ReactNode } from 'react'
import { Edit3, Eye, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import type { LibraryCharacter } from '../lib/libraryData'
import StageCharacters from '../stage/StageCharacters'
import type { StagePreviewMode } from '../stage/stagePresentation'

interface CharacterGalleryProps {
  characters: LibraryCharacter[]
  selectedExpression: Record<string, string>
  onSelectExpression: (characterId: string, expressionId: string) => void
  onCreate: () => void
  onEdit: (character: LibraryCharacter) => void
  onDelete: (id: string) => void
  onReset: () => void
  editor?: ReactNode
}

const previewOptions: { id: StagePreviewMode; label: string }[] = [
  { id: 'full', label: '全身' },
  { id: 'bust', label: '半身' },
  { id: 'stage', label: '舞台' },
]

export default function CharacterGallery({
  characters,
  selectedExpression,
  onSelectExpression,
  onCreate,
  onEdit,
  onDelete,
  onReset,
  editor,
}: CharacterGalleryProps) {
  const [previewModes, setPreviewModes] = useState<Record<string, StagePreviewMode>>({})
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const selectedCharacter = characters.find((character) => character.id === selectedCharacterId) || null

  useEffect(() => {
    if (!selectedCharacter) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedCharacterId(null)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedCharacter])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-dream-600">
            Character archive <span className="h-px w-8 bg-dream-300" /> {characters.length} 位角色
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">角色立绘与设定</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">卡片优先展示立绘；人物小传、故事弧光和戏剧冲突收进详情面板，需要时再展开。</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={onReset} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-500">
            <RotateCcw className="h-4 w-4" />恢复默认
          </button>
          <button type="button" onClick={onCreate} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-dream-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-500 focus-visible:ring-offset-2">
            <Plus className="h-4 w-4" />新增角色
          </button>
        </div>
      </div>

      {editor}

      <div data-testid="character-gallery" className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {characters.map((character) => {
          const expression = character.expressions.find((item) => item.id === (selectedExpression[character.id] || character.defaultExpression)) || character.expressions[0]
          const previewMode = previewModes[character.id] || 'full'
          return (
            <article key={character.id} data-testid={`character-card-${character.id}`} className="group overflow-hidden rounded-[22px] border border-slate-200/90 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:border-dream-200 hover:shadow-[0_22px_55px_rgba(88,68,180,0.12)]">
              <div
                data-testid={`character-preview-${character.id}`}
                data-preview-mode={previewMode}
                className={`relative aspect-[4/5] overflow-hidden border-b ${previewMode === 'stage' ? 'border-dream-200 bg-[url(/assets/backgrounds/bg-classroom.png)] bg-cover bg-center' : 'border-slate-200 bg-[radial-gradient(circle_at_50%_20%,#ffffff_0%,#f1f5f9_48%,#dbe3ec_100%)]'}`}
              >
                <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4">
                  <span className="rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">{character.role || '未设定'}</span>
                  <span className="rounded-full border border-white/60 bg-slate-950/65 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">{character.expressions.length} 个表情</span>
                </div>
                {previewMode === 'stage' && <div className="absolute inset-0 bg-gradient-to-b from-slate-950/5 via-transparent to-slate-950/70" />}
                <StageCharacters
                  mode={previewMode}
                  characters={[{ id: character.id, state: expression?.id || character.defaultExpression, position: 'center', customUrl: expression?.url || '/assets/characters/default-avatar.png' }]}
                  speakerId={character.id}
                  resolveName={() => character.name}
                />
                {previewMode === 'stage' && <div className="absolute inset-x-4 bottom-4 z-30 rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-[11px] text-white/65 backdrop-blur-md">台词安全区</div>}
              </div>

              <div role="group" aria-label={`${character.name}立绘预览模式`} className="mx-4 -mt-5 relative z-30 grid grid-cols-3 rounded-xl border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10">
                {previewOptions.map((option) => (
                  <button key={option.id} type="button" aria-pressed={previewMode === option.id} onClick={() => setPreviewModes((current) => ({ ...current, [character.id]: option.id }))} className={`min-h-9 rounded-lg px-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-500 ${previewMode === option.id ? 'bg-dream-50 text-dream-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="p-5 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-slate-100" style={{ backgroundColor: character.color }} />
                      <h3 className="truncate text-xl font-bold tracking-tight text-slate-950">{character.name}</h3>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{character.id} · 更新 {character.updatedAt}</p>
                  </div>
                  <button type="button" onClick={() => window.open(expression?.url, '_blank')} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-dream-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-500" title="查看原图" aria-label={`查看${character.name}原图`}>
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-3 line-clamp-2 min-h-12 text-sm leading-6 text-slate-600">{character.description || '暂未填写角色简介。'}</p>
                <button type="button" onClick={() => setSelectedCharacterId(character.id)} aria-label={`查看${character.name}的完整设定`} className="mt-4 flex min-h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 transition hover:border-dream-200 hover:bg-dream-50 hover:text-dream-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-500">
                  查看完整设定 <span aria-hidden="true">→</span>
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {selectedCharacter && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-slate-950/55 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedCharacterId(null) }}>
          <section role="dialog" aria-modal="true" aria-label={`${selectedCharacter.name} · 角色详情`} className="h-full w-full overflow-y-auto bg-[#fbfaf7] shadow-2xl sm:max-w-[720px]">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/80 bg-[#fbfaf7]/92 px-5 py-4 backdrop-blur-xl sm:px-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dream-600">Character dossier</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">{selectedCharacter.name} · 角色详情</h2>
              </div>
              <button type="button" onClick={() => setSelectedCharacterId(null)} aria-label="关闭角色详情" className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-500"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-6 p-5 sm:p-8">
              <div className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-[180px_1fr]">
                <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-gradient-to-b from-slate-100 to-slate-300">
                  <img src={(selectedCharacter.expressions.find((item) => item.id === (selectedExpression[selectedCharacter.id] || selectedCharacter.defaultExpression)) || selectedCharacter.expressions[0])?.url} alt={selectedCharacter.name} className="h-full w-full object-contain object-bottom" />
                </div>
                <div className="min-w-0">
                  <span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: selectedCharacter.color }}>{selectedCharacter.role}</span>
                  <p className="mt-4 text-base leading-7 text-slate-700">{selectedCharacter.description}</p>
                  <p className="mt-4 text-xs text-slate-400">ID {selectedCharacter.id} · 更新于 {selectedCharacter.updatedAt}</p>
                </div>
              </div>

              <DossierBlock index="01" title="人物小传" text={selectedCharacter.biography} />
              <DossierBlock index="02" title="故事弧光" text={selectedCharacter.outline} />
              <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">03 · 戏剧冲突</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-rose-900">{selectedCharacter.conflicts.map((conflict) => <li key={conflict} className="flex gap-2"><span aria-hidden="true">◆</span><span>{conflict}</span></li>)}</ul>
              </div>
              <DossierBlock index="04" title="项目用途" text={selectedCharacter.usage} />

              <div>
                <p className="mb-3 text-sm font-bold text-slate-900">表情与立绘</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {selectedCharacter.expressions.map((item) => (
                    <button key={item.id} type="button" onClick={() => onSelectExpression(selectedCharacter.id, item.id)} className={`flex min-h-16 items-center gap-3 rounded-xl border p-2 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-500 ${selectedExpression[selectedCharacter.id] === item.id || (!selectedExpression[selectedCharacter.id] && selectedCharacter.defaultExpression === item.id) ? 'border-dream-300 bg-dream-50 text-dream-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                      <img src={item.url} alt="" className="h-12 w-12 rounded-lg bg-slate-100 object-contain" />{item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => { onDelete(selectedCharacter.id); setSelectedCharacterId(null) }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"><Trash2 className="h-4 w-4" />删除角色</button>
                <button type="button" onClick={() => { onEdit(selectedCharacter); setSelectedCharacterId(null) }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-dream-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-500"><Edit3 className="h-4 w-4" />编辑角色</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function DossierBlock({ index, title, text }: { index: string; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dream-600">{index} · {title}</p>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{text || '暂未填写。'}</p>
    </div>
  )
}
