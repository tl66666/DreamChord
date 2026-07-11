import { useEffect, useState } from 'react'
import { BookOpen, Settings2, X } from 'lucide-react'
import { getStoryBible, updateStoryBible, type StoryBibleContent } from '../api/client'
import type { ProjectData } from '../stores/editorStore'
import StoryBiblePanel from './StoryBiblePanel'

interface ProjectSettingsModalProps {
  project: ProjectData | null
  characters?: Array<{ id: string; name: string }>
  onClose: () => void
  onUpdate: (data: Partial<ProjectData>) => void
}

export default function ProjectSettingsModal({ project, characters = [], onClose, onUpdate }: ProjectSettingsModalProps) {
  const [tab, setTab] = useState<'project' | 'storyBible'>('project')
  const [storyBible, setStoryBible] = useState<StoryBibleContent | null>(null)
  const [loadingBible, setLoadingBible] = useState(false)
  const [savingBible, setSavingBible] = useState(false)
  const [bibleMessage, setBibleMessage] = useState('')

  useEffect(() => {
    if (tab !== 'storyBible' || !project?.id || storyBible || loadingBible) return
    setLoadingBible(true)
    setBibleMessage('')
    getStoryBible(project.id)
      .then((response) => setStoryBible(response.content))
      .catch((error: unknown) => setBibleMessage(error instanceof Error ? error.message : '故事圣经加载失败'))
      .finally(() => setLoadingBible(false))
  }, [tab, project?.id, storyBible, loadingBible])

  const handleProjectSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    onUpdate({
      title: String(formData.get('title') || ''),
      description: String(formData.get('description') || ''),
      cover: String(formData.get('cover') || ''),
      isPublic: formData.get('isPublic') === 'on',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg border border-dream-100 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-dream-900">项目设置</h3>
          <button onClick={onClose} title="关闭" className="rounded-lg p-1.5 text-dream-500 hover:bg-dream-50"><X className="h-5 w-5" /></button>
        </header>

        <nav className="flex border-b border-slate-200 px-6">
          <TabButton active={tab === 'project'} onClick={() => setTab('project')} icon={Settings2} label="项目信息" />
          <TabButton active={tab === 'storyBible'} onClick={() => setTab('storyBible')} icon={BookOpen} label="故事圣经" />
        </nav>

        <div className="max-h-[calc(90vh-122px)] overflow-y-auto p-6">
          {tab === 'project' ? (
            <form onSubmit={handleProjectSubmit} className="space-y-4">
              <Field label="项目名称"><input name="title" defaultValue={project?.title} required className={inputClass} /></Field>
              <Field label="简介"><textarea name="description" defaultValue={project?.description} rows={3} className={inputClass} /></Field>
              <Field label="封面 URL">
                <input name="cover" defaultValue={project?.cover} placeholder="/assets/covers/default-cover.png" className={inputClass} />
                {project?.cover && <img src={project.cover} alt="封面预览" className="mt-2 h-32 w-full rounded-lg object-cover" />}
              </Field>
              <label className="flex items-center gap-2 text-sm text-dream-700">
                <input name="isPublic" type="checkbox" defaultChecked={project?.isPublic} className="h-4 w-4 rounded border-dream-300 text-dream-600" />
                发布后允许他人查看
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onClose} className="rounded-lg border border-dream-200 px-4 py-2 text-sm font-medium text-dream-700 hover:bg-dream-50">取消</button>
                <button type="submit" className="rounded-lg bg-dream-600 px-4 py-2 text-sm font-medium text-white hover:bg-dream-700">保存项目信息</button>
              </div>
            </form>
          ) : (
            <div>
              {bibleMessage && <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${bibleMessage === '故事圣经已保存' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{bibleMessage}</p>}
              {loadingBible && <p className="py-10 text-center text-sm text-slate-500">正在加载故事圣经...</p>}
              {storyBible && project?.id && (
                <StoryBiblePanel
                  initialValue={storyBible}
                  characters={characters}
                  isSaving={savingBible}
                  onSave={async (content) => {
                    setSavingBible(true)
                    setBibleMessage('')
                    try {
                      const saved = await updateStoryBible(project.id, content)
                      setStoryBible(saved.content)
                      setBibleMessage('故事圣经已保存')
                    } catch (error: unknown) {
                      setBibleMessage(error instanceof Error ? error.message : '故事圣经保存失败')
                    } finally {
                      setSavingBible(false)
                    }
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const inputClass = 'mt-1.5 w-full rounded-lg border border-dream-200 px-3 py-2 text-sm focus:border-dream-500 focus:outline-none focus:ring-2 focus:ring-dream-500/20'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-dream-700">{label}{children}</label>
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return <button onClick={onClick} className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${active ? 'border-dream-600 text-dream-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><Icon className="h-4 w-4" />{label}</button>
}
