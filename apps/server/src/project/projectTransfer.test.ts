import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { exportProject, importProject } from './projectTransfer.js'

const databasePath = path.resolve('prisma', `project-transfer-${process.pid}-${randomUUID()}.db`)
const databaseUrl = `file:${databasePath.replaceAll('\\', '/')}`
const prismaCli = path.resolve('node_modules/prisma/build/index.js')
const schemaPath = path.resolve('prisma/schema.prisma')
const migrations = ['20260629065808_init', '20260629104058_add_source_handle', '20260711000000_add_creative_agent', '20260712010000_expand_agent_conversations', '20260712020000_add_agent_memory', '20260712030000_add_asset_variants']
const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } })

describe('project transfer', () => {
  beforeAll(async () => {
    rmSync(databasePath, { force: true })
    for (const migration of migrations) execFileSync(process.execPath, [prismaCli, 'db', 'execute', '--schema', schemaPath, '--file', path.resolve(`prisma/migrations/${migration}/migration.sql`)], { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' })
    await client.$connect()
    await client.user.create({ data: { id: 'owner', email: 'transfer@example.com', username: 'transfer', password: 'secret-hash' } })
    await client.project.create({ data: { id: 'project', title: '冬夜', description: '测试', authorId: 'owner', chapters: { create: { id: 'chapter', title: '第一章', nodes: { create: { nodeId: 'node-a', type: 'dialogue', positionX: 1, positionY: 2, data: '{"text":"雪"}' } } } }, characters: { create: { id: 'character', name: '雪', sprites: { create: { name: 'normal', url: '/uploads/snow.png' } } } }, storyBible: { create: { content: '{"worldSummary":"冬夜"}' } } } })
    await client.agentMemory.createMany({ data: [
      { projectId: 'project', userId: 'owner', kind: 'canon', status: 'active', title: '规则', content: '不能回头' },
      { projectId: 'project', userId: 'owner', kind: 'plot', status: 'forgotten', title: '废案', content: '删除' },
    ] })
  })
  afterAll(async () => { await client.$disconnect(); rmSync(databasePath, { force: true }) })

  it('exports a versioned safe manifest and imports it as a new project', async () => {
    const manifest = await exportProject('project', 'owner', client)
    expect(manifest.version).toBe(1)
    expect(manifest.memories.map((memory) => memory.title)).toEqual(['规则'])
    expect(JSON.stringify(manifest)).not.toContain('secret-hash')
    const imported = await importProject(manifest, 'owner', client)
    expect(imported.id).not.toBe('project')
    const copy = await client.project.findUniqueOrThrow({ where: { id: imported.id }, include: { chapters: { include: { nodes: true } }, characters: { include: { sprites: true } }, agentMemories: true } })
    expect(copy.chapters[0]?.nodes[0]?.nodeId).toBe('node-a')
    expect(copy.characters[0]?.sprites[0]?.name).toBe('normal')
    expect(copy.agentMemories[0]?.title).toBe('规则')
  })

  it('rejects invalid manifests instead of partially importing', async () => {
    await expect(importProject({ version: 99 }, 'owner', client)).rejects.toThrow('备份格式')
  })
})
