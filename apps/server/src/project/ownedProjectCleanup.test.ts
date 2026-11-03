import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { deleteBackedUpOwnedProjects, loadProjectCleanupSnapshot, projectCleanupFingerprint } from './ownedProjectCleanup.js'

const dir = path.join(tmpdir(), `dreamchord-owned-cleanup-${randomUUID()}`)
const databaseUrl = `file:${path.join(dir, 'test.db').replaceAll('\\', '/')}`
const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
const expected = async (ids = ['candidate-a', 'candidate-b']) => Promise.all(ids.map(async projectId => ({ projectId, fingerprint: projectCleanupFingerprint(await loadProjectCleanupSnapshot(projectId, 'alice', client)) })))

describe('backed-up owner-scoped project cleanup without media GC', () => {
  beforeAll(async () => {
    mkdirSync(dir, { recursive: true })
    const sql = readdirSync('prisma/migrations').filter(n => /^\d/.test(n)).sort().map(n => readFileSync(`prisma/migrations/${n}/migration.sql`, 'utf8')).join('\n')
    execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'db', 'execute', '--schema', 'prisma/schema.prisma', '--stdin'], { input: sql, env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: ['pipe', 'pipe', 'pipe'] })
    await client.user.createMany({ data: ['alice', 'bob'].map(id => ({ id, username: id, email: `${id}@test.invalid`, password: 'test' })) })
  }, 30000)
  beforeEach(async () => {
    await client.project.deleteMany(); await client.voiceProfile.deleteMany(); await client.asset.deleteMany()
    await client.voiceProfile.create({ data: { id: 'voice', ownerId: 'alice', name: '共享音色', language: 'ja', authorizationNote: 'fixture' } })
    for (const id of ['candidate-a', 'candidate-b', 'retained']) await client.project.create({ data: {
      id, authorId: 'alice', title: id, chapters: { create: { id: `${id}-chapter`, order: 0, title: '第一章', nodes: { create: { nodeId: 'line', type: 'dialogue', positionX: 0, positionY: 0, data: JSON.stringify({ text: '保留此刻的正文', voiceTracks: { ja: { url: '/uploads/shared.ogg' } } }) } } } },
      assets: { create: { id: `${id}-asset`, ownerId: 'alice', name: '声音素材', type: 'VOICE', url: '/uploads/shared.ogg' } },
      characters: { create: { id: `${id}-character`, name: '角色', voiceBinding: { create: { projectId: id, profileId: 'voice' } } } },
    } })
    await client.project.create({ data: { id: 'foreign', authorId: 'bob', title: '其他作者的作品' } })
  })
  afterAll(async () => { await client.$disconnect(); if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep)) throw new Error('Invalid test directory'); rmSync(dir, { recursive: true, force: true }) })

  it('deletes only backed-up owned rows atomically while preserving all media assets, voices and retained projects', async () => {
    const retained = await loadProjectCleanupSnapshot('retained', 'alice', client)
    const result = await deleteBackedUpOwnedProjects('alice', await expected(), client)
    expect(result.deletedProjectIds.sort()).toEqual(['candidate-a', 'candidate-b'])
    expect(await client.project.count()).toBe(2)
    expect(await client.asset.count()).toBe(3)
    expect(await client.asset.findUniqueOrThrow({ where: { id: 'candidate-a-asset' } })).toMatchObject({ projectId: null, ownerId: 'alice', url: '/uploads/shared.ogg' })
    expect(await client.voiceProfile.count()).toBe(1)
    expect(await client.characterVoiceBinding.count()).toBe(1)
    expect(await loadProjectCleanupSnapshot('retained', 'alice', client)).toEqual(retained)
  })

  it('refuses a foreign owner and leaves the entire batch untouched', async () => {
    const snapshots = await expected()
    await expect(deleteBackedUpOwnedProjects('bob', snapshots, client)).rejects.toThrow(/归属/)
    expect(await client.project.count()).toBe(4)
  })

  it.each(['node', 'message', 'metadata'])('refuses a post-backup %s change before deleting any candidate', async kind => {
    const snapshots = await expected()
    if (kind === 'node') await client.flowNode.updateMany({ where: { chapterId: 'candidate-b-chapter' }, data: { data: JSON.stringify({ text: '备份以后作者改写' }) } })
    else if (kind === 'metadata') await client.project.update({ where: { id: 'candidate-b' }, data: { title: '刚刚改的标题' } })
    else await client.agentConversation.create({ data: { projectId: 'candidate-b', userId: 'alice', title: '新会话', scope: 'project', messages: { create: { role: 'user', content: '刚刚写下的想法' } } } })
    await expect(deleteBackedUpOwnedProjects('alice', snapshots, client)).rejects.toThrow(/变化|指纹/)
    expect(await client.project.count()).toBe(4)
  })

  it('refuses duplicate or empty receipt lists without deleting data', async () => {
    const snapshots = await expected()
    await expect(deleteBackedUpOwnedProjects('alice', [], client)).rejects.toThrow(/清理/)
    await expect(deleteBackedUpOwnedProjects('alice', [snapshots[0], snapshots[0]], client)).rejects.toThrow(/清理/)
    expect(await client.project.count()).toBe(4)
  })
})
