import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Home, PenLine } from 'lucide-react'
import VisualNovelPlayer from '../player/VisualNovelPlayer'
import { useLocation } from 'react-router-dom'

export default function PlayerPage() {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()
  const preview = new URLSearchParams(useLocation().search).has('preview')

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <div className="absolute left-4 top-4 z-50 flex items-center gap-2">
        <button
          onClick={() => { if (window.history.state?.idx > 0) navigate(-1); else navigate('/') }}
          title="返回上一页"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/40 px-3 py-1.5 text-sm font-medium text-white/90 backdrop-blur-md transition hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </button>
        {projectId && preview && (
          <button
            onClick={() => navigate(`/editor/${projectId}`)}
            title="回到故事工作台"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/40 px-3 py-1.5 text-sm font-medium text-white/90 backdrop-blur-md transition hover:bg-white/10"
          >
            <PenLine className="h-4 w-4" />
            <span className="hidden sm:inline">工作台</span>
          </button>
        )}
        <button
          onClick={() => navigate('/')}
          title="返回首页"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/40 px-3 py-1.5 text-sm font-medium text-white/90 backdrop-blur-md transition hover:bg-white/10"
        >
          <Home className="h-4 w-4" />
          <span className="hidden sm:inline">首页</span>
        </button>
      </div>
      <VisualNovelPlayer />
    </div>
  )
}
