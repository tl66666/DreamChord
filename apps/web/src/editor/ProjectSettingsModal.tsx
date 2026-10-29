import { useEffect, useState } from 'react'
import { getStoryBible, updateStoryBible, type StoryBibleContent } from '../api/client'
import type { ProjectData } from '../stores/editorStore'
import { useConfirm } from '../components/FeedbackProvider'
import LibraryDialog from '../library/LibraryDialog'
import ProjectDetailsForm from './ProjectDetailsForm'
import StoryBiblePanel from './StoryBiblePanel'

export default function ProjectSettingsModal({ project, characters = [], onClose, onUpdate }: {
  project: ProjectData | null; characters?: Array<{ id: string; name: string }>
  onClose: () => void; onUpdate: (data: Partial<ProjectData>) => Promise<void> | void
}) {
  const confirm = useConfirm()
  const [tab, setTab] = useState<'project' | 'storyBible'>('project')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [storyBible, setStoryBible] = useState<StoryBibleContent | null>(null)
  const [loadingBible, setLoadingBible] = useState(false)
  const [savingBible, setSavingBible] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const requestClose = async () => {
    if (busy || savingBible) return
    if (dirty && !await confirm({ message: '还有未保存的故事设置，要放弃修改并返回吗？' })) return
    onClose()
  }
  useEffect(() => {
    if (tab !== 'storyBible' || !project?.id) return
    let active = true
    setLoadingBible(true); setMessage('')
    getStoryBible(project.id).then((response) => { if (active) setStoryBible(response.content) }).catch(() => { if (active) { setMessage('故事圣经暂时无法读取，请重试。'); setError(true) } }).finally(() => { if (active) setLoadingBible(false) })
    return () => { active = false }
  }, [tab, project?.id, retry])
  if (!project) return null
  return <LibraryDialog wide title="故事设置" description="整理故事信息、挑选封面，并为作品设置默认的文字和配音语言。" busy={busy || savingBible} onClose={() => void requestClose()}>
    <div role="tablist" aria-label="故事设置分类" className="mb-6 flex gap-2 border-b border-slate-100 pb-3">{(['project', 'storyBible'] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={tab === value} disabled={busy || savingBible} onClick={async () => {
      if (tab === value) return
      if (dirty && !await confirm({ message: '切换分类会放弃未保存的故事设置，继续吗？' })) return
      setDirty(false); setTab(value)
    }} className={`min-h-10 rounded-xl px-4 text-sm font-medium ${tab === value ? 'bg-dream-50 text-dream-700' : 'text-slate-500 hover:bg-slate-50'}`}>{value === 'project' ? '封面与语言' : '故事圣经'}</button>)}</div>
    {tab === 'project' ? <ProjectDetailsForm project={project} onDirtyChange={setDirty} onBusyChange={setBusy} onCancel={() => void requestClose()} onSave={onUpdate} /> : <div>
      {message && <p role={error ? 'alert' : 'status'} className={`mb-4 rounded-xl p-3 text-sm ${error ? 'bg-rose-50 text-rose-700' : 'bg-green-50 text-green-700'}`}>{message}{error && !storyBible && <button onClick={() => setRetry((value) => value + 1)} className="ml-3 underline">重试</button>}</p>}
      {loadingBible && <p className="py-10 text-center text-sm text-slate-500">正在读取故事圣经…</p>}
      {!loadingBible && storyBible && <StoryBiblePanel initialValue={storyBible} characters={characters} isSaving={savingBible} onSave={async (content) => {
        setSavingBible(true); setMessage('')
        try { const saved = await updateStoryBible(project.id, content); setStoryBible(saved.content); setMessage('故事圣经已保存'); setError(false) }
        catch { setMessage('保存失败，修改仍保留在当前表单中，请重试。'); setError(true) }
        finally { setSavingBible(false) }
      }} />}
    </div>}
  </LibraryDialog>
}
