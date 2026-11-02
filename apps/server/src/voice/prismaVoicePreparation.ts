import jwt from 'jsonwebtoken'
import type { PrismaClient } from '@prisma/client'
import { readLocalizationFields, voiceTextHash } from '@dreamchord/story-domain'
import { prisma } from '../lib/prisma.js'
import { ProjectVoicePreparation, type PreparationLine, type PreparationTake } from './projectVoicePreparation.js'

const aliases: Record<string, string> = { yuki: '雪', ren: '影', miya: '宫', sora: '空', ghost: '系统幽灵' }
async function request<T>(owner: string, route: string, body?: unknown): Promise<T> {
  // Only this server's fixed loopback interface; no caller-provided hosts or bearer tokens are retained.
  const token = jwt.sign({ userId: owner }, process.env.JWT_SECRET!, { expiresIn: '5m' })
  const response = await fetch(`http://127.0.0.1:${Number(process.env.PORT) || 3001}/api/voices${route}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(200000) })
  const value = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(value.error || '声音服务请求失败，请重试。')
  return value
}
export async function scanProjectVoices(owner: string, projectId: string, locale: 'zh' | 'ja', client: PrismaClient = prisma) {
  const project = await client.project.findFirst({ where: { id: projectId, authorId: owner }, include: { chapters: { orderBy: { order: 'asc' }, include: { nodes: true } }, characters: { include: { voiceBinding: { include: { profile: { include: { references: { include: { asset: true } } } } } } } } } })
  if (!project) throw new Error('故事不存在或无权编辑。')
  const pending: PreparationLine[] = []
  let ready = 0, unbound = 0
  for (const chapter of project.chapters) for (const node of chapter.nodes) {
    const data = JSON.parse(node.data) as Record<string, unknown>
    if (node.type !== 'dialogue' || typeof data.text !== 'string' || !data.text.trim() || !data.role || ['旁白', 'narrator'].includes(String(data.role))) continue
    const fields = readLocalizationFields(data), sourceHash = voiceTextHash(data.text)
    const ja = fields.localizations?.ja
    const spokenText = locale === 'zh' ? data.text : ja?.text && (!ja.sourceHash || ja.sourceHash === sourceHash) ? ja.text : undefined
    const character = project.characters.find(c => c.id === data.role || c.name === data.role || c.name === aliases[String(data.role)])
    const profile = character?.voiceBinding?.profile
    const track = fields.voiceTracks?.[locale]
    const changed = profile && track?.profileId && profile.id !== track.profileId
    const legacy = locale === 'zh' && !track && (data.audio as { voice?: { url?: string } } | undefined)?.voice?.url
    if (!changed && ((track?.url && spokenText && (!track.textHash || track.textHash === voiceTextHash(spokenText))) || legacy)) { ready++; continue }
    const refs = profile?.references.filter(r => r.status === 'active' && r.authorizationConfirmed && r.asset.ownerId === owner && r.asset.type === 'VOICE_SAMPLE') || []
    const reference = refs.find(r => r.language.startsWith(locale)) || refs[0]
    if (!character || !profile || profile.ownerId !== owner || profile.status !== 'active' || !reference) { unbound++; continue }
    pending.push({ chapterId: chapter.id, chapterVersion: chapter.version, nodeId: node.nodeId, storedId: node.id, text: data.text, spokenText, profileId: profile.id, referenceId: reference.id, characterId: character.id, characterName: character.name, originalData: node.data })
  }
  return { pending, ready, unbound }
}
interface Job { id: string; status: string; text: string; profileId: string; referenceId: string; nodeId?: string; language: string; providerMetadata: string; errorMessage?: string; outputUrl?: string; acceptedAsset?: { url: string } | null }
async function render(owner: string, projectId: string, locale: 'zh' | 'ja', line: PreparationLine): Promise<PreparationTake> {
  const history = await prisma.voiceGenerationJob.findMany({ where: { ownerId: owner, projectId, chapterId: line.chapterId, nodeId: line.nodeId, profileId: line.profileId, referenceId: line.referenceId, language: locale, status: { in: ['queued', 'running', 'completed'] } }, orderBy: { createdAt: 'desc' }, take: 20, include: { acceptedAsset: true } })
  let job: Job | undefined = history.find(j => { try { return JSON.parse(j.providerMetadata).sourceText === line.text && (!line.spokenText || j.text === line.spokenText) } catch { return false } }) as Job | undefined
  if (!job) {
    const text = line.spokenText || (await request<{ text: string }>(owner, '/translate', { text: line.text, targetLanguage: 'ja' })).text
    job = await request<Job>(owner, '/generate', { projectId, chapterId: line.chapterId, nodeId: line.nodeId, characterId: line.characterId, referenceId: line.referenceId, text, language: locale, sourceText: line.text, sourceLanguage: 'zh', directionMode: 'auto' })
  }
  const deadline = Date.now() + 360000
  while (['queued', 'running'].includes(job.status) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 1200))
    job = await request<Job>(owner, `/jobs/${job.id}`)
  }
  if (job.status !== 'completed') throw new Error(job.errorMessage || '配音仍在处理中，请稍后继续，已有进度会保留。')
  let asset = job.acceptedAsset
  if (!asset) {
    try { asset = await request<{ url: string }>(owner, `/jobs/${job.id}/accept`, { name: `${line.characterName} · ${locale === 'ja' ? '日语' : '中文'} · ${line.text.slice(0, 14)}` }) }
    catch (error) { asset = (await request<Job>(owner, `/jobs/${job.id}`)).acceptedAsset; if (!asset) throw error }
  }
  return { url: asset.url, text: job.text }
}
export async function commitPreparedVoice(owner: string, projectId: string, locale: 'zh' | 'ja', line: PreparationLine, take: PreparationTake, active: () => boolean, client: PrismaClient = prisma) {
  return client.$transaction(async tx => {
    if (!active()) return false
    const chapter = await tx.chapter.findFirst({ where: { id: line.chapterId, projectId, project: { authorId: owner }, version: line.chapterVersion } })
    const node = await tx.flowNode.findFirst({ where: { id: line.storedId, chapterId: line.chapterId, data: line.originalData } })
    const binding = await tx.characterVoiceBinding.findFirst({ where: { projectId, characterId: line.characterId, profileId: line.profileId, profile: { status: 'active', ownerId: owner, references: { some: { id: line.referenceId, status: 'active', authorizationConfirmed: true } } } } })
    if (!chapter || !node || !binding || !active()) return false
    const data = JSON.parse(node.data) as Record<string, unknown>, fields = readLocalizationFields(data)
    const patched = { ...data, ...(locale === 'ja' ? { localizations: { ...fields.localizations, ja: { ...fields.localizations?.ja, text: take.text, sourceHash: voiceTextHash(line.text) } } } : {}), voiceTracks: { ...fields.voiceTracks, [locale]: { url: take.url, textHash: voiceTextHash(take.text), profileId: line.profileId } } }
    const updated = await tx.chapter.updateMany({ where: { id: chapter.id, version: line.chapterVersion }, data: { version: { increment: 1 } } })
    if (updated.count !== 1) return false
    await tx.flowNode.update({ where: { id: node.id }, data: { data: JSON.stringify(patched) } })
    return true
  })
}
export const projectVoicePreparation = new ProjectVoicePreparation({ scan: scanProjectVoices, render, commit: commitPreparedVoice })
