import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaintDefinition } from './paintTemplate.js'
import * as media from './paintTemplate.js'
import { releasePaintBook } from './paintBookRelease.js'

const id = 'dreamchord-paint-prologue'
const dir = path.join(tmpdir(), `paint-book-${randomUUID()}`), publicRoot = path.join(dir, 'public')
const databaseUrl = `file:${path.join(dir, 'test.db').replaceAll('\\', '/')}`
const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
const bytes = Buffer.from('trusted-small-book-media-fixture'), sha256 = createHash('sha256').update(bytes).digest('hex')
const musicCredit = { runtimeFile: '/assets/audio/paint-book/day.ogg', runtimeSha256: sha256, author: 'fixture musician', license: 'CC0', sourceUrl: 'https://example.invalid/score', licenseUrl: 'https://example.invalid/license', attribution: 'Music: fixture musician', processing: 'Copied original Ogg without re-encoding' }
const character = { slug: 'cheng', name: '程见', description: '道具师', color: '#abcdef', defaultSprite: '/assets/paint-prologue/cheng-normal.png' }
function definition(order: number): PaintDefinition {
  return { id, title: '请让这幅画老去', description: `共${order + 1}章`, chapterTitle: `第${order}章`, cover: '/assets/paint-prologue/home.webp', characters: [character], graph: {
    nodes: [{ id: `line-${order}`, type: 'dialogue', position: { x: 10, y: 20 }, data: { sceneGroupId: `scene-${order}`, sceneCode: `${order + 1}-1`, role: '程见', text: `第${order}句`, localizations: { ja: { text: '直したよ。' } }, voiceTracks: { ja: { url: `/assets/audio/paint-${order}/line.ogg` } } } }], edges: [],
  } }
}
const releaseDefinitions = [definition(0), definition(1)]
const currentDefinitions = [...structuredClone(releaseDefinitions), definition(2)]
currentDefinitions[0].graph.nodes[0].data.text = '修订后的旁白'
currentDefinitions[0].graph.nodes[0].data.audio = { bgm: { action: 'play', url: '/assets/audio/paint-book/day.ogg' } }
const packRoots = ['paint-prologue', 'paint-chapter-one', 'paint-chapter-two'].map(name => path.join(dir, name))
const options = { releaseDefinitions, currentDefinitions, packRoots, publicRoot }
const snapshot = () => client.project.findUniqueOrThrow({ where: { id }, include: { chapters: { orderBy: { order: 'asc' }, include: { nodes: { orderBy: { nodeId: 'asc' } }, edges: true } }, characters: { include: { sprites: true, voiceBinding: true } }, assets: true } })

describe('guarded whole paint book release', () => {
  beforeAll(async () => {
    mkdirSync(dir, { recursive: true })
    const sql = readdirSync('prisma/migrations').filter(n => /^\d/.test(n)).sort().map(n => readFileSync(`prisma/migrations/${n}/migration.sql`, 'utf8')).join('\n')
    execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'db', 'execute', '--schema', 'prisma/schema.prisma', '--stdin'], { input: sql, env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: ['pipe', 'pipe', 'pipe'] })
    await client.user.createMany({ data: ['official', 'private'].map(u => ({ id: u, username: u === 'official' ? 'demo' : u, email: `${u}@invalid.example`, password: 'fixture' })) })
    const put = (file: string, content: string | Buffer = bytes) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, content) }
    for (const file of ['home.webp', 'cheng-normal.png', 'cheng-smile.png', 'cheng-serious.png']) put(path.join(publicRoot, 'assets/paint-prologue', file))
    put(path.join(publicRoot, 'assets/audio/paint-book/day.ogg'))
    put(path.join(publicRoot, 'assets/audio/paint-book/music-credits.json'), JSON.stringify([musicCredit]))
    for (const [order, packRoot] of packRoots.entries()) {
      put(path.join(publicRoot, `assets/audio/paint-${order}/line.ogg`))
      put(path.join(packRoot, 'ref.wav'))
      put(path.join(packRoot, 'manifest.json'), JSON.stringify({ voices: [{ id: 'cheng', role: '程见', name: '程见', description: 'voice', genderTone: '男声' }], references: [{ id: 'cheng-natural', role: 'cheng', language: 'ja', text: '参考句', outputFile: 'ref.wav', sha256, durationSeconds: 5 }], takes: [{ nodeId: `line-${order}`, role: 'cheng', language: 'ja', text: '直したよ。', referenceId: 'cheng-natural', runtimeFile: `/assets/audio/paint-${order}/line.ogg`, runtimeSha256: sha256 }] }))
    }
  }, 30000)
  beforeEach(async () => {
    await client.project.deleteMany(); await client.voiceReference.deleteMany(); await client.voiceProfile.deleteMany(); await client.asset.deleteMany()
    await client.voiceProfile.create({ data: { id: 'paint-voice-cheng', ownerId: 'official', name: '程见', language: 'ja', authorizationNote: 'fixture', references: { create: { id: 'original-reference', language: 'ja', transcript: '参考句', authorizationConfirmed: true, asset: { create: { id: 'voice-asset', ownerId: 'official', type: 'VOICE_SAMPLE', name: 'ref', url: '/uploads/old.wav', metadata: JSON.stringify({ sha256 }) } } } } } })
    await client.project.create({ data: { id, authorId: 'official', title: releaseDefinitions[0].title, description: releaseDefinitions[1].description, cover: releaseDefinitions[0].cover, isPublic: true, isPublished: true, defaultSubtitleLocale: 'zh', defaultVoiceLocale: 'ja', characters: { create: { id: 'original-character', name: character.name, description: character.description, color: character.color, defaultSprite: character.defaultSprite, sprites: { create: ['normal', 'smile', 'serious'].map(name => ({ name, url: `/assets/paint-prologue/cheng-${name}.png` })) }, voiceBinding: { create: { projectId: id, profileId: 'paint-voice-cheng' } } } }, chapters: { create: releaseDefinitions.map((d, order) => ({ id: `chapter-${order}`, order, title: d.chapterTitle, version: order ? 5 : 7, nodes: { create: d.graph.nodes.map(n => ({ nodeId: n.id, type: n.type, positionX: n.position.x, positionY: n.position.y, data: JSON.stringify({ ...n.data, voiceTracks: { ja: { ...(n.data.voiceTracks as { ja: object }).ja, profileId: 'paint-voice-cheng', referenceId: 'original-reference' } } }) })) } })) } } })
    await client.project.create({ data: { id: 'private-copy', authorId: 'private', title: '作者的续写', chapters: { create: { title: '我的序章', order: 0 } } } })
  })
  afterAll(async () => { await client.$disconnect(); if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep)) throw new Error('Invalid test directory'); rmSync(dir, { recursive: true, force: true }) })

  it('revises changed chapters, appends order 2, preserves existing identities, and repeats without writes', async () => {
    const before = await snapshot(), voices = await client.voiceProfile.findMany({ include: { references: true, bindings: true } })
    const privateBefore = await client.project.findUniqueOrThrow({ where: { id: 'private-copy' }, include: { chapters: true } })
    const result = await releasePaintBook(client, 'official', options)
    expect(result.status).toBe('released')
    const after = await snapshot()
    expect(after.chapters.map(c => c.order)).toEqual([0, 1, 2])
    expect(after.chapters[0]).toMatchObject({ id: 'chapter-0', version: 8 })
    expect(after.chapters[0].nodes[0].id).toBe(before.chapters[0].nodes[0].id)
    expect(after.chapters[1]).toEqual(before.chapters[1])
    expect(after.characters).toEqual(before.characters)
    expect(JSON.parse(after.chapters[2].nodes[0].data).voiceTracks.ja).toMatchObject({ profileId: 'paint-voice-cheng', referenceId: 'original-reference' })
    expect(await client.voiceProfile.findMany({ include: { references: true, bindings: true } })).toEqual(voices)
    expect(await client.project.findUniqueOrThrow({ where: { id: 'private-copy' }, include: { chapters: true } })).toEqual(privateBefore)
    expect(after.assets).toHaveLength(1)
    expect((await releasePaintBook(client, 'official', options)).status).toBe('current')
    expect(await snapshot()).toEqual(after)
  })
  it('checks the complete release without writing when checkOnly is requested', async () => {
    const before = await snapshot()
    const result = await releasePaintBook(client, 'official', { ...options, checkOnly: true })
    expect(result.status).toBe('ready')
    expect(result.beforeFingerprint).not.toBe(result.targetFingerprint)
    expect(await snapshot()).toEqual(before)
  })
  it('links each credited project BGM once while preserving old author assets and the global library', async () => {
    const definitions = structuredClone(currentDefinitions)
    definitions[1].graph.nodes[0].data.audio = structuredClone(definitions[0].graph.nodes[0].data.audio)
    await client.asset.createMany({ data: [
      { id: 'old-music-1', projectId: id, ownerId: 'official', type: 'BGM', name: '原曲一', url: '/assets/audio/paint-prologue/workshop.ogg', metadata: '{"authorNote":"原曲一保留"}' },
      { id: 'old-music-2', projectId: id, ownerId: 'official', type: 'BGM', name: '原曲二', url: '/assets/audio/paint-prologue/stage.ogg', metadata: '{"authorNote":"原曲二保留"}' },
      { id: 'global-library', ownerId: 'official', type: 'BGM', name: '全局音乐库', url: musicCredit.runtimeFile, metadata: '{"libraryNote":"不可改写"}' },
    ] })
    const before = await client.asset.findMany({ orderBy: { id: 'asc' } })
    const customOptions = { ...options, currentDefinitions: definitions }
    expect((await releasePaintBook(client, 'official', { ...customOptions, checkOnly: true })).status).toBe('ready')
    expect(await client.asset.findMany({ orderBy: { id: 'asc' } })).toEqual(before)
    await releasePaintBook(client, 'official', customOptions)
    const after = await client.asset.findMany({ orderBy: { id: 'asc' } })
    const added = after.filter(a => !before.some(b => b.id === a.id))
    expect(added).toHaveLength(1)
    expect(added[0]).toMatchObject({ ownerId: 'official', projectId: id, type: 'BGM', mimeType: 'audio/ogg', url: musicCredit.runtimeFile })
    expect(JSON.parse(added[0].metadata)).toMatchObject({ sha256, musicCredit })
    expect(after.filter(a => before.some(b => b.id === a.id))).toEqual(before)
    expect((await releasePaintBook(client, 'official', customOptions)).status).toBe('current')
    expect(await client.asset.findMany({ orderBy: { id: 'asc' } })).toEqual(after)
  })
  it('preserves a preexisting project BGM with the same URL byte for byte', async () => {
    const existing = await client.asset.create({ data: { id: 'author-project-music', projectId: id, ownerId: 'official', type: 'BGM', name: '作者已有命名', url: musicCredit.runtimeFile, mimeType: 'audio/custom', metadata: '{"authorNote":"保留原素材说明"}' } })
    await releasePaintBook(client, 'official', options)
    expect(await client.asset.findUniqueOrThrow({ where: { id: existing.id } })).toEqual(existing)
    expect(await client.asset.count({ where: { projectId: id, url: musicCredit.runtimeFile } })).toBe(1)
  })
  it('appends chapter two to the exact current-source two-chapter installation without incrementing its chapters', async () => {
    for (const [order, definition] of currentDefinitions.slice(0, 2).entries()) {
      const node = definition.graph.nodes[0]
      await client.flowNode.updateMany({ where: { chapterId: `chapter-${order}`, nodeId: node.id }, data: { data: JSON.stringify({ ...node.data, voiceTracks: { ja: { ...(node.data.voiceTracks as { ja: object }).ja, profileId: 'paint-voice-cheng', referenceId: 'original-reference' } } }) } })
    }
    await client.project.update({ where: { id }, data: { description: currentDefinitions[1].description } })
    const before = await snapshot()
    expect((await releasePaintBook(client, 'official', options)).status).toBe('released')
    const after = await snapshot()
    expect(after.chapters.slice(0, 2)).toEqual(before.chapters)
    expect(after.chapters[2].order).toBe(2)
  })
  it.each(['text', 'position', 'scene', 'audio', 'extra', 'binding', 'reference', 'track', 'owner'])('rejects %s edits without changing any stored fields', async kind => {
    if (['text', 'scene', 'audio', 'track'].includes(kind)) {
      const node = (await snapshot()).chapters[0].nodes[0], data = JSON.parse(node.data)
      if (kind === 'text') data.text = '作者改稿'
      if (kind === 'scene') data.sceneGroupId = '作者的新场景'
      if (kind === 'audio') data.audio = { bgm: { url: '/uploads/author.ogg' } }
      if (kind === 'track') data.voiceTracks.ja.referenceId = 'wrong-reference'
      await client.flowNode.update({ where: { id: node.id }, data: { data: JSON.stringify(data) } })
    }
    if (kind === 'position') await client.flowNode.updateMany({ where: { chapterId: 'chapter-0' }, data: { positionX: 500 } })
    if (kind === 'extra') await client.chapter.create({ data: { projectId: id, order: 2, title: '作者的新章' } })
    if (kind === 'binding') await client.characterVoiceBinding.deleteMany()
    if (kind === 'reference') await client.asset.update({ where: { id: 'voice-asset' }, data: { metadata: JSON.stringify({ sha256: 'a'.repeat(64) }) } })
    const before = await snapshot()
    await expect(releasePaintBook(client, kind === 'owner' ? 'private' : 'official', options)).rejects.toThrow(/拒绝/)
    expect(await snapshot()).toEqual(before)
  })
  it('preflights every chapter before writes, rejecting a missing pack or music credit', async () => {
    const before = await snapshot()
    for (const index of [0, 1, 2]) {
      const missing = [...packRoots]; missing[index] = path.join(dir, 'absent')
      await expect(releasePaintBook(client, 'official', { ...options, packRoots: missing })).rejects.toThrow()
      expect(await snapshot()).toEqual(before)
    }
    const file = path.join(publicRoot, 'assets/audio/paint-book/music-credits.json'), credit = readFileSync(file)
    writeFileSync(file, '[]')
    try { await expect(releasePaintBook(client, 'official', options)).rejects.toThrow(/配乐署名/); expect(await snapshot()).toEqual(before) }
    finally { writeFileSync(file, credit) }
  })
  it.each(['version', 'fingerprint', 'reference'])('rechecks %s after preflight and preserves the racing edit', async kind => {
    const real = media.preflightPaintDefinition
    const spy = vi.spyOn(media, 'preflightPaintDefinition').mockImplementationOnce(async (...args) => {
      const result = await real(...args)
      if (kind === 'version') await client.chapter.update({ where: { id: 'chapter-1' }, data: { version: { increment: 1 } } })
      if (kind === 'fingerprint') await client.project.update({ where: { id }, data: { description: '刚完成的作者改稿' } })
      if (kind === 'reference') await client.asset.update({ where: { id: 'voice-asset' }, data: { metadata: '{}' } })
      return result
    })
    try { await expect(releasePaintBook(client, 'official', options)).rejects.toThrow(/拒绝/) }
    finally { spy.mockRestore() }
    const after = await snapshot()
    expect(after.chapters).toHaveLength(2)
    expect(after.chapters[0].version).toBe(7)
    if (kind === 'version') expect(after.chapters[1].version).toBe(6)
    if (kind === 'fingerprint') expect(after.description).toBe('刚完成的作者改稿')
  })
  it('keeps the exact existing reference ID when a profile has equivalent authorized references', async () => {
    await client.voiceReference.create({ data: { id: 'equivalent-reference', profile: { connect: { id: 'paint-voice-cheng' } }, language: 'ja', transcript: '参考句', authorizationConfirmed: true, asset: { create: { id: 'equivalent-asset', ownerId: 'official', type: 'VOICE_SAMPLE', name: 'same ref', url: '/uploads/same.wav', metadata: JSON.stringify({ sha256 }) } } } })
    const node = (await snapshot()).chapters[0].nodes[0], data = JSON.parse(node.data)
    data.voiceTracks.ja.referenceId = 'equivalent-reference'
    await client.flowNode.update({ where: { id: node.id }, data: { data: JSON.stringify(data) } })
    await releasePaintBook(client, 'official', options)
    expect(JSON.parse((await snapshot()).chapters[0].nodes[0].data).voiceTracks.ja.referenceId).toBe('equivalent-reference')
  })
})
