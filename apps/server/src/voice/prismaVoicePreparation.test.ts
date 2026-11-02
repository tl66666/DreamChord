import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { rmSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { commitPreparedVoice, scanProjectVoices } from './prismaVoicePreparation.js'
import { seedSeventhRow } from '../demo/seventhRowSeed.js'

const databasePath = path.join(tmpdir(), `dreamchord-voice-preparation-${randomUUID()}.db`)
const url = `file:${databasePath.replaceAll('\\', '/')}`
const client = new PrismaClient({ datasources: { db: { url } } })
describe('voice preparation persistence and edit safety', () => {
  beforeAll(async () => {
    const migrationRoot = path.resolve('prisma/migrations')
    const sql = readdirSync(migrationRoot).filter(name => /^\d/.test(name)).sort().map(name => readFileSync(path.join(migrationRoot, name, 'migration.sql'), 'utf8')).join('\n')
    execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'db', 'execute', '--schema', path.resolve('prisma/schema.prisma'), '--stdin'], { env: { ...process.env, DATABASE_URL: url }, input: sql, stdio: 'pipe' })
    await client.user.create({ data: { id: 'owner', username: 'owner', email: 'owner@example.com', password: 'hash' } })
    await client.project.create({ data: { id: 'project', authorId: 'owner', title: '测试作品', characters: { create: { id: 'character', name: '陈屿' } }, chapters: { create: [0, 1].map(order => ({ id: `chapter-${order}`, order, title: `章节${order}`, nodes: { create: [{ nodeId: `line-${order}`, type: 'dialogue', positionX: 0, positionY: 0, data: JSON.stringify({ role: '陈屿', text: `你好${order}` }) }, { nodeId: `narration-${order}`, type: 'dialogue', positionX: 0, positionY: 1, data: JSON.stringify({ role: '旁白', text: '雨停了。' }) }] } })) } } })
    await client.voiceProfile.create({ data: { id: 'voice', ownerId: 'owner', name: '音色', language: 'zh', authorizationNote: '原创合成', bindings: { create: { projectId: 'project', characterId: 'character' } }, references: { create: { id: 'reference', transcript: '早上好', language: 'ja', authorizationConfirmed: true, asset: { create: { ownerId: 'owner', name: '样本', type: 'VOICE_SAMPLE', url: '/uploads/reference.wav' } } } } } })
  })
  afterAll(async () => { await client.$disconnect(); rmSync(databasePath, { force: true }); rmSync(`${databasePath}-journal`, { force: true }) })
  it('scans every chapter, commits a Japanese track without changing Chinese text, and reuses it', async () => {
    const first = await scanProjectVoices('owner', 'project', 'ja', client)
    expect(first.pending).toHaveLength(2); expect(first.unbound).toBe(0)
    const line = first.pending[0]!
    expect(await commitPreparedVoice('owner', 'project', 'ja', line, { url: '/uploads/take.wav', text: 'こんにちは。' }, () => true, client)).toBe(true)
    const stored = await client.flowNode.findUniqueOrThrow({ where: { id: line.storedId } })
    const data = JSON.parse(stored.data)
    expect(data.text).toBe(line.text)
    expect(data.localizations.ja.text).toBe('こんにちは。')
    expect((await scanProjectVoices('owner', 'project', 'ja', client)).ready).toBe(1)
    expect(await commitPreparedVoice('owner', 'project', 'ja', line, { url: '/late.wav', text: 'old' }, () => true, client)).toBe(false)
  })
  it('refuses writes after source or binding changes, pausing, or ownership mismatch', async () => {
    const line = (await scanProjectVoices('owner', 'project', 'ja', client)).pending[0]!
    const take = { url: '/uploads/new.wav', text: '新しい声' }
    expect(await commitPreparedVoice('other', 'project', 'ja', line, take, () => true, client)).toBe(false)
    expect(await commitPreparedVoice('owner', 'project', 'ja', line, take, () => false, client)).toBe(false)
    await client.flowNode.update({ where: { id: line.storedId }, data: { data: JSON.stringify({ role: '陈屿', text: '我改了台词' }) } })
    expect(await commitPreparedVoice('owner', 'project', 'ja', line, take, () => true, client)).toBe(false)
    const fresh = (await scanProjectVoices('owner', 'project', 'ja', client)).pending[0]!
    await client.voiceReference.update({ where: { id: 'reference' }, data: { status: 'revoked' } })
    expect(await commitPreparedVoice('owner', 'project', 'ja', fresh, take, () => true, client)).toBe(false)
  })
  it('adds the new official project once and preserves subsequent author edits', async () => {
    const project = await seedSeventhRow(client, 'owner')
    await client.project.update({ where: { id: project.id }, data: { title: '我的修改版' } })
    const chapter = await client.chapter.findFirstOrThrow({ where: { projectId: project.id } })
    await client.chapter.update({ where: { id: chapter.id }, data: { title: '保留的章节', version: 4 } })
    await seedSeventhRow(client, 'owner')
    expect((await client.project.findUniqueOrThrow({ where: { id: project.id } })).title).toBe('我的修改版')
    expect(await client.chapter.findUnique({ where: { id: chapter.id } })).toMatchObject({ title: '保留的章节', version: 4 })
  })
})
