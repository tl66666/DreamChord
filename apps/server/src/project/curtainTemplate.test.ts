import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { createCurtainTemplate } from './curtainTemplate.js'

const dir = path.join(tmpdir(), `dreamchord-curtain-${randomUUID()}`)
const db = path.join(dir, 'test.db'), packRoot = path.join(dir, 'pack'), storageRoot = path.join(dir, 'uploads')
const databaseUrl = `file:${db.replaceAll('\\', '/')}`
const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
describe('official template ownership and creator entry', () => {
  beforeAll(async () => {
    mkdirSync(packRoot, { recursive: true })
    const sql = readdirSync('prisma/migrations').filter(n => /^\d/.test(n)).sort().map(n => readFileSync(`prisma/migrations/${n}/migration.sql`, 'utf8')).join('\n')
    execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'db', 'execute', '--schema', 'prisma/schema.prisma', '--stdin'], { input: sql, env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: ['pipe', 'pipe', 'pipe'] })
    await client.user.createMany({ data: ['alice', 'bob'].map(id => ({ id, username: id, email: `${id}@test.invalid`, password: 'test' })) })
    const bytes = Buffer.from('trusted-fixture-audio')
    const voices = ['zhi', 'tang', 'lin'].map((id, i) => ({ id, role: ['许栀', '唐棠', '林澈'][i], name: id, description: id, genderTone: i === 2 ? '男声' : '女声' }))
    const references = voices.flatMap(v => ['zh', 'ja'].map(language => {
      const outputFile = `ref-${v.id}-${language}.wav`
      writeFileSync(path.join(packRoot, outputFile), bytes)
      return { id: `${v.id}-${language}`, role: v.id, language, text: '参考台词', outputFile, sha256: createHash('sha256').update(bytes).digest('hex'), durationSeconds: 5 }
    }))
    writeFileSync(path.join(packRoot, 'manifest.json'), JSON.stringify({ voices, references }))
  }, 30000)
  afterAll(async () => {
    await client.$disconnect()
    // This literal per-test directory was created above and never accepts a user path.
    if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep)) throw new Error('Invalid test directory')
    rmSync(dir, { recursive: true, force: true })
  })
  it('creates an editable private copy with owned references, remapped bilingual profiles and a connected third ending', async () => {
    const requestId = randomUUID()
    const entry = await createCurtainTemplate('alice', requestId, { client, packRoot, storageRoot })
    const copy = await client.project.findUniqueOrThrow({ where: { id: entry.id }, include: { chapters: { include: { nodes: true, edges: true } }, characters: { include: { voiceBinding: { include: { profile: { include: { references: { include: { asset: true } } } } } } } } } })
    expect(copy).toMatchObject({ authorId: 'alice', isPublic: false, isPublished: false, defaultVoiceLocale: 'ja', defaultSubtitleLocale: 'zh' })
    expect(copy.characters).toHaveLength(3)
    expect(await client.asset.count({ where: { projectId: copy.id, type: 'BGM' } })).toBe(4)
    for (const c of copy.characters) {
      expect(c.voiceBinding!.profile.ownerId).toBe('alice')
      expect(c.voiceBinding!.profile.provider).toBe('gpt-sovits')
      expect(c.voiceBinding!.profile.references.map(r => r.language).sort()).toEqual(['ja', 'zh'])
      expect(c.voiceBinding!.profile.references.every(r => r.asset.ownerId === 'alice' && r.asset.url.startsWith('/uploads/templates/'))).toBe(true)
    }
    const chapter = copy.chapters[0]!, nodes = chapter.nodes.map(n => ({ ...n, data: JSON.parse(n.data) }))
    const starter = nodes.find(n => n.data.creatorStarter)!
    expect(entry).toMatchObject({ focusNodeId: starter.nodeId, focusSceneId: starter.data.sceneGroupId })
    expect(chapter.edges.some(e => e.target === starter.nodeId)).toBe(true)
    const choice = nodes.find(n => n.type === 'choice')!
    expect(choice.data.choices).toHaveLength(3)
    expect(chapter.edges.filter(e => e.source === choice.nodeId)).toHaveLength(3)
    const profiles = new Set(copy.characters.map(c => c.voiceBinding!.profileId))
    expect(nodes.filter(n => n.type === 'dialogue').every(n => profiles.has(n.data.voiceTracks.ja.profileId))).toBe(true)
    expect(nodes.every(n => n.nodeId !== 'your-first-line')).toBe(true)
    const again = await createCurtainTemplate('alice', requestId, { client, packRoot, storageRoot })
    expect(again).toEqual(entry)
    expect(await client.project.count({ where: { authorId: 'alice' } })).toBe(1)
    const other = await createCurtainTemplate('bob', requestId, { client, packRoot, storageRoot })
    expect(other.id).not.toBe(entry.id)
    expect(await client.project.count({ where: { authorId: 'bob' } })).toBe(1)
  })
})
