import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getPublicProjects, type ProjectDetail } from '../api/client'

export default function ExplorePage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectDetail[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPublicProjects()
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-12">
        <p className="text-dream-600">加载中...</p>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="container mx-auto flex flex-col items-center justify-center px-6 py-24 text-center">
        <img
          src="/assets/illustrations/empty-projects.png"
          alt="暂无作品"
          className="mb-6 h-40 w-40 object-contain opacity-70"
        />
        <h1 className="mb-2 text-2xl font-bold text-dream-900">还没有公开作品</h1>
        <p className="text-dream-600">成为第一个创作者吧</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-dream-200 bg-white/70 px-3 py-1.5 text-sm font-medium text-dream-700 transition hover:bg-dream-50"
          >
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>
          <h1 className="text-3xl font-bold text-dream-900">发现作品</h1>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} onClick={() => navigate(`/play/${project.id}`)} />
        ))}
      </div>
    </div>
  )
}

function ProjectCard({
  project,
  onClick,
}: {
  project: ProjectDetail
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group w-full overflow-hidden rounded-2xl border border-dream-100 bg-white/70 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-dream-500/40"
    >
      <div className="relative h-44 overflow-hidden">
        <img
          src={project.cover || '/assets/covers/default-cover.png'}
          alt={project.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition group-hover:opacity-100" />
      </div>
      <div className="p-5">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="font-semibold text-dream-900 group-hover:text-dream-600 transition">{project.title}</h3>
          {project.isPublished && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">已发布</span>
          )}
        </div>
        <p className="text-sm text-dream-600">{project.author.nickname || project.author.username}</p>
        {project.description && (
          <p className="mt-2 line-clamp-2 text-xs text-dream-500">{project.description}</p>
        )}
        <div className="mt-4 flex items-center text-xs text-dream-400">
          <span className="group-hover:text-dream-500 transition">点击游玩 →</span>
        </div>
      </div>
    </button>
  )
}
