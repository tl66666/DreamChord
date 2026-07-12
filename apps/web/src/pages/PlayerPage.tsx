import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Home, PenLine } from 'lucide-react'
import VisualNovelPlayer from '../player/VisualNovelPlayer'

export default function PlayerPage() {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <div className="absolute left-4 top-4 z-50 flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          title="返回上一页"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/40 px-3 py-1.5 text-sm font-medium text-white/90 backdrop-blur-md transition hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </button>
        {projectId && (
          <button
            onClick={() => navigate(`/editor/${projectId}`)}
            title="回到故事工作台"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/40 px-3 py-1.5 text-sm font-medium text-white/90 backdrop-blur-md transition hover:bg-white/10"
          >
            <PenLine className="h-4 w-4" />
            工作台
          </button>
        )}
        <button
          onClick={() => navigate('/')}
          title="返回首页"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/40 px-3 py-1.5 text-sm font-medium text-white/90 backdrop-blur-md transition hover:bg-white/10"
        >
          <Home className="h-4 w-4" />
          首页
        </button>
      </div>
      <VisualNovelPlayer />
    </div>
  )
}
