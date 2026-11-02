import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Pause, Volume2 } from 'lucide-react'
import { getProjectVoicePreparation, pauseProjectVoicePreparation, prepareProjectVoice, type ProjectVoicePreparationStatus } from '../api/client'

export default function ProjectVoiceProgress({ projectId, language, revision = 0 }: { projectId: string; language: 'zh' | 'ja'; revision?: number }) {
  const [status, setStatus] = useState<ProjectVoicePreparationStatus | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true, timer: ReturnType<typeof setTimeout> | undefined
    const read = async () => {
      try {
        const next = await getProjectVoicePreparation(projectId)
        if (!active) return
        setStatus(next); setError('')
        if (next?.state === 'working') timer = setTimeout(read, 1800)
      } catch { if (active) setError('配音进度读取失败，点击继续可重新检查。') }
    }
    void read()
    return () => { active = false; if (timer) clearTimeout(timer) }
  }, [projectId, revision, busy])
  return <div className="mb-4 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
    <div className="flex items-start gap-2"><Volume2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-dream-600" /><span role="status" className="min-w-0 flex-1 leading-5">{error || status?.message || '绑定角色音色后，可自动准备整部作品的对白。'}</span></div>
    {status?.state === 'working' && <><progress aria-label="整部作品配音进度" value={status.ready} max={Math.max(1, status.ready + status.pending)} className="mt-2 h-1.5 w-full accent-violet-600" /><p className="mt-1 text-slate-400">{status.ready} / {status.ready + status.pending} 句 · 可离开此页，后台继续</p></>}
    <div className="mt-2 flex flex-wrap items-center gap-3"><button type="button" disabled={busy} className="inline-flex min-h-7 items-center gap-1 font-medium text-dream-700 disabled:opacity-50" onClick={async () => {
      setBusy(true); setError('')
      try { setStatus(status?.state === 'working' ? await pauseProjectVoicePreparation(projectId) : await prepareProjectVoice(projectId, language)) }
      catch (cause) { setError((cause as { response?: { data?: { error?: string } } }).response?.data?.error || '配音准备未能开始，请检查声音服务后重试。') }
      finally { setBusy(false) }
    }}>{busy ? <Loader2 className="h-3 w-3 animate-spin" /> : status?.state === 'working' ? <Pause className="h-3 w-3" /> : null}{status?.state === 'working' ? '暂停准备' : status?.state === 'error' || status?.state === 'paused' ? '继续准备配音' : status?.state === 'ready' ? '检查新增对白' : '准备整部配音'}</button>{!!status?.unbound && <Link to={`/library?tab=voices&project=${projectId}`} className="font-medium text-dream-700 underline">分配角色音色</Link>}</div>
  </div>
}
