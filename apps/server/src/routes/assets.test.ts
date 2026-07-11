import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import type { PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAssetRouter } from './assets.js'

const secret = 'asset-route-secret-1234'
const token = (userId: string) => jwt.sign({ userId }, secret)

function appFor(client: PrismaClient) {
  const app = express(); app.use(express.json()); app.use('/api/assets', createAssetRouter(client)); return app
}

describe('asset routes', () => {
  beforeEach(() => { process.env.JWT_SECRET = secret })

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
})
