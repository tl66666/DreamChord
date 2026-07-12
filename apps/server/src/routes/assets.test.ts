import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import type { PrismaClient } from '@prisma/client'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AssetInUseError } from '../assets/assetService.js'
import { createAssetRouter } from './assets.js'

const secret = 'asset-route-secret-1234'
const token = (userId: string) => jwt.sign({ userId }, secret)

const temporaryRoots: string[] = []

function temporaryRoot() {
  const root = path.join(tmpdir(), `dreamchord-asset-route-${randomUUID()}`)
  mkdirSync(root, { recursive: true })
  temporaryRoots.push(root)
  return root
}

function appFor(client: PrismaClient, storageRoot?: string) {
  const app = express(); app.use(express.json()); app.use('/api/assets', createAssetRouter(client, storageRoot)); return app
}

describe('asset routes', () => {
  beforeEach(() => { process.env.JWT_SECRET = secret })
  afterEach(() => { for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true }) })

  it('allows only the project owner to list private assets', async () => {
    const client = { project: { findUnique: vi.fn().mockResolvedValue({ id: 'project', authorId: 'owner' }) }, asset: { findMany: vi.fn().mockResolvedValue([{ id: 'asset', projectId: 'project', type: 'BACKGROUND' }]) } } as unknown as PrismaClient
    expect((await request(appFor(client)).get('/api/assets/project').set('Authorization', `Bearer ${token('owner')}`)).status).toBe(200)
    expect((await request(appFor(client)).get('/api/assets/project').set('Authorization', `Bearer ${token('other')}`)).status).toBe(403)
  })

  it('rejects unknown asset types and unexpected rename fields', async () => {
    const client = { project: { findUnique: vi.fn().mockResolvedValue({ id: 'project', authorId: 'owner' }) }, asset: { findUnique: vi.fn().mockResolvedValue({ id: 'asset', projectId: 'project', name: '旧名', type: 'CG' }), update: vi.fn() } } as unknown as PrismaClient
    const response = await request(appFor(client)).patch('/api/assets/asset').set('Authorization', `Bearer ${token('owner')}`).send({ name: '新名', projectId: 'other' })
    expect(response.status).toBe(400)
  })

  it('rejects executable markup disguised as an MP3 upload', async () => {
    const root = temporaryRoot()
    const client = {
      project: { findUnique: vi.fn().mockResolvedValue({ id: 'project', authorId: 'owner' }) },
      asset: { create: vi.fn() },
    } as unknown as PrismaClient

    const response = await request(appFor(client, root))
      .post('/api/assets/upload')
      .set('Authorization', `Bearer ${token('owner')}`)
      .field('projectId', 'project')
      .field('type', 'BGM')
      .attach('file', Buffer.from('<script>fetch("/api/projects")</script>'), { filename: 'steal.html', contentType: 'audio/mpeg' })

    expect(response.status).toBe(400)
    expect(client.asset.create).not.toHaveBeenCalled()
    expect(existsSync(root) && requireFileCount(root)).toBe(0)
  })

  it('returns a client error for a disallowed declared media type', async () => {
    const root = temporaryRoot()
    const client = { project: { findUnique: vi.fn() }, asset: { create: vi.fn() } } as unknown as PrismaClient

    const response = await request(appFor(client, root))
      .post('/api/assets/upload')
      .set('Authorization', `Bearer ${token('owner')}`)
      .field('projectId', 'project')
      .attach('file', Buffer.from('plain text'), { filename: 'notes.txt', contentType: 'text/plain' })

    expect(response.status).toBe(400)
    expect(response.body.error).toContain('仅支持')
  })

  it('stores validated audio under a server-owned safe extension', async () => {
    const root = temporaryRoot()
    const create = vi.fn().mockImplementation(async ({ data }) => ({ id: 'asset', ...data }))
    const client = {
      project: { findUnique: vi.fn().mockResolvedValue({ id: 'project', authorId: 'owner' }) },
      asset: { create },
    } as unknown as PrismaClient
    const mp3 = Buffer.alloc(417)
    mp3.set([0xff, 0xfb, 0x90, 0x64])

    const response = await request(appFor(client, root))
      .post('/api/assets/upload')
      .set('Authorization', `Bearer ${token('owner')}`)
      .field('projectId', 'project')
      .field('type', 'BGM')
      .attach('file', mp3, { filename: 'track.html', contentType: 'audio/mpeg' })

    expect(response.status).toBe(200)
    const storedUrl = create.mock.calls[0]?.[0].data.url as string
    expect(storedUrl).toMatch(/^\/uploads\/[0-9a-f-]+\.mp3$/)
    expect(existsSync(path.join(root, storedUrl.slice('/uploads/'.length)))).toBe(true)
  })

  it('keeps a replaced file when another database record still references its URL', async () => {
    const root = temporaryRoot()
    const oldUrl = '/uploads/shared-old.png'
    writeFileSync(path.join(root, 'shared-old.png'), 'shared')
    const tx = {
      asset: { count: vi.fn().mockResolvedValue(1) },
      assetVariant: { count: vi.fn().mockResolvedValue(0) },
      character: { count: vi.fn().mockResolvedValue(0) },
      sprite: { count: vi.fn().mockResolvedValue(0) },
      project: { count: vi.fn().mockResolvedValue(0) },
      flowNode: { count: vi.fn().mockResolvedValue(0) },
      storyBible: { count: vi.fn().mockResolvedValue(0) },
    }
    const client = {
      project: { findUnique: vi.fn().mockResolvedValue({ id: 'project', authorId: 'owner' }) },
      asset: {
        findUnique: vi.fn().mockResolvedValue({ id: 'asset', projectId: 'project', name: 'shared', type: 'CG', url: oldUrl, project: { authorId: 'owner' } }),
        update: vi.fn().mockImplementation(async ({ data }) => ({ id: 'asset', projectId: 'project', ...data })),
      },
      $transaction: vi.fn(async (operation) => operation(tx)),
    } as unknown as PrismaClient
    const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'black' } }).png().toBuffer()

    const response = await request(appFor(client, root))
      .put('/api/assets/asset/file')
      .set('Authorization', `Bearer ${token('owner')}`)
      .attach('file', image, { filename: 'replacement.png', contentType: 'image/png' })

    expect(response.status).toBe(200)
    expect(existsSync(path.join(root, 'shared-old.png'))).toBe(true)
  })

  it('never deletes a file outside the configured upload root', async () => {
    const root = temporaryRoot()
    const outside = path.join(path.dirname(root), `${path.basename(root)}-outside.txt`)
    writeFileSync(outside, 'keep')
    temporaryRoots.push(outside)
    const remove = vi.fn().mockResolvedValue({ id: 'asset' })
    const tx = {
      asset: {
        findUnique: vi.fn().mockResolvedValue({ id: 'asset', projectId: 'project', url: `/uploads/../${path.basename(outside)}`, variants: [], project: { authorId: 'owner' } }),
        delete: remove,
        count: vi.fn().mockResolvedValue(0),
      },
      assetVariant: { count: vi.fn().mockResolvedValue(0) },
      character: { count: vi.fn().mockResolvedValue(0) },
      sprite: { count: vi.fn().mockResolvedValue(0) },
      project: { count: vi.fn().mockResolvedValue(0) },
      flowNode: { count: vi.fn().mockResolvedValue(0) },
      storyBible: { count: vi.fn().mockResolvedValue(0) },
    }
    const client = { $transaction: vi.fn(async (operation) => operation(tx)) } as unknown as PrismaClient

    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const response = await request(appFor(client, root))
      .delete('/api/assets/asset')
      .set('Authorization', `Bearer ${token('owner')}`)
    log.mockRestore()

    expect(response.status).toBe(200)
    expect(existsSync(outside)).toBe(true)
    expect(remove).toHaveBeenCalledWith({ where: { id: 'asset' } })
  })

  it('returns 409 when a character still uses the asset URL', async () => {
    const client = { $transaction: vi.fn().mockRejectedValue(new AssetInUseError()) } as unknown as PrismaClient

    const response = await request(appFor(client))
      .delete('/api/assets/derived')
      .set('Authorization', `Bearer ${token('owner')}`)

    expect(response.status).toBe(409)
    expect(response.body.error).toContain('角色')
  })
})

function requireFileCount(root: string): number {
  return existsSync(root) ? readdirSync(root).length : 0
}
