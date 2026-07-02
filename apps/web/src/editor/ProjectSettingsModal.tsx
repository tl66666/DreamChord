import { X } from 'lucide-react'
import type { ProjectData } from '../stores/editorStore'

interface ProjectSettingsModalProps {
  project: ProjectData | null
  onClose: () => void
  onUpdate: (data: Partial<ProjectData>) => void
}

export default function ProjectSettingsModal({
  project,
  onClose,
  onUpdate,
}: ProjectSettingsModalProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    onUpdate({
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      cover: formData.get('cover') as string,
      isPublic: formData.get('isPublic') === 'on',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-dream-100 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-dream-900">项目设置</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-dream-500 transition hover:bg-dream-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-dream-700">项目名称</label>
            <input
              name="title"
              type="text"
              defaultValue={project?.title}
              required
              className="w-full rounded-xl border border-dream-200 px-4 py-2 text-sm focus:border-dream-500 focus:outline-none focus:ring-2 focus:ring-dream-500/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-dream-700">简介</label>
            <textarea
              name="description"
              defaultValue={project?.description}
              rows={3}
              className="w-full rounded-xl border border-dream-200 px-4 py-2 text-sm focus:border-dream-500 focus:outline-none focus:ring-2 focus:ring-dream-500/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-dream-700">封面 URL</label>
            <input
              name="cover"
              type="text"
              defaultValue={project?.cover}
              placeholder="/assets/covers/default-cover.png"
              className="w-full rounded-xl border border-dream-200 px-4 py-2 text-sm focus:border-dream-500 focus:outline-none focus:ring-2 focus:ring-dream-500/20"
            />
            {project?.cover && (
              <img
                src={project.cover}
                alt="封面预览"
                className="mt-2 h-32 w-full rounded-xl object-cover"
              />
            )}
          </div>
          <label className="flex items-center gap-2">
            <input
              name="isPublic"
              type="checkbox"
              defaultChecked={project?.isPublic}
              className="h-4 w-4 rounded border-dream-300 text-dream-600 focus:ring-dream-500"
            />
            <span className="text-sm text-dream-700">发布后允许他人查看</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-dream-200 bg-white px-4 py-2 text-sm font-medium text-dream-700 transition hover:bg-dream-50"
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded-xl bg-dream-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-dream-700"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
