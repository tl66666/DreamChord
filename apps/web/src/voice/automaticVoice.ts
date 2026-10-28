import type { Node } from '@xyflow/react'
import { readLocalizationFields, voiceTextHash, type StoryLocale } from '@dreamchord/story-domain'
import type { Asset, VoiceGenerationJob, VoiceProfile, createVoiceGeneration } from '../api/client'
import { planCharacterVoices, type PlannedVoiceLine } from './characterVoicePlan'

export interface AutomaticVoiceSnapshot {
  projectId: string; chapterId: string; locale: StoryLocale; enabled: boolean; settled: boolean
  nodes: Node[]; profiles: VoiceProfile[]; preferredSceneId?: string | null
}
export interface AutomaticVoiceStatus { state: 'waiting' | 'working' | 'ready' | 'error'; message: string; ready?: number; pending?: number; unbound?: number }
interface Dependencies {
  snapshot: () => AutomaticVoiceSnapshot
  jobs: (scope: { projectId: string; chapterId: string }) => Promise<VoiceGenerationJob[]>
  translate: (text: string) => Promise<{ text: string }>
  generate: (input: Parameters<typeof createVoiceGeneration>[0]) => Promise<VoiceGenerationJob>
  poll: (id: string) => Promise<VoiceGenerationJob>
  accept: (id: string, input: { name: string }) => Promise<Asset>
  commit: (nodes: Node[]) => void
  status: (status: AutomaticVoiceStatus) => void
  sleep?: () => Promise<void>
}

function sourceOf(job: VoiceGenerationJob) {
  try { return (JSON.parse(job.providerMetadata || '{}') as { sourceText?: string }).sourceText } catch { return undefined }
}
function matchingJob(job: VoiceGenerationJob, scope: AutomaticVoiceSnapshot, line: PlannedVoiceLine) {
  return job.status !== 'failed' && job.projectId === scope.projectId && job.chapterId === scope.chapterId && job.nodeId === line.nodeId
    && (job.profileId || job.profile?.id) === line.profileId && job.referenceId === line.referenceId && job.language === scope.locale
    && sourceOf(job) === line.sourceText && (!line.spokenText || job.text === line.spokenText)
}
function stillMatches(snapshot: AutomaticVoiceSnapshot, original: AutomaticVoiceSnapshot, line: PlannedVoiceLine) {
  if (!snapshot.enabled || snapshot.projectId !== original.projectId || snapshot.chapterId !== original.chapterId || snapshot.locale !== original.locale) return false
  const latest = planCharacterVoices(snapshot.nodes, snapshot.profiles, snapshot.projectId, snapshot.locale).pending.find((item) => item.nodeId === line.nodeId)
  return Boolean(latest && latest.role === line.role && latest.sourceHash === line.sourceHash && latest.profileId === line.profileId && latest.referenceId === line.referenceId
    && latest.originalTrackUrl === line.originalTrackUrl && latest.originalJa === line.originalJa)
}

/** Serial, restartable editor automation. A failed provider requires explicit retry. */
export class AutomaticVoiceController {
  private running = false
  private blocked = false
  private revision = 0
  constructor(private readonly deps: Dependencies) {}
  cancel() { this.revision++ }
  retry() { this.blocked = false }
  async run() {
    if (this.running || this.blocked) return
    const initial = { ...this.deps.snapshot() }
    if (!initial.enabled || !initial.settled || !initial.projectId || !initial.chapterId) return
    this.running = true
    const revision = this.revision
    const active = () => {
      const current = this.deps.snapshot()
      return revision === this.revision && current.enabled && current.projectId === initial.projectId && current.chapterId === initial.chapterId && current.locale === initial.locale
    }
    try {
      let history: VoiceGenerationJob[] | undefined
      while (active()) {
        const snapshot = { ...this.deps.snapshot() }
        if (!snapshot.settled) { this.deps.status({ state: 'waiting', message: '写完后会自动准备配音' }); return }
        const plan = planCharacterVoices(snapshot.nodes, snapshot.profiles, snapshot.projectId, snapshot.locale)
        const line = [...plan.pending].sort((a, b) => Number(snapshot.nodes.find((node) => node.id === b.nodeId)?.data.sceneGroupId === snapshot.preferredSceneId) - Number(snapshot.nodes.find((node) => node.id === a.nodeId)?.data.sceneGroupId === snapshot.preferredSceneId))[0]
        if (!line) { this.deps.status({ state: 'ready', message: plan.unbound ? `${plan.ready} 句已就绪 · ${plan.unbound} 句尚未分配音色` : `${plan.ready} 句配音已就绪`, ready: plan.ready, pending: 0, unbound: plan.unbound }); return }
        this.deps.status({ state: 'working', message: `正在准备${line.characterName}的${snapshot.locale === 'ja' ? '日语' : '中文'}配音`, ready: plan.ready, pending: plan.pending.length, unbound: plan.unbound })
        if (!history) history = await this.deps.jobs({ projectId: snapshot.projectId, chapterId: snapshot.chapterId })
        if (!active()) return
        if (!stillMatches(this.deps.snapshot(), snapshot, line)) continue
        let job = history.find((item) => matchingJob(item, snapshot, line))
        if (!job) {
          const spoken = line.spokenText || (await this.deps.translate(line.sourceText)).text
          if (!active()) return
          if (!stillMatches(this.deps.snapshot(), snapshot, line)) continue
          job = await this.deps.generate({ projectId: snapshot.projectId, chapterId: snapshot.chapterId, nodeId: line.nodeId, characterId: line.characterId, referenceId: line.referenceId, text: spoken, language: snapshot.locale, sourceText: line.sourceText, sourceLanguage: 'zh', directionMode: 'auto' })
        }
        const deadline = Date.now() + 300000
        while (['queued', 'running'].includes(job.status) && active() && Date.now() < deadline) {
          await (this.deps.sleep?.() || new Promise((resolve) => setTimeout(resolve, 1500)))
          if (!active()) return
          job = await this.deps.poll(job.id)
        }
        if (!active()) return
        if (job.status !== 'completed') throw new Error(job.errorMessage || '配音仍未完成，稍后点击重试即可接着处理。')
        history = [job, ...history.filter((item) => item.id !== job!.id)]
        if (!stillMatches(this.deps.snapshot(), snapshot, line)) continue
        let asset = job.acceptedAsset
        if (!asset) {
          try { asset = await this.deps.accept(job.id, { name: `${line.characterName} · ${snapshot.locale === 'ja' ? '日语' : '中文'} · ${line.sourceText.slice(0, 14)}` }) }
          catch (error) {
            if ((error as { response?: { status?: number } }).response?.status !== 409) throw error
            asset = (await this.deps.poll(job.id)).acceptedAsset
            if (!asset) throw error
          }
        }
        if (!active()) return
        if (!stillMatches(this.deps.snapshot(), snapshot, line)) continue
        const fields = readLocalizationFields(this.deps.snapshot().nodes.find((node) => node.id === line.nodeId)!.data)
        const locale = snapshot.locale
        const next = this.deps.snapshot().nodes.map((node) => node.id !== line.nodeId ? node : { ...node, data: {
          ...node.data,
          ...(locale === 'ja' ? { localizations: { ...fields.localizations, ja: { ...fields.localizations?.ja, text: job!.text, sourceHash: line.sourceHash } } } : {}),
          voiceTracks: { ...fields.voiceTracks, [locale]: { url: asset!.url, textHash: voiceTextHash(job!.text), profileId: line.profileId } },
        } })
        this.deps.commit(next)
      }
    } catch (cause) {
      if (active()) {
        this.blocked = true
        const serverMessage = (cause as { response?: { data?: { error?: string } } })?.response?.data?.error
        this.deps.status({ state: 'error', message: serverMessage || (cause instanceof Error ? cause.message : '自动配音暂不可用，请检查声音服务后重试。') })
      }
    } finally { this.running = false }
  }
}
