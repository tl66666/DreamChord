import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@dreamchord/story-domain', async importOriginal => ({
  ...await importOriginal<object>(),
  PAINT_PROLOGUE: {
    id: 'dreamchord-paint-prologue', title: '请让这幅画老去', description: '序章', cover: '/assets/paint-prologue/workshop.webp', chapterTitle: '序章：多出来的一把椅子',
    characters: ['cheng', 'xia', 'ye', 'lu'].map((slug, i) => ({ slug, name: ['程见', '夏禾', '许野', '陆青'][i], description: slug, color: '#abcabc', defaultSprite: `/assets/paint-prologue/${slug}-normal.png` })),
    graph: {
      nodes: [
        { id: 'bg', type: 'background', position: { x: 0, y: 0 }, data: { backgroundId: '/assets/paint-prologue/workshop.webp', sceneGroupId: 'workshop', audio: { bgm: { action: 'play', url: '/assets/audio/paint-prologue/workshop.ogg' } } } },
        ...['程见', '夏禾', '许野', '陆青'].map((role, i) => ({ id: `line-${i}`, type: 'dialogue', position: { x: 0, y: i * 100 + 100 }, data: { role, text: `台词${i}`, localizations: { ja: { text: `台詞${i}` } }, sceneGroupId: 'workshop', characterId: role, voiceTracks: { ja: { url: `/assets/audio/paint-prologue/line-${i}-ja.ogg`, profileId: `paint-voice-${['cheng', 'xia', 'ye', 'lu'][i]}`, referenceId: `${['cheng', 'xia', 'ye', 'lu'][i]}-ja` } } } })),
      ],
      edges: ['bg', 'line-0', 'line-1', 'line-2'].map((source, i) => ({ id: `edge-${i}`, source, target: `line-${i}`, animated: true })),
    },
  },
  PAINT_STARTER_CARD: { id: 'your-next-line', type: 'dialogue', position: { x: 0, y: 600 }, data: { role: '夏禾', text: '写下你的下一句。', localizations: { ja: { text: '次の台詞を書いて。' } }, creatorStarter: true, voiceTracks: { ja: { url: '/assets/audio/paint-prologue/your-next-line-ja.ogg', profileId: 'paint-voice-xia', referenceId: 'xia-ja' } } } },
}))

import { createPaintTemplate } from './paintTemplate.js'
import { seedPaintPrologue } from '../demo/paintPrologueSeed.js'

const dir = path.join(tmpdir(), `dreamchord-paint-${randomUUID()}`)
const packRoot = path.join(dir, 'pack'), publicRoot = path.join(dir, 'public'), storageRoot = path.join(dir, 'uploads')
const databaseUrl = `file:${path.join(dir, 'test.db').replaceAll('\\', '/')}`
const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
const options = { client, packRoot, publicRoot, storageRoot }
const bytes = Buffer.from('trusted-small-media-fixture')
const sha256 = createHash('sha256').update(bytes).digest('hex')
let manifest: object

describe('paint prologue trusted seed and private template', () => {
  beforeAll(async () => {
    mkdirSync(packRoot, { recursive: true })
    const sql = readdirSync('prisma/migrations').filter(n => /^\d/.test(n)).sort().map(n => readFileSync(`prisma/migrations/${n}/migration.sql`, 'utf8')).join('\n')
    execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'db', 'execute', '--schema', 'prisma/schema.prisma', '--stdin'], { input: sql, env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: ['pipe', 'pipe', 'pipe'] })
    await client.user.createMany({ data: ['official', 'alice', 'bob'].map(id => ({ id, username: id, email: `${id}@test.invalid`, password: 'test' })) })
    const voices = ['cheng', 'xia', 'ye', 'lu'].map((id, i) => ({ id, role: ['程见', '夏禾', '许野', '陆青'][i], name: id, description: id, genderTone: '青年' }))
    const references = voices.map(v => {
      const outputFile = `ref-${v.id}-ja.wav`
      writeFileSync(path.join(packRoot, outputFile), bytes)
      return { id: `${v.id}-ja`, role: v.id, language: 'ja', text: '参照台詞。', outputFile, sha256, durationSeconds: 5 }
    })
    const put = (url: string) => { const file = path.join(publicRoot, url); mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, bytes) }
    put('/assets/paint-prologue/workshop.webp')
    put('/assets/paint-prologue/night.webp')
    for (const v of voices) for (const expression of ['normal', 'smile', 'serious']) put(`/assets/paint-prologue/${v.id}-${expression}.png`)
    put('/assets/audio/paint-prologue/workshop.ogg')
    writeFileSync(path.join(publicRoot, 'assets/audio/paint-prologue/music-credits.json'), JSON.stringify([{ id: 'workshop', name: 'fixture music', runtimeFile: '/assets/audio/paint-prologue/workshop.ogg', runtimeSha256: sha256, author: 'fixture author', license: 'CC0-1.0', sourceUrl: 'https://example.invalid/music', durationSeconds: 10 }]))
    const takes = voices.map((v, i) => { const runtimeFile = `/assets/audio/paint-prologue/line-${i}-ja.ogg`; put(runtimeFile); return { id: `line-${i}`, nodeId: `line-${i}`, role: v.id, language: 'ja', text: `台詞${i}`, runtimeFile, runtimeSha256: sha256 } })
    put('/assets/audio/paint-prologue/your-next-line-ja.ogg')
    takes.push({ id: 'your-next-line', nodeId: 'your-next-line', role: 'xia', language: 'ja', text: '次の台詞を書いて。', runtimeFile: '/assets/audio/paint-prologue/your-next-line-ja.ogg', runtimeSha256: sha256 })
    manifest = { voices, references, takes }
    writeFileSync(path.join(packRoot, 'manifest.json'), JSON.stringify(manifest))
  }, 30000)
  afterAll(async () => {
    await client.$disconnect()
    if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep)) throw new Error('Invalid test directory')
    rmSync(dir, { recursive: true, force: true })
  })

  it('fails before installing any database rows when a trusted reference hash is wrong', async () => {
    writeFileSync(path.join(packRoot, 'ref-cheng-ja.wav'), 'corrupt')
    await expect(seedPaintPrologue(client, 'official', options)).rejects.toThrow(/校验/)
    expect(await client.project.count()).toBe(0)
    expect(await client.voiceProfile.count()).toBe(0)
    writeFileSync(path.join(packRoot, 'ref-cheng-ja.wav'), bytes)
  })

  it('fails before installation when runtime media is missing or has changed', async () => {
    const file = path.join(publicRoot, 'assets/audio/paint-prologue/line-0-ja.ogg')
    renameSync(file, `${file}.bak`)
    await expect(seedPaintPrologue(client, 'official', options)).rejects.toThrow()
    writeFileSync(file, 'corrupt runtime')
    await expect(seedPaintPrologue(client, 'official', options)).rejects.toThrow(/校验/)
    expect(await client.project.count()).toBe(0)
    writeFileSync(file, bytes)
  })

  it('creates an official project once and preserves edited official and unrelated legacy projects', async () => {
    await client.project.create({ data: { id: 'legacy', authorId: 'official', title: '旧作品', chapters: { create: { title: '旧章', order: 0 } } } })
    await seedPaintPrologue(client, 'official', options)
    await client.project.update({ where: { id: 'dreamchord-paint-prologue' }, data: { title: '已编辑官方作品' } })
    const snapshot = await client.project.findMany({ include: { chapters: { include: { nodes: true, edges: true } }, characters: true } })
    await seedPaintPrologue(client, 'official', { ...options, packRoot: path.join(dir, 'nonexistent') })
    expect(await client.project.findMany({ include: { chapters: { include: { nodes: true, edges: true } }, characters: true } })).toEqual(snapshot)
  })

  it('clones only the trusted built-in prologue with fully owned voices and one connected editable next line', async () => {
    const before = await client.project.findUniqueOrThrow({ where: { id: 'dreamchord-paint-prologue' }, include: { chapters: { include: { nodes: true, edges: true } } } })
    const requestId = randomUUID()
    const entry = await createPaintTemplate('alice', requestId, options)
    const copy = await client.project.findUniqueOrThrow({ where: { id: entry.id }, include: { assets: true, chapters: { include: { nodes: true, edges: true } }, characters: { include: { voiceBinding: { include: { profile: { include: { references: { include: { asset: true } } } } } } } } } })
    expect(copy).toMatchObject({ authorId: 'alice', isPublic: false, isPublished: false, defaultSubtitleLocale: 'zh', defaultVoiceLocale: 'ja' })
    expect(copy.chapters).toHaveLength(1)
    expect(copy.title).not.toBe(before.title)
    expect(copy.assets.filter(a => a.type === 'BGM')).toHaveLength(1)
    expect(copy.assets.every(a => a.ownerId === 'alice')).toBe(true)
    const chapter = copy.chapters[0], nodes = chapter.nodes.map(n => ({ ...n, data: JSON.parse(n.data) }))
    const starter = nodes.filter(n => n.data.creatorStarter)
    expect(starter).toHaveLength(1)
    expect(entry).toMatchObject({ focusNodeId: starter[0].nodeId, focusSceneId: starter[0].data.sceneGroupId })
    expect(starter[0].data.sceneCode).toBe('1-5')
    const ending = nodes.find(n => n.data.text === '台词3')!
    const background = nodes.find(n => n.type === 'background' && n.data.sceneGroupId === entry.focusSceneId)!
    const character = nodes.find(n => n.type === 'character' && n.data.sceneGroupId === entry.focusSceneId)!
    expect(background?.data.backgroundId).toBe('/assets/paint-prologue/night.webp')
    expect(background?.data.sceneCode).toBe('1-5')
    expect(character?.data.sceneCode).toBe('1-5')
    expect(character?.data).toMatchObject({ expression: 'normal', position: 'center', action: 'show' })
    expect(copy.characters.find(c => c.id === character.data.characterId)?.name).toBe('夏禾')
    for (const [source, target] of [[ending.nodeId, background.nodeId], [background.nodeId, character.nodeId], [character.nodeId, entry.focusNodeId]]) expect(chapter.edges.some(e => e.source === source && e.target === target)).toBe(true)
    expect(chapter.edges.some(e => e.source === ending.nodeId && e.target === entry.focusNodeId)).toBe(false)
    expect(nodes.every(n => !['bg', 'line-0', 'line-1', 'line-2', 'line-3', 'your-next-line'].includes(n.nodeId) && n.data.sceneGroupId !== 'workshop')).toBe(true)
    const profiles = new Set(copy.characters.map(c => c.voiceBinding!.profileId))
    const refs = new Set(copy.characters.flatMap(c => c.voiceBinding!.profile.references.map(r => r.id)))
    expect(nodes.filter(n => n.data.voiceTracks).every(n => profiles.has(n.data.voiceTracks.ja.profileId) && refs.has(n.data.voiceTracks.ja.referenceId))).toBe(true)
    for (const c of copy.characters) {
      expect(c.voiceBinding!.profile).toMatchObject({ ownerId: 'alice', provider: 'gpt-sovits', language: 'ja' })
      expect(c.voiceBinding!.profile.references).toHaveLength(1)
      expect(c.voiceBinding!.profile.references[0].asset).toMatchObject({ ownerId: 'alice' })
      expect(c.voiceBinding!.profile.references[0].asset.url).toMatch(/^\/uploads\/templates\/paint-prologue\//)
      expect(nodes.filter(n => n.data.characterId).every(n => copy.characters.some(character => character.id === n.data.characterId))).toBe(true)
    }
    await client.project.update({ where: { id: entry.id }, data: { title: '作者的新标题' } })
    expect(await createPaintTemplate('alice', requestId, { ...options, packRoot: path.join(dir, 'missing') })).toEqual({ ...entry, title: '作者的新标题' })
    const other = await createPaintTemplate('bob', requestId, options)
    expect(other.id).not.toBe(entry.id)
    const bobProfiles = await client.voiceProfile.findMany({ where: { ownerId: 'bob' } })
    expect(bobProfiles).toHaveLength(4)
    expect(bobProfiles.every(p => !profiles.has(p.id))).toBe(true)
    expect(await client.project.findUniqueOrThrow({ where: { id: before.id }, include: { chapters: { include: { nodes: true, edges: true } } } })).toEqual(before)
  })

  it('rejects invalid idempotency keys and unsafe manifest reference paths without database writes', async () => {
    await expect(createPaintTemplate('alice', '../not-a-uuid', options)).rejects.toThrow(/请求/)
    const count = await client.project.count()
    const bad = JSON.parse(JSON.stringify(manifest))
    bad.references[0].outputFile = '../outside.wav'
    writeFileSync(path.join(packRoot, 'manifest.json'), JSON.stringify(bad))
    await expect(createPaintTemplate('alice', randomUUID(), options)).rejects.toThrow()
    expect(await client.project.count()).toBe(count)
    writeFileSync(path.join(packRoot, 'manifest.json'), JSON.stringify(manifest))
  })

  it('installs multiple acting references and maps each runtime take to its selected owned reference, ignoring auditions', async () => {
    const expanded = JSON.parse(JSON.stringify(manifest))
    expanded.references.push({ ...expanded.references[0], id: 'cheng-serious', emotion: 'serious', outputFile: 'ref-cheng-serious-ja.wav', sourceModel: 'fixture-model', license: 'Apache-2.0', source: 'https://example.invalid/model' })
    writeFileSync(path.join(packRoot, 'ref-cheng-serious-ja.wav'), bytes)
    expanded.takes[0].referenceId = 'cheng-serious'
    expanded.takes.push({ id: 'audition', purpose: 'audition', outputFile: 'not-a-runtime.wav' })
    writeFileSync(path.join(packRoot, 'manifest.json'), JSON.stringify(expanded))
    try {
      const entry = await createPaintTemplate('alice', randomUUID(), options)
      const binding = await client.characterVoiceBinding.findFirstOrThrow({ where: { projectId: entry.id, character: { name: '程见' } }, include: { profile: { include: { references: { include: { asset: true } } } } } })
      expect(binding.profile.references).toHaveLength(2)
      const serious = binding.profile.references.find(r => r.emotion === 'serious')!
      expect(JSON.parse(serious.asset.metadata)).toMatchObject({ sourceModel: 'fixture-model', sourceLicense: 'Apache-2.0', source: 'https://example.invalid/model' })
      const node = await client.flowNode.findFirstOrThrow({ where: { chapter: { projectId: entry.id }, data: { contains: '台词0' } } })
      expect(JSON.parse(node.data).voiceTracks.ja.referenceId).toBe(serious.id)
    } finally { writeFileSync(path.join(packRoot, 'manifest.json'), JSON.stringify(manifest)) }
  })

  it('validates starter-only voice media before creating a private template', async () => {
    const file = path.join(publicRoot, 'assets/audio/paint-prologue/your-next-line-ja.ogg')
    writeFileSync(file, 'corrupt starter voice')
    const count = await client.project.count()
    try {
      await expect(createPaintTemplate('alice', randomUUID(), options)).rejects.toThrow(/校验/)
      expect(await client.project.count()).toBe(count)
    } finally { writeFileSync(file, bytes) }
  })

  it('validates the fixed private starter background before creating database rows', async () => {
    const file = path.join(publicRoot, 'assets/paint-prologue/night.webp')
    renameSync(file, `${file}.bak`)
    const count = await client.project.count()
    try {
      await expect(createPaintTemplate('alice', randomUUID(), options)).rejects.toThrow()
      expect(await client.project.count()).toBe(count)
    } finally { renameSync(`${file}.bak`, file) }
  })

  it.each([
    ['text', '古い台詞。'], ['nodeId', 'other-node'], ['role', 'xia'], ['language', 'zh'],
  ])('rejects a runtime take with stale %s metadata before writing a project or voices', async (field, value) => {
    const stale = JSON.parse(JSON.stringify(manifest))
    stale.takes[0][field] = value
    writeFileSync(path.join(packRoot, 'manifest.json'), JSON.stringify(stale))
    const projects = await client.project.count(), profiles = await client.voiceProfile.count()
    try {
      await expect(createPaintTemplate('alice', randomUUID(), options)).rejects.toThrow(/不一致/)
      expect(await client.project.count()).toBe(projects)
      expect(await client.voiceProfile.count()).toBe(profiles)
    } finally { writeFileSync(path.join(packRoot, 'manifest.json'), JSON.stringify(manifest)) }
  })
})


