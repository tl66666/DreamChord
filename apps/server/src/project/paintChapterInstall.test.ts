import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { installPaintPrologue } from './paintTemplate.js'
import * as media from './paintTemplate.js'
import { installPaintChapterOne } from './paintChapterInstall.js'

const dir = path.join(tmpdir(), `paint-chapter-test-${randomUUID()}`)
const databaseUrl = `file:${path.join(dir, 'test.db').replaceAll('\\', '/')}`
const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
const options = { storageRoot: path.join(dir, 'uploads') }
const id = 'dreamchord-paint-prologue'
const snapshot = () => client.project.findUniqueOrThrow({ where: { id }, include: { chapters: { orderBy: { order: 'asc' }, include: { nodes: { orderBy: { nodeId: 'asc' } }, edges: { orderBy: { edgeId: 'asc' } } } }, characters: { include: { voiceBinding: true } } } })

describe('same-book first chapter installation', () => {
  beforeAll(async () => {
    mkdirSync(dir, { recursive: true })
    const sql = readdirSync('prisma/migrations').filter(n => /^\d/.test(n)).sort().map(n => readFileSync(`prisma/migrations/${n}/migration.sql`, 'utf8')).join('\n')
    execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'db', 'execute', '--schema', 'prisma/schema.prisma', '--stdin'], { input: sql, env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: ['pipe', 'pipe', 'pipe'] })
    await client.user.create({ data: { id: 'official', username: 'demo', email: 'test@invalid.example', password: 'fixture' } })
  }, 30000)
  beforeEach(async () => {
    await client.project.deleteMany()
    await client.voiceReference.deleteMany(); await client.voiceProfile.deleteMany(); await client.asset.deleteMany()
    await installPaintPrologue(client, 'official', id, true, options)
  })
  afterAll(async () => {
    await client.$disconnect()
    if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep)) throw new Error('Invalid test directory')
    rmSync(dir, { recursive: true, force: true })
  })
  it('appends chapter one, keeps prologue and voice identities byte-for-byte, then becomes a no-op', async () => {
    const before = await snapshot()
    const voices = await client.voiceProfile.findMany({ include: { references: true } })
    expect((await installPaintChapterOne(client, 'official', options)).status).toBe('installed')
    const after = await snapshot()
    expect(after.chapters).toHaveLength(2)
    expect(after.chapters[0]).toEqual(before.chapters[0])
    expect(after.characters).toEqual(before.characters)
    expect(await client.voiceProfile.findMany({ include: { references: true } })).toEqual(voices)
    expect(after.chapters[1].order).toBe(1)
    expect(after.chapters[1].title).toContain('第一章')
    expect(await client.project.count()).toBe(1)
    expect((await installPaintChapterOne(client, 'official', options)).status).toBe('current')
    expect(await snapshot()).toEqual(after)
  })
  it.each(['prologue', 'header', 'binding', 'extra-chapter'])('refuses edits to %s without touching them', async kind => {
    const before = await snapshot()
    if (kind === 'prologue') await client.flowNode.update({ where: { id: before.chapters[0].nodes[0].id }, data: { positionX: 987 } })
    if (kind === 'header') await client.project.update({ where: { id }, data: { title: '作者新标题' } })
    if (kind === 'binding') await client.characterVoiceBinding.deleteMany({ where: { characterId: before.characters[0].id } })
    if (kind === 'extra-chapter') await client.chapter.create({ data: { projectId: id, title: '作者续写', order: 1 } })
    const changed = await snapshot()
    await expect(installPaintChapterOne(client, 'official', options)).rejects.toThrow(/拒绝/)
    expect(await snapshot()).toEqual(changed)
  })
  it('refuses missing media and concurrent chapter changes before writing', async () => {
    const before = await snapshot()
    await expect(installPaintChapterOne(client, 'official', { ...options, packRoot: path.join(dir, 'missing') })).rejects.toThrow()
    expect(await snapshot()).toEqual(before)
    const real = media.preflightPaintDefinition
    const spy = vi.spyOn(media, 'preflightPaintDefinition').mockImplementationOnce(async (...args) => {
      const prepared = await real(...args)
      await client.chapter.update({ where: { id: before.chapters[0].id }, data: { version: { increment: 1 } } })
      return prepared
    })
    try { await expect(installPaintChapterOne(client, 'official', options)).rejects.toThrow(/预检期间/) }
    finally { spy.mockRestore() }
    expect((await snapshot()).chapters).toHaveLength(1)
  })
  it('refuses an unpublished source or incorrect owner', async () => {
    await expect(installPaintChapterOne(client, 'someone-else', options)).rejects.toThrow(/拒绝/)
    await client.project.update({ where: { id }, data: { isPublished: false } })
    await expect(installPaintChapterOne(client, 'official', options)).rejects.toThrow(/拒绝/)
    expect((await snapshot()).chapters).toHaveLength(1)
  })
})
