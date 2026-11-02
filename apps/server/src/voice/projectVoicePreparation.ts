export interface PreparationLine {
  chapterId: string; chapterVersion: number; nodeId: string; storedId: string
  text: string; spokenText?: string; profileId: string; referenceId: string; characterId: string; characterName: string
  originalData: string
}
export interface PreparationStatus { state: 'working' | 'ready' | 'paused' | 'error'; language: 'zh' | 'ja'; ready: number; pending: number; unbound: number; message: string }
export interface PreparationTake { url: string; text: string }
interface Dependencies {
  scan: (owner: string, project: string, locale: 'zh' | 'ja') => Promise<{ pending: PreparationLine[]; ready: number; unbound: number }>
  render: (owner: string, project: string, locale: 'zh' | 'ja', line: PreparationLine) => Promise<PreparationTake>
  commit: (owner: string, project: string, locale: 'zh' | 'ja', line: PreparationLine, take: PreparationTake, active: () => boolean) => Promise<boolean>
}
/** The scheduler is ephemeral; completed tracks and provider jobs remain persistent and resumable. */
export class ProjectVoicePreparation {
  private tasks = new Map<string, { status: PreparationStatus; promise: Promise<void>; writing?: Promise<boolean> }>()
  constructor(private readonly deps: Dependencies) {}
  private key(owner: string, project: string) { return `${owner}/${project}` }
  status(owner: string, project: string) { return this.tasks.get(this.key(owner, project))?.status }
  pause(owner: string, project: string) { const status = this.status(owner, project); if (status?.state === 'working') { status.state = 'paused'; status.message = '已暂停；生成中的音频会保留供下次继续。' } return status }
  async settled(owner: string, project: string) { await this.tasks.get(this.key(owner, project))?.promise }
  async pauseAndFlush(owner: string, project: string) { this.pause(owner, project); await this.tasks.get(this.key(owner, project))?.writing; return this.status(owner, project) }
  start(owner: string, project: string, language: 'zh' | 'ja') {
    const key = this.key(owner, project), old = this.tasks.get(key)
    if (old?.status.state === 'working') return old.status
    const status: PreparationStatus = { state: 'working', language, ready: 0, pending: 0, unbound: 0, message: '正在检查全部章节的配音…' }
    const task: { status: PreparationStatus; promise: Promise<void>; writing?: Promise<boolean> } = { status, promise: Promise.resolve() }
    this.tasks.set(key, task)
    const active = () => this.tasks.get(key) === task && status.state === 'working'
    task.promise = (async () => {
      // A paused synthesis can still finish; wait for it before starting another coordinator.
      await old?.promise
      try {
        while (active()) {
          const plan = await this.deps.scan(owner, project, language)
          if (!active()) break
          Object.assign(status, { ready: plan.ready, pending: plan.pending.length, unbound: plan.unbound })
          if (!plan.pending.length) { status.state = 'ready'; status.message = plan.unbound ? `${plan.ready} 句已准备，${plan.unbound} 句需要先给角色分配音色。` : `${plan.ready} 句${language === 'ja' ? '日语' : '中文'}配音已就绪`; break }
          const line = plan.pending[0]!
          status.message = `正在准备${line.characterName}的${language === 'ja' ? '日语' : '中文'}配音`
          const take = await this.deps.render(owner, project, language, line)
          if (!active()) break
          task.writing = this.deps.commit(owner, project, language, line, take, active)
          if (!await task.writing) throw new Error('故事或音色已被修改，请保存编辑后继续准备配音。')
          task.writing = undefined
        }
      } catch (error) {
        if (active()) { status.state = 'error'; status.message = error instanceof Error ? error.message.slice(0, 300) : '配音准备失败，请检查声音服务后重试。' }
      }
    })()
    // Keep progress memory bounded. Active jobs never get evicted.
    if (this.tasks.size > 1000) for (const [id, item] of this.tasks) { if (id !== key && item.status.state !== 'working') this.tasks.delete(id); if (this.tasks.size <= 800) break }
    return status
  }
}
