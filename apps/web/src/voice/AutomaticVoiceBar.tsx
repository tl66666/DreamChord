import { useEffect, useMemo, useRef, useState } from 'react'
import { AudioLines, CheckCircle2, Loader2, Pause, Play, RefreshCw } from 'lucide-react'
import { acceptVoiceGeneration, createVoiceGeneration, getVoiceGenerationJob, getVoiceGenerationJobs, getVoiceProfiles, translateVoiceText, type VoiceProfile } from '../api/client'
import { useEditorStore } from '../stores/editorStore'
import { projectVoiceLocale, VOICE_BINDINGS_CHANGED, VOICE_PREFERENCE_CHANGED } from './characterVoicePlan'
import { AUTOMATIC_VOICE_CHANGED, automaticVoiceEnabled, saveAutomaticVoice } from './automaticVoicePreference'
import { AutomaticVoiceController, type AutomaticVoiceStatus } from './automaticVoice'
import type { Node } from '@xyflow/react'

const writingKey = (nodes: Node[]) => JSON.stringify(nodes.filter((node) => node.type === 'dialogue').map((node) => [node.id, node.data.role, node.data.text]))

export default function AutomaticVoiceBar({ projectId, preferredSceneId, suspended, onApplied, onManage }: { projectId: string; preferredSceneId: string | null; suspended: boolean; onApplied: () => void; onManage: () => void }) {
  const nodes = useEditorStore((state) => state.nodes)
  const chapterId = useEditorStore((state) => state.chapterId)
  const loading = useEditorStore((state) => state.isLoading)
  const defaultLocale = useEditorStore((state) => state.project?.defaultVoiceLocale)
  const [enabled, setEnabled] = useState(() => automaticVoiceEnabled(projectId))
  const [profiles, setProfiles] = useState<VoiceProfile[]>([])
  const [profilesReady, setProfilesReady] = useState(false)
  const [locale, setLocale] = useState(() => defaultLocale || projectVoiceLocale(projectId))
  useEffect(() => { setLocale(defaultLocale || projectVoiceLocale(projectId)) }, [defaultLocale, projectId])
  const [status, setStatus] = useState<AutomaticVoiceStatus>({ state: 'waiting', message: '写完后会自动准备配音' })
  const sourceKey = useMemo(() => writingKey(nodes), [nodes])
  const settled = useRef('')
  const current = useRef({ enabled, profiles, profilesReady, locale, preferredSceneId, suspended, onApplied, loading })
  current.current = { enabled, profiles, profilesReady, locale, preferredSceneId, suspended, onApplied, loading }
  const controller = useMemo(() => new AutomaticVoiceController({
    snapshot: () => {
      const state = useEditorStore.getState(), prefs = current.current
      return { projectId: state.project?.id || '', chapterId: state.chapterId || '', nodes: state.nodes, profiles: prefs.profiles, locale: prefs.locale, preferredSceneId: prefs.preferredSceneId, enabled: prefs.enabled && prefs.profilesReady && !prefs.suspended && !prefs.loading && state.project?.id === projectId && state.chapterId === chapterId, settled: settled.current === writingKey(state.nodes) }
    },
    jobs: getVoiceGenerationJobs, translate: translateVoiceText, generate: createVoiceGeneration, poll: getVoiceGenerationJob, accept: acceptVoiceGeneration,
    commit: (next) => { useEditorStore.getState().applyDerivedGraph(next); current.current.onApplied() },
    status: setStatus,
  }), [projectId, chapterId])
  useEffect(() => () => controller.cancel(), [controller])
  useEffect(() => {
    let active = true
    setProfilesReady(false)
    const load = () => { void getVoiceProfiles().then((items) => { if (active) { setProfiles(items); setProfilesReady(true); controller.retry() } }).catch(() => { if (active) setStatus({ state: 'error', message: '无法读取角色音色，请稍后重试。' }) }) }
    const prefs = () => { setEnabled(automaticVoiceEnabled(projectId)); setLocale(useEditorStore.getState().project?.defaultVoiceLocale || projectVoiceLocale(projectId)) }
    prefs(); load()
    window.addEventListener(VOICE_BINDINGS_CHANGED, load)
    window.addEventListener(VOICE_PREFERENCE_CHANGED, prefs)
    window.addEventListener(AUTOMATIC_VOICE_CHANGED, prefs)
    return () => { active = false; window.removeEventListener(VOICE_BINDINGS_CHANGED, load); window.removeEventListener(VOICE_PREFERENCE_CHANGED, prefs); window.removeEventListener(AUTOMATIC_VOICE_CHANGED, prefs) }
  }, [projectId, controller])
  useEffect(() => {
    if (!enabled || suspended || loading || !profilesReady) { controller.cancel(); return }
    const timer = setTimeout(() => { settled.current = sourceKey; void controller.run() }, 2200)
    return () => clearTimeout(timer)
  }, [sourceKey, enabled, profilesReady, profiles, locale, suspended, loading, controller])
  // New voice tracks do not reset the writing pause, but undo/manual changes should be observed.
  useEffect(() => { if (enabled && !suspended && settled.current === sourceKey) void controller.run() }, [nodes, enabled, suspended, sourceKey, controller])
  if (!projectId || projectId === 'new') return null
  return <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-dream-100/70 bg-[#faf8fd] px-4 py-2 text-xs" aria-label="自动配音状态">
    <div className="flex min-w-0 flex-1 items-start gap-2"><span className="mt-0.5 text-dream-600">{enabled && status.state === 'working' && !suspended ? <Loader2 className="h-4 w-4 animate-spin" /> : status.state === 'ready' && enabled ? <CheckCircle2 className="h-4 w-4" /> : <AudioLines className="h-4 w-4" />}</span><div><span className="font-semibold text-slate-800">{enabled ? '自动配音' : '角色配音'}</span><span className="ml-2 leading-5 text-slate-500" role="status">{!enabled ? '分配音色后，开启即可边写边配音' : suspended ? '正在配置声线，关闭面板后自动继续' : status.message}</span></div></div>
    <div className="flex shrink-0 items-center gap-2">{enabled && status.state === 'error' && <button onClick={() => { controller.retry(); setStatus({ state: 'waiting', message: '正在重新读取音色…' }); window.dispatchEvent(new Event(VOICE_BINDINGS_CHANGED)) }} className="flex min-h-8 items-center gap-1 rounded-lg px-2 text-dream-700 hover:bg-dream-50"><RefreshCw className="h-3.5 w-3.5" />重试</button>}<button onClick={onManage} className="min-h-8 rounded-lg px-2 text-slate-600 hover:bg-white">音色与语言</button><button aria-label={enabled ? '暂停自动配音' : '开启自动配音'} onClick={() => { controller.cancel(); controller.retry(); saveAutomaticVoice(projectId, !enabled) }} className="flex min-h-8 items-center gap-1 rounded-lg border border-dream-200 bg-white px-2.5 font-medium text-dream-700">{enabled ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}{enabled ? '暂停' : '开启自动配音'}</button></div>
  </div>
}
