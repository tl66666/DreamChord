import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { exportProject, importProject } from './projectTransfer.js'

const databasePath = path.join(tmpdir(), `dreamchord-project-transfer-${process.pid}-${randomUUID()}.db`)
const databaseUrl = `file:${databasePath.replaceAll('\\', '/')}`
const storageRoot = path.join(tmpdir(), `dreamchord-project-transfer-${process.pid}-${randomUUID()}`)
const databaseProjectRoot = path.join(storageRoot, 'project')
const sourceImagePath = path.join(databaseProjectRoot, 'snow.png')
const databaseAssetUrl = '/uploads/project/snow.png'
const prismaCli = path.resolve('node_modules/prisma/build/index.js')
const schemaPath = path.resolve('prisma/schema.prisma')
const migrations = ['20260629065808_init', '20260629104058_add_source_handle', '20260711000000_add_creative_agent', '20260712010000_expand_agent_conversations', '20260712020000_add_agent_memory', '20260712030000_add_asset_variants', '20260712040000_global_asset_library']
const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
let sourceImage: Buffer

describe('project transfer', () => {
  beforeAll(async () => {
    rmSync(databasePath, { force: true })
    rmSync(storageRoot, { recursive: true, force: true })
    mkdirSync(databaseProjectRoot, { recursive: true })
    sourceImage = await sharp({ create: { width: 2, height: 2, channels: 4, background: { r: 20, g: 40, b: 60, alpha: 0.5 } } }).png().toBuffer()
    writeFileSync(sourceImagePath, sourceImage)
    for (const migration of migrations) execFileSync(process.execPath, [prismaCli, 'db', 'execute', '--schema', schemaPath, '--file', path.resolve(`prisma/migrations/${migration}/migration.sql`)], { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' })
    await client.$connect()
    await client.user.create({ data: { id: 'owner', email: 'transfer@example.com', username: 'transfer', password: 'secret-hash' } })
    await client.project.create({ data: {
      id: 'project', title: '冬夜', description: '测试', cover: databaseAssetUrl, authorId: 'owner',
      chapters: { create: { id: 'chapter', title: '第一章', nodes: { create: [
        { nodeId: 'node-a', type: 'character', positionX: 1, positionY: 2, data: JSON.stringify({ characterId: 'character', assetId: 'asset', spriteId: 'sprite', backgroundId: databaseAssetUrl, nested: { url: databaseAssetUrl } }) },
        { nodeId: 'node-b', type: 'dialogue', positionX: 3, positionY: 4, data: JSON.stringify({ text: '雪' }) },
      ] }, edges: { create: { edgeId: 'edge-a-b', source: 'node-a', target: 'node-b', animated: true } } } },
      characters: { create: { id: 'character', name: '雪', defaultSprite: databaseAssetUrl, sprites: { create: { id: 'sprite', name: 'normal', url: databaseAssetUrl } } } },
      assets: { create: { id: 'asset', ownerId: 'owner', name: '雪立绘', type: 'CG', url: databaseAssetUrl, mimeType: 'image/png', width: 2, height: 2, hasAlpha: true } },
      storyBible: { create: { content: JSON.stringify({ characterNotes: { character: { portrait: databaseAssetUrl, assetId: 'asset' } } }) } },
    } })
    await client.agentMemory.createMany({ data: [
      { projectId: 'project', userId: 'owner', kind: 'canon', status: 'active', title: '规则', content: '不能回头' },
      { projectId: 'project', userId: 'owner', kind: 'plot', status: 'forgotten', title: '废案', content: '删除' },
    ] })
  }, 30_000)
  afterAll(async () => { await client.$disconnect(); rmSync(databasePath, { force: true }); rmSync(storageRoot, { recursive: true, force: true }) })

  it('round-trips embedded bytes and remaps every project-owned reference', async () => {
    const manifest = await exportProject('project', 'owner', client, storageRoot)
    expect(manifest.version).toBe(2)
    expect(manifest.files).toHaveLength(1)
    expect(manifest.memories.map((memory) => memory.title)).toEqual(['规则'])
    expect(JSON.stringify(manifest)).not.toContain('secret-hash')

    const imported = await importProject(manifest, 'owner', client, storageRoot)
    expect(imported.id).not.toBe('project')
    const copy = await client.project.findUniqueOrThrow({ where: { id: imported.id }, include: { chapters: { include: { nodes: true, edges: true } }, characters: { include: { sprites: true } }, assets: true, storyBible: true, agentMemories: true } })
    const character = copy.characters[0]!
    const asset = copy.assets[0]!
    const sprite = character.sprites[0]!
    const node = copy.chapters[0]!.nodes.find((item) => JSON.parse(item.data).characterId)!
    const dialogue = copy.chapters[0]!.nodes.find((item) => item !== node)!
    const edge = copy.chapters[0]!.edges[0]!
    const data = JSON.parse(node.data) as Record<string, unknown>
    expect(character.id).not.toBe('character')
    expect(asset.id).not.toBe('asset')
    expect(sprite.id).not.toBe('sprite')
    expect(node.nodeId).not.toBe('node-a')
    expect(dialogue.nodeId).not.toBe('node-b')
    expect(edge.edgeId).not.toBe('edge-a-b')
    expect(edge).toMatchObject({ source: node.nodeId, target: dialogue.nodeId })
    expect(data).toMatchObject({ characterId: character.id, assetId: asset.id, spriteId: sprite.id, backgroundId: asset.url, nested: { url: asset.url } })
    expect(character.defaultSprite).toBe(asset.url)
    expect(sprite.url).toBe(asset.url)
    expect(copy.cover).toBe(asset.url)
    expect(JSON.parse(copy.storyBible!.content).characterNotes[character.id]).toEqual({ portrait: asset.url, assetId: asset.id })
    expect(copy.agentMemories[0]?.title).toBe('规则')
    expect(readFileSync(path.join(storageRoot, asset.url.slice('/uploads/'.length)))).toEqual(sourceImage)
  })

  it('embeds an owner asset referenced by a project even when it originated elsewhere', async () => {
    const globalUrl = '/uploads/library/owner/global-background.png'
    const globalPath = path.join(storageRoot, globalUrl.slice('/uploads/'.length))
    mkdirSync(path.dirname(globalPath), { recursive: true })
    writeFileSync(globalPath, sourceImage)
    const origin = await client.project.create({ data: { title: '素材来源', authorId: 'owner' } })
    const target = await client.project.create({ data: {
      title: '引用素材的故事', authorId: 'owner',
      chapters: { create: { title: '第一章', nodes: { create: { nodeId: 'global-node', type: 'background', positionX: 0, positionY: 0, data: JSON.stringify({ background: globalUrl }) } } } },
    } })
    await client.asset.create({ data: { ownerId: 'owner', projectId: origin.id, name: '全局港口背景', type: 'BACKGROUND', url: globalUrl, mimeType: 'image/png', width: 2, height: 2 } })

    try {
      const manifest = await exportProject(target.id, 'owner', client, storageRoot)
      expect(manifest.assets).toEqual(expect.arrayContaining([expect.objectContaining({ name: '全局港口背景' })]))
      expect(manifest.files).toHaveLength(1)
      expect(Buffer.from(manifest.files[0]!.data, 'base64')).toEqual(sourceImage)
    } finally {
      await client.project.delete({ where: { id: target.id } })
      await client.project.delete({ where: { id: origin.id } })
      rmSync(globalPath, { force: true })
    }
  })

  it('rejects unsafe or out-of-root source URLs during export', async () => {
    const unsafe = await client.asset.create({ data: { ownerId: 'owner', projectId: 'project', name: 'unsafe', type: 'CG', url: '/uploads/../outside.png', mimeType: 'image/png' } })
    await expect(exportProject('project', 'owner', client, storageRoot)).rejects.toThrow(/安全|路径/)
    await client.asset.delete({ where: { id: unsafe.id } })
    const manifest = await exportProject('project', 'owner', client, storageRoot)
    const count = await client.project.count()
    if (manifest.assets[0]!.resource.kind !== 'embedded') throw new Error('test fixture must embed its asset')
    manifest.assets[0]!.resource.sourceUrl = '/uploads/../outside.png'
    await expect(importProject(manifest, 'owner', client, storageRoot)).rejects.toThrow(/安全|路径|格式/)
    expect(await client.project.count()).toBe(count)
  })

  it('embeds a shared upload only once when multiple records reference it', async () => {
    const shared = await client.project.create({ data: {
      title: '共享素材', authorId: 'owner', cover: '/assets/covers/default-cover.png',
      assets: { create: [
        { ownerId: 'owner', name: '共享一', type: 'CG', url: databaseAssetUrl, mimeType: 'image/png' },
        { ownerId: 'owner', name: '共享二', type: 'BACKGROUND', url: databaseAssetUrl, mimeType: 'image/png' },
      ] },
    } })
    try {
      const manifest = await exportProject(shared.id, 'owner', client, storageRoot)
      expect(manifest.files).toHaveLength(1)
      expect(manifest.assets[0]!.resource).toEqual(manifest.assets[1]!.resource)
    } finally {
      await client.project.delete({ where: { id: shared.id } })
    }
  })

  it('rejects tampered MIME content before creating a project', async () => {
    const manifest = await exportProject('project', 'owner', client, storageRoot)
    const tampered = Buffer.from('not a png')
    manifest.files[0]!.data = tampered.toString('base64')
    manifest.files[0]!.byteLength = 9
    manifest.files[0]!.sha256 = createHash('sha256').update(tampered).digest('hex')
    const count = await client.project.count()
    await expect(importProject(manifest, 'owner', client, storageRoot)).rejects.toThrow(/图片|内容|校验/)
    expect(await client.project.count()).toBe(count)
  })

  it('rejects ambiguous IDs shared by different entity kinds', async () => {
    const manifest = await exportProject('project', 'owner', client, storageRoot)
    manifest.characters[0]!.id = manifest.assets[0]!.id
    await expect(importProject(manifest, 'owner', client, storageRoot)).rejects.toThrow(/重复|ID/)
  })

  it('allows node and edge IDs to repeat in different chapters', async () => {
    const manifest = await exportProject('project', 'owner', client, storageRoot)
    manifest.chapters.push({ ...structuredClone(manifest.chapters[0]!), id: 'chapter-two', title: '第二章' })

    const imported = await importProject(manifest, 'owner', client, storageRoot)
    expect(await client.chapter.count({ where: { projectId: imported.id } })).toBe(2)
  })

  it('enforces file and aggregate byte limits from decoded content', async () => {
    const manifest = await exportProject('project', 'owner', client, storageRoot)
    manifest.files[0]!.byteLength = 20 * 1024 * 1024 + 1
    await expect(importProject(manifest, 'owner', client, storageRoot)).rejects.toThrow(/大小|上限/)
  })

  it('explicitly rejects legacy v1 manifests that do not contain bytes', async () => {
    await expect(importProject({ format: 'dreamchord-project', version: 1 }, 'owner', client, storageRoot)).rejects.toThrow(/v1|旧版|素材字节/)
  })
})
