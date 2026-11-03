import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import type { StoryNode } from '@dreamchord/story-domain'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { upgradePaintPrologue } from './paintUpgrade.js'
import * as paintTemplate from './paintTemplate.js'

const projectId = 'dreamchord-paint-prologue'
const dir = path.join(tmpdir(), `dreamchord-paint-upgrade-${randomUUID()}`)
const publicRoot = path.join(dir, 'public'), packRoot = path.join(dir, 'pack')
const databaseUrl = `file:${path.join(dir, 'test.db').replaceAll('\\', '/')}`
const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
const bytes = Buffer.from('small-trusted-upgrade-fixture'), sha256 = createHash('sha256').update(bytes).digest('hex')
const character = { slug: 'cheng', name: '程见', description: '乐于助人的道具师', color: '#abcdef', defaultSprite: '/assets/paint-prologue/cheng-normal.png' }
const oldNodes: StoryNode[] = [
  { id: 'bg', type: 'background', position: { x: 0, y: 0 }, data: { sceneGroupId: 'workshop', backgroundId: '/assets/paint-prologue/workshop.webp', audio: { bgm: { action: 'play', url: '/assets/audio/paint-prologue/workshop.ogg', volume: .4 } } } },
  { id: 'show', type: 'character', position: { x: 0, y: 100 }, data: { sceneGroupId: 'workshop', characterId: '程见', action: 'show', expression: 'normal', position: 'center' } },
  { id: 'line', type: 'dialogue', position: { x: 0, y: 200 }, data: { sceneGroupId: 'workshop', role: '程见', text: '我修好了。', localizations: { ja: { text: '直したよ。', sourceHash: 'source-hash' } }, voiceTracks: { ja: { url: '/assets/audio/paint-prologue/line-ja.ogg', textHash: 'spoken-hash', profileId: 'paint-voice-cheng' } } } },
]
const release = { id: projectId, title: '请让这幅画老去', description: '旧序章', cover: '/assets/paint-prologue/workshop.webp', chapterTitle: '序章', characters: [character], graph: { nodes: oldNodes, edges: [{ id: 'bg-show', source: 'bg', target: 'show', animated: true }, { id: 'show-line', source: 'show', target: 'line', animated: true }] } }
const current = structuredClone(release)
current.description = '增加文学描写的新序章'
current.cover = '/assets/paint-prologue/home.webp'
current.graph.nodes.unshift({ id: 'opening', type: 'subtitle', position: { x: 0, y: -100 }, data: { sceneGroupId: 'workshop', text: '春日从窗台上的旧杯子里慢慢升起。', backgroundId: '/assets/paint-prologue/home.webp' } })
current.graph.edges.unshift({ id: 'opening-bg', source: 'opening', target: 'bg', animated: true })
const options = { release, currentDefinition: current, publicRoot, packRoot, storageRoot: path.join(dir, 'uploads') }

const snapshot = () => client.project.findUniqueOrThrow({ where: { id: projectId }, include: { chapters: { include: { nodes: { orderBy: { nodeId: 'asc' } }, edges: { orderBy: { edgeId: 'asc' } } } }, characters: { include: { sprites: true, voiceBinding: true } } } })

describe('explicit paint official upgrade', () => {
  beforeAll(async () => {
    mkdirSync(packRoot, { recursive: true })
    const sql = readdirSync('prisma/migrations').filter(n => /^\d/.test(n)).sort().map(n => readFileSync(`prisma/migrations/${n}/migration.sql`, 'utf8')).join('\n')
    execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'db', 'execute', '--schema', 'prisma/schema.prisma', '--stdin'], { input: sql, env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: ['pipe', 'pipe', 'pipe'] })
    await client.user.createMany({ data: [{ id: 'official', username: 'demo' }, { id: 'alice', username: 'alice' }].map(u => ({ ...u, email: `${u.id}@test.invalid`, password: 'test' })) })
    const put = (url: string) => { const file = path.join(publicRoot, url); mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, bytes) }
    for (const name of ['workshop.webp', 'home.webp', 'cheng-normal.png', 'cheng-smile.png', 'cheng-serious.png']) put(`/assets/paint-prologue/${name}`)
    put('/assets/audio/paint-prologue/workshop.ogg'); put('/assets/audio/paint-prologue/line-ja.ogg')
    writeFileSync(path.join(publicRoot, 'assets/audio/paint-prologue/music-credits.json'), JSON.stringify([{ runtimeFile: '/assets/audio/paint-prologue/workshop.ogg', runtimeSha256: sha256, author: 'fixture author', name: 'fixture music', license: 'CC0-1.0', sourceUrl: 'https://example.invalid/music' }]))
    writeFileSync(path.join(packRoot, 'ref-cheng-ja.wav'), bytes)
    writeFileSync(path.join(packRoot, 'manifest.json'), JSON.stringify({
      voices: [{ id: 'cheng', role: '程见', name: '程见', description: '声音', genderTone: '男声' }],
      references: [{ id: 'cheng-casual', role: 'cheng', language: 'ja', text: '参考台词', outputFile: 'ref-cheng-ja.wav', sha256, durationSeconds: 5 }],
      takes: [{ runtimeFile: '/assets/audio/paint-prologue/line-ja.ogg', runtimeSha256: sha256, nodeId: 'line', role: 'cheng', language: 'ja', text: '直したよ。', referenceId: 'cheng-casual' }],
    }))
  }, 30000)
  beforeEach(async () => {
    await client.project.deleteMany()
    await client.voiceReference.deleteMany(); await client.voiceProfile.deleteMany(); await client.asset.deleteMany()
    await client.voiceProfile.create({ data: { id: 'existing-profile', ownerId: 'official', name: '原绑定', language: 'ja', authorizationNote: 'fixture', references: { create: { id: 'existing-reference', language: 'ja', transcript: '参考台词', authorizationConfirmed: true, asset: { create: { id: 'existing-voice-asset', ownerId: 'official', type: 'VOICE_SAMPLE', name: '参考', url: '/uploads/existing.wav', metadata: JSON.stringify({ sha256 }) } } } } } })
    const nodes = structuredClone(release.graph.nodes)
    for (const node of nodes) {
      if (node.data.characterId) node.data.characterId = 'existing-character'
      if (node.data.voiceTracks) node.data.voiceTracks = { ja: { ...(node.data.voiceTracks as { ja: object }).ja, profileId: 'existing-profile', referenceId: 'existing-reference' } }
    }
    await client.project.create({ data: {
      id: projectId, authorId: 'official', title: release.title, description: release.description, cover: release.cover, isPublic: true, isPublished: true, defaultSubtitleLocale: 'zh', defaultVoiceLocale: 'ja',
      characters: { create: { id: 'existing-character', name: character.name, description: character.description, color: character.color, defaultSprite: character.defaultSprite, sprites: { create: ['normal', 'smile', 'serious'].map(name => ({ name, url: `/assets/paint-prologue/cheng-${name}.png` })) }, voiceBinding: { create: { projectId, profileId: 'existing-profile' } } } },
      chapters: { create: { id: 'existing-chapter', title: release.chapterTitle, order: 0, nodes: { create: nodes.map(n => ({ nodeId: n.id, type: n.type, positionX: n.position.x, positionY: n.position.y, data: JSON.stringify(n.data) })) }, edges: { create: release.graph.edges.map(e => ({ edgeId: e.id, source: e.source, target: e.target, animated: e.animated })) } } },
    } })
    await client.project.create({ data: { id: 'private-copy', authorId: 'alice', title: '我的作品', chapters: { create: { title: '第一章', order: 0 } } } })
  })
  afterAll(async () => { await client.$disconnect(); if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep)) throw new Error('Invalid test directory'); rmSync(dir, { recursive: true, force: true }) })

  it('updates only the verified official graph in place and reports reliable before/after fingerprints', async () => {
    const before = await snapshot()
    const privateBefore = await client.project.findUniqueOrThrow({ where: { id: 'private-copy' }, include: { chapters: true } })
    const voices = await client.voiceProfile.findMany({ include: { references: true, bindings: true } })
    const result = await upgradePaintPrologue(client, 'official', options)
    expect(result.status).toBe('upgraded')
    expect(result.beforeFingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(result.afterFingerprint).not.toBe(result.beforeFingerprint)
    const after = await snapshot()
    expect(after).toMatchObject({ id: before.id, createdAt: before.createdAt, description: current.description, cover: current.cover })
    expect(after.chapters[0]).toMatchObject({ id: before.chapters[0].id, version: 2 })
    expect(after.chapters[0].nodes).toHaveLength(4)
    expect(after.chapters[0].nodes.find(n => n.nodeId === 'line')!.id).toBe(before.chapters[0].nodes.find(n => n.nodeId === 'line')!.id)
    expect(JSON.parse(after.chapters[0].nodes.find(n => n.nodeId === 'line')!.data).voiceTracks.ja).toMatchObject({ profileId: 'existing-profile', referenceId: 'existing-reference' })
    expect(after.characters).toEqual(before.characters)
    expect(existsSync(options.storageRoot)).toBe(false)
    expect(await client.voiceProfile.findMany({ include: { references: true, bindings: true } })).toEqual(voices)
    expect(await client.project.findUniqueOrThrow({ where: { id: 'private-copy' }, include: { chapters: true } })).toEqual(privateBefore)
    const again = await upgradePaintPrologue(client, 'official', { ...options, packRoot: path.join(dir, 'absent') })
    expect(again).toMatchObject({ status: 'current', beforeFingerprint: result.afterFingerprint, afterFingerprint: result.afterFingerprint })
    expect(await snapshot()).toEqual(after)
  })

  it.each(['text', 'audio', 'position', 'character', 'title', 'edge', 'sprite'])('refuses author changes to %s and preserves every stored field', async field => {
    if (field === 'text' || field === 'audio') {
      const node = await client.flowNode.findFirstOrThrow({ where: { chapterId: 'existing-chapter', nodeId: field === 'text' ? 'line' : 'bg' } })
      const data = JSON.parse(node.data)
      if (field === 'text') data.text = '作者改过的台词'
      else data.audio.bgm.volume = .17
      await client.flowNode.update({ where: { id: node.id }, data: { data: JSON.stringify(data) } })
    } else if (field === 'position') await client.flowNode.updateMany({ where: { chapterId: 'existing-chapter', nodeId: 'bg' }, data: { positionX: 27 } })
    else if (field === 'character') await client.character.update({ where: { id: 'existing-character' }, data: { description: '作者的新设定' } })
    else if (field === 'title') await client.project.update({ where: { id: projectId }, data: { title: '作者新标题' } })
    else if (field === 'sprite') await client.sprite.updateMany({ where: { characterId: 'existing-character', name: 'normal' }, data: { url: '/uploads/author.png' } })
    else await client.flowEdge.updateMany({ where: { chapterId: 'existing-chapter', edgeId: 'bg-show' }, data: { label: '作者的连接' } })
    const before = await snapshot()
    await expect(upgradePaintPrologue(client, 'official', options)).rejects.toThrow(/拒绝|修改|匹配/)
    expect(await snapshot()).toEqual(before)
  })

  it.each(['private', 'unpublished', 'wrong-owner'])('refuses a %s official-id project', async kind => {
    await client.project.update({ where: { id: projectId }, data: kind === 'private' ? { isPublic: false } : kind === 'unpublished' ? { isPublished: false } : { authorId: 'alice' } })
    const before = await snapshot()
    await expect(upgradePaintPrologue(client, 'official', options)).rejects.toThrow(/拒绝|官方/)
    expect(await snapshot()).toEqual(before)
  })

  it('fails complete media preflight before changing any graph data', async () => {
    const file = path.join(publicRoot, 'assets/paint-prologue/home.webp')
    renameSync(file, `${file}.bak`)
    const before = await snapshot()
    try { await expect(upgradePaintPrologue(client, 'official', options)).rejects.toThrow(/ENOENT/); expect(await snapshot()).toEqual(before) }
    finally { renameSync(`${file}.bak`, file) }
  })

  it('rejects edits made during asynchronous media preflight without overwriting them', async () => {
    const original = paintTemplate.preflightPaintDefinition
    const spy = vi.spyOn(paintTemplate, 'preflightPaintDefinition').mockImplementationOnce(async (definition, mediaOptions) => {
      const prepared = await original(definition, mediaOptions)
      const node = await client.flowNode.findFirstOrThrow({ where: { chapterId: 'existing-chapter', nodeId: 'line' } })
      await client.flowNode.update({ where: { id: node.id }, data: { data: JSON.stringify({ ...JSON.parse(node.data), text: '预检时作者刚改好的台词' }) } })
      return prepared
    })
    try {
      await expect(upgradePaintPrologue(client, 'official', options)).rejects.toThrow(/预检期间/)
      const after = await snapshot()
      expect(after.description).toBe(release.description)
      expect(after.chapters[0].version).toBe(1)
      expect(JSON.parse(after.chapters[0].nodes.find(n => n.nodeId === 'line')!.data).text).toBe('预检时作者刚改好的台词')
    } finally { spy.mockRestore() }
  })
})
