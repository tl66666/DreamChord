import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { PrismaClient } from '@prisma/client'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AssetInUseError, PrismaAssetService } from './assetService.js'

const root = path.join(tmpdir(), `dreamchord-asset-service-${process.pid}-${randomUUID()}`)
const databasePath = `${root}.db`
const databaseUrl = `file:${databasePath.replaceAll('\\', '/')}`
const prismaCli = path.resolve('node_modules/prisma/build/index.js')
const schemaPath = path.resolve('prisma/schema.prisma')
const migrations = ['20260629065808_init', '20260629104058_add_source_handle', '20260711000000_add_creative_agent', '20260712010000_expand_agent_conversations', '20260712020000_add_agent_memory', '20260712030000_add_asset_variants', '20260712040000_global_asset_library']
const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
const service = new PrismaAssetService(client, root)

describe('asset service', () => {
  beforeAll(async () => {
    rmSync(databasePath, { force: true }); rmSync(root, { recursive: true, force: true }); mkdirSync(root, { recursive: true })
    for (const migration of migrations) execFileSync(process.execPath, [prismaCli, 'db', 'execute', '--schema', schemaPath, '--file', path.resolve(`prisma/migrations/${migration}/migration.sql`)], { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' })
    await client.$connect()
    await client.user.create({ data: { id: 'owner', email: 'asset-owner@example.com', username: 'asset-owner', password: 'hash' } })
    await client.project.create({ data: { id: 'project', title: '故事', authorId: 'owner' } })
    await client.project.create({ data: { id: 'project-two', title: '另一个故事', authorId: 'owner' } })
    const source = await sharp({ create: { width: 80, height: 120, channels: 3, background: 'white' } }).png().toBuffer()
    writeFileSync(path.join(root, 'source.png'), source)
    await client.asset.create({ data: { id: 'original', ownerId: 'owner', projectId: 'project', name: '人物原图', type: 'CG', url: '/uploads/source.png' } })
  })
  afterAll(async () => { await client.$disconnect(); rmSync(databasePath, { force: true }); rmSync(root, { recursive: true, force: true }) })

  it('stores explicit user ownership and keeps the source project optional', async () => {
    const columns = await client.$queryRawUnsafe<Array<{ name: string; notnull: number }>>('PRAGMA table_info(assets)')
    expect(Number(columns.find((column) => column.name === 'owner_id')?.notnull)).toBe(1)
    expect(Number(columns.find((column) => column.name === 'project_id')?.notnull)).toBe(0)
  })

  it('accepts a sprite into the global library without binding a character', async () => {
    const variant = await service.process('original', 'owner', { purpose: 'sprite', removeWhite: true, trim: true })
    const accepted = await service.accept(variant.id, 'owner', { purpose: 'sprite' })

    expect(accepted.character).toBeNull()
    expect(accepted.asset).toMatchObject({ ownerId: 'owner', projectId: 'project' })
  })

  it('binds an accepted sprite only to the explicitly selected owned project', async () => {
    const variant = await service.process('original', 'owner', { purpose: 'sprite', removeWhite: true, trim: true })
    const accepted = await service.accept(variant.id, 'owner', { purpose: 'sprite', projectId: 'project-two', characterName: '雪' })

    expect(accepted.character?.name).toBe('雪')
    expect(await client.character.findFirst({ where: { id: accepted.character?.id, projectId: 'project-two' } })).toBeTruthy()
    expect(await client.character.findFirst({ where: { id: accepted.character?.id, projectId: 'project' } })).toBeNull()
  })

  it('keeps a global asset when its source project is deleted', async () => {
    const sourceProject = await client.project.create({ data: { title: '临时来源', authorId: 'owner' } })
    const asset = await client.asset.create({ data: { ownerId: 'owner', projectId: sourceProject.id, name: '共享背景', url: '/uploads/shared-origin.png' } })

    await client.project.delete({ where: { id: sourceProject.id } })

    expect(await client.asset.findUnique({ where: { id: asset.id } })).toMatchObject({ ownerId: 'owner', projectId: null })
  })

  it('processes a proposed sprite and accepts it as a character expression while preserving the original', async () => {
    const variant = await service.process('original', 'owner', { purpose: 'sprite', removeWhite: true, trim: true, whiteThreshold: 245, feather: 8 })
    expect(variant).toMatchObject({ kind: 'sprite', status: 'proposed', width: 1024, height: 1536 })
    const accepted = await service.accept(variant.id, 'owner', { purpose: 'sprite', projectId: 'project', characterName: '雪', expressionName: 'normal' })
    expect(accepted.character?.name).toBe('雪')
    expect(await client.sprite.findFirst({ where: { characterId: accepted.character?.id, name: 'normal' } })).toBeTruthy()
    expect((await client.asset.findUnique({ where: { id: 'original' } }))?.url).toBe('/uploads/source.png')
  })

  it('inspects the owned source pixels and returns a preparation recommendation', async () => {
    const inspection = await service.inspect('original', 'owner')
    expect(inspection.asset).toMatchObject({ id: 'original', url: '/uploads/source.png' })
    expect(inspection.analysis).toMatchObject({ background: 'flat-light', recommendedPurpose: 'sprite' })
    await expect(service.inspect('original', 'someone-else')).rejects.toThrow()
  })

  it('rejects a derivative without deleting its original', async () => {
    const variant = await service.process('original', 'owner', { purpose: 'cg', trim: false })
    await service.reject(variant.id, 'owner')
    expect((await client.assetVariant.findUnique({ where: { id: variant.id } }))?.status).toBe('rejected')
    expect(await client.asset.findUnique({ where: { id: 'original' } })).toBeTruthy()
    expect(existsSync(path.join(root, variant.url.slice('/uploads/'.length)))).toBe(false)
  })

  it('refuses to delete an accepted derived sprite while a character uses its URL', async () => {
    const variant = await service.process('original', 'owner', { purpose: 'sprite', trim: false })
    const accepted = await service.accept(variant.id, 'owner', { purpose: 'sprite', projectId: 'project', characterName: 'Mina', expressionName: 'happy' })
    const variantPath = path.join(root, variant.url.slice('/uploads/'.length))

    await expect(service.delete(accepted.asset.id, 'owner')).rejects.toBeInstanceOf(AssetInUseError)

    expect(await client.asset.findUnique({ where: { id: accepted.asset.id } })).toBeTruthy()
    expect(await client.sprite.findFirst({ where: { url: variant.url } })).toBeTruthy()
    expect(existsSync(variantPath)).toBe(true)
  })

  it('refuses to delete or replace an asset while a story node uses its URL', async () => {
    const url = '/uploads/used-background.png'
    writeFileSync(path.join(root, 'used-background.png'), 'background')
    const asset = await client.asset.create({ data: { ownerId: 'owner', projectId: 'project', name: 'used background', type: 'BACKGROUND', url } })
    const chapter = await client.chapter.create({ data: { projectId: 'project', title: 'usage chapter' } })
    await client.flowNode.create({ data: { chapterId: chapter.id, nodeId: 'usage-node', type: 'dialogue', positionX: 0, positionY: 0, data: JSON.stringify({ background: url }) } })

    await expect(service.assertReplaceable(asset.id, 'owner')).rejects.toBeInstanceOf(AssetInUseError)
    await expect(service.delete(asset.id, 'owner')).rejects.toBeInstanceOf(AssetInUseError)
    expect(existsSync(path.join(root, 'used-background.png'))).toBe(true)
  })

  it('deletes an original and all unreferenced proposed and rejected variant files', async () => {
    writeFileSync(path.join(root, 'delete-source.png'), 'source')
    const original = await client.asset.create({ data: { ownerId: 'owner', projectId: 'project', name: 'delete me', type: 'CG', url: '/uploads/delete-source.png' } })
    const proposedUrl = '/uploads/project/variants/proposed.png'
    const rejectedUrl = '/uploads/project/variants/rejected.png'
    mkdirSync(path.join(root, 'project', 'variants'), { recursive: true })
    writeFileSync(path.join(root, proposedUrl.slice('/uploads/'.length)), 'proposed')
    writeFileSync(path.join(root, rejectedUrl.slice('/uploads/'.length)), 'rejected')
    await client.assetVariant.createMany({ data: [
      { assetId: original.id, kind: 'cg', status: 'proposed', url: proposedUrl, mimeType: 'image/png', width: 1, height: 1 },
      { assetId: original.id, kind: 'cg', status: 'rejected', url: rejectedUrl, mimeType: 'image/png', width: 1, height: 1 },
    ] })

    await service.delete(original.id, 'owner')

    expect(await client.asset.findUnique({ where: { id: original.id } })).toBeNull()
    expect(await client.assetVariant.count({ where: { assetId: original.id } })).toBe(0)
    expect(existsSync(path.join(root, 'delete-source.png'))).toBe(false)
    expect(existsSync(path.join(root, proposedUrl.slice('/uploads/'.length)))).toBe(false)
    expect(existsSync(path.join(root, rejectedUrl.slice('/uploads/'.length)))).toBe(false)
  })

  it('keeps shared files and never follows an upload URL outside storage', async () => {
    const sharedUrl = '/uploads/shared.png'
    writeFileSync(path.join(root, 'shared.png'), 'shared')
    const first = await client.asset.create({ data: { ownerId: 'owner', projectId: 'project', name: 'first', url: sharedUrl } })
    await client.asset.create({ data: { ownerId: 'owner', projectId: 'project', name: 'second', url: sharedUrl } })
    const outside = `${root}-outside.txt`
    writeFileSync(outside, 'outside')
    const escaped = await client.asset.create({ data: { ownerId: 'owner', projectId: 'project', name: 'escaped', url: `/uploads/../${path.basename(outside)}` } })

    await service.delete(first.id, 'owner')
    await service.delete(escaped.id, 'owner')

    expect(existsSync(path.join(root, 'shared.png'))).toBe(true)
    expect(existsSync(outside)).toBe(true)
    rmSync(outside, { force: true })
  })

  it('does not remove a file when the database delete fails', async () => {
    const failureRoot = path.join(root, 'failure')
    mkdirSync(failureRoot, { recursive: true })
    writeFileSync(path.join(failureRoot, 'asset.png'), 'keep')
    const failingClient = {
      $transaction: async (operation: (tx: unknown) => Promise<unknown>) => operation({
        asset: {
          findUnique: async () => ({ id: 'asset', ownerId: 'owner', projectId: 'project', url: '/uploads/asset.png', variants: [] }),
          delete: async () => { throw new Error('database unavailable') },
        },
        character: { count: async () => 0 },
        sprite: { count: async () => 0 },
        project: { count: async () => 0 },
        flowNode: { count: async () => 0 },
        storyBible: { count: async () => 0 },
      }),
    } as unknown as PrismaClient
    const failingService = new PrismaAssetService(failingClient, failureRoot)

    await expect(failingService.delete('asset', 'owner')).rejects.toThrow('database unavailable')
    expect(existsSync(path.join(failureRoot, 'asset.png'))).toBe(true)
  })
})
