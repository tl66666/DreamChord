import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaAssetService } from './assetService.js'

const root = path.resolve('prisma', `asset-service-${process.pid}-${randomUUID()}`)
const databasePath = `${root}.db`
const databaseUrl = `file:${databasePath.replaceAll('\\', '/')}`
const prismaCli = path.resolve('node_modules/prisma/build/index.js')
const schemaPath = path.resolve('prisma/schema.prisma')
const migrations = ['20260629065808_init', '20260629104058_add_source_handle', '20260711000000_add_creative_agent', '20260712010000_expand_agent_conversations', '20260712020000_add_agent_memory', '20260712030000_add_asset_variants']
const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
const service = new PrismaAssetService(client, root)

describe('asset service', () => {
  beforeAll(async () => {
    rmSync(databasePath, { force: true }); rmSync(root, { recursive: true, force: true }); mkdirSync(root, { recursive: true })
    for (const migration of migrations) execFileSync(process.execPath, [prismaCli, 'db', 'execute', '--schema', schemaPath, '--file', path.resolve(`prisma/migrations/${migration}/migration.sql`)], { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' })
    await client.$connect()
    await client.user.create({ data: { id: 'owner', email: 'asset-owner@example.com', username: 'asset-owner', password: 'hash' } })
    await client.project.create({ data: { id: 'project', title: '故事', authorId: 'owner' } })
    const source = await sharp({ create: { width: 80, height: 120, channels: 3, background: 'white' } }).png().toBuffer()
    writeFileSync(path.join(root, 'source.png'), source)
    await client.asset.create({ data: { id: 'original', projectId: 'project', name: '人物原图', type: 'CG', url: '/uploads/source.png' } })
  })
  afterAll(async () => { await client.$disconnect(); rmSync(databasePath, { force: true }); rmSync(root, { recursive: true, force: true }) })

  it('processes a proposed sprite and accepts it as a character expression while preserving the original', async () => {
    const variant = await service.process('original', 'owner', { purpose: 'sprite', removeWhite: true, trim: true, whiteThreshold: 245, feather: 8 })
    expect(variant).toMatchObject({ kind: 'sprite', status: 'proposed', width: 1024, height: 1536 })
    const accepted = await service.accept(variant.id, 'owner', { purpose: 'sprite', characterName: '雪', expressionName: 'normal' })
    expect(accepted.character?.name).toBe('雪')
    expect(await client.sprite.findFirst({ where: { characterId: accepted.character?.id, name: 'normal' } })).toBeTruthy()
    expect((await client.asset.findUnique({ where: { id: 'original' } }))?.url).toBe('/uploads/source.png')
  })

  it('rejects a derivative without deleting its original', async () => {
    const variant = await service.process('original', 'owner', { purpose: 'cg', trim: false })
    await service.reject(variant.id, 'owner')
    expect((await client.assetVariant.findUnique({ where: { id: variant.id } }))?.status).toBe('rejected')
    expect(await client.asset.findUnique({ where: { id: 'original' } })).toBeTruthy()
  })
})
