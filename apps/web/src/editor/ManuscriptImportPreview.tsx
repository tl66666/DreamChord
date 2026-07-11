import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, FileText, X } from 'lucide-react'
import { parseManuscript } from './manuscriptParser'
import { loadLibraryCharacters } from '../lib/libraryData'

export default function ManuscriptImportPreview({ characters, onClose, onImport }: {
  characters: ReturnType<typeof loadLibraryCharacters>
  onClose: () => void
  onImport: (text: string) => number
}) {
  const [text, setText] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [openScene, setOpenScene] = useState('0:0')
  const preview = useMemo(() => parseManuscript(text, characters.flatMap((character) => [character.id, character.name])), [characters, text])
  const scenes = preview.chapters.flatMap((chapter) => chapter.scenes)
  const cardCount = scenes.reduce((total, scene) => total + scene.cards.length, 0)

  const confirmImport = () => {
    if (onImport(text) > 0) onClose()
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <section aria-label="稿件导入预览" className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="text-base font-semibold text-slate-950">导入长篇稿件</h2><p className="mt-1 text-xs text-slate-500">先检查章节、场景、角色与镜头拆分，再一次性导入。</p></div><button type="button" aria-label="关闭导入" title="关闭" onClick={onClose}><X className="h-4 w-4" /></button></header>
        {!reviewing ? <div className="min-h-0 flex-1 p-5">
          <textarea aria-label="稿件正文" value={text} onChange={(event) => setText(event.target.value)} rows={16} placeholder={'第一章 冬夜\n场景：车站\n雪：你听见了吗？\n[回忆] 她想起十年前的约定。'} className="h-full min-h-[320px] w-full resize-none border border-slate-200 p-3 text-sm leading-7 outline-none focus:border-cyan-600" />
        </div> : <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-3 border border-slate-200 bg-slate-50 text-center"><div className="p-3"><strong className="block text-lg text-slate-950">{preview.chapters.length}</strong><span className="text-[11px] text-slate-500">章节</span></div><div className="border-x border-slate-200 p-3"><strong className="block text-lg text-slate-950">{scenes.length}</strong><span className="text-[11px] text-slate-500">场景</span></div><div className="p-3"><strong className="block text-lg text-slate-950">{cardCount}</strong><span className="text-[11px] text-slate-500">镜头卡</span></div></div>
          {preview.warnings.length > 0 && <div className="mt-3 border border-amber-200 bg-amber-50 p-3"><h3 className="flex items-center gap-1.5 text-xs font-semibold text-amber-800"><AlertTriangle className="h-3.5 w-3.5" />需要检查</h3>{preview.warnings.map((warning, index) => <p key={`${warning.line}-${index}`} className="mt-1 text-xs text-amber-700">{warning.line ? `第 ${warning.line} 行：` : ''}{warning.message}</p>)}</div>}
          <div className="mt-4 space-y-2">{preview.chapters.map((chapter, chapterIndex) => <section key={`${chapter.title}-${chapterIndex}`}><h3 className="mb-2 text-xs font-semibold text-slate-800">{chapter.title}</h3>{chapter.scenes.map((scene, sceneIndex) => { const key = `${chapterIndex}:${sceneIndex}`; const open = openScene === key; return <div key={key} className="border border-slate-200"><button type="button" onClick={() => setOpenScene(open ? '' : key)} className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-slate-700"><span>{scene.title} · {scene.cards.length} 张</span><ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} /></button>{open && <div className="border-t border-slate-100 px-3 py-2">{scene.cards.map((card, index) => <p key={`${card.line}-${index}`} className="border-b border-slate-50 py-1.5 text-xs leading-5 text-slate-600 last:border-0"><span className="mr-2 font-mono text-slate-400">{index + 1}</span>{card.speaker ? `${card.speaker}：` : ''}{card.text}<span className="ml-2 text-[10px] text-cyan-700">{card.lensType}</span></p>)}</div>}</div>})}</section>)}</div>
        </div>}
        <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-4"><p className="flex items-center gap-1.5 text-xs text-slate-500"><FileText className="h-3.5 w-3.5" />导入会作为一次编辑操作，可直接撤销。</p><div className="flex gap-2">{reviewing && <button type="button" onClick={() => setReviewing(false)} className="h-9 border border-slate-200 px-4 text-sm text-slate-700">返回修改</button>}<button type="button" disabled={!text.trim() || cardCount === 0} onClick={() => reviewing ? confirmImport() : setReviewing(true)} className="h-9 bg-slate-950 px-4 text-sm font-medium text-white disabled:opacity-40">{reviewing ? '确认导入' : '生成预览'}</button></div></footer>
      </section>
    </div>
  )
}
