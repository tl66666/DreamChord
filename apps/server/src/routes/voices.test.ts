import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import type { PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VoiceProvider } from '../voice/provider.js'
import { createVoiceRouter } from './voices.js'

const secret = 'voice-route-secret-1234'
const token = (userId: string) => jwt.sign({ userId }, secret)

function appFor(client: PrismaClient, provider: VoiceProvider | null = null) {
  const app = express()
  app.use(express.json())
  app.use('/api/voices', createVoiceRouter(client, provider))
  return app
}

describe('voice library routes', () => {
  beforeEach(() => { process.env.JWT_SECRET = secret })

  it('lists only the authenticated owner profiles', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'voice', ownerId: 'owner', name: '雪·轻声' }])
    const client = { voiceProfile: { findMany } } as unknown as PrismaClient

    const response = await request(appFor(client)).get('/api/voices/profiles').set('Authorization', `Bearer ${token('owner')}`)

    expect(response.status).toBe(200)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: 'owner' } }))
  })

  it('creates a private authorized voice profile and never accepts a client provider', async () => {
    const create = vi.fn().mockImplementation(async ({ data }) => ({ id: 'voice', ...data, references: [], bindings: [] }))
    const client = { voiceProfile: { create } } as unknown as PrismaClient

    const response = await request(appFor(client)).post('/api/voices/profiles')
      .set('Authorization', `Bearer ${token('owner')}`)
      .send({ name: '雪·轻声', language: 'zh', authorizationConfirmed: true, authorizationNote: '本人录制并授权', provider: 'remote-service' })

    expect(response.status).toBe(400)
    expect(create).not.toHaveBeenCalled()

    const accepted = await request(appFor(client)).post('/api/voices/profiles')
      .set('Authorization', `Bearer ${token('owner')}`)
      .send({ name: '雪·轻声', language: 'zh', authorizationConfirmed: true, authorizationNote: '本人录制并授权' })
    expect(accepted.status).toBe(201)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ownerId: 'owner', provider: 'gpt-sovits' }) }))
  })

  it('attaches only an owned VOICE_SAMPLE with exact transcript and consent', async () => {
    const create = vi.fn().mockImplementation(async ({ data }) => ({ id: 'reference', ...data }))
    const client = {
      voiceProfile: { findFirst: vi.fn().mockResolvedValue({ id: 'voice', ownerId: 'owner', status: 'active' }) },
      asset: { findFirst: vi.fn().mockResolvedValue({ id: 'sample', ownerId: 'owner', type: 'VOICE_SAMPLE' }) },
      voiceReference: { create },
    } as unknown as PrismaClient

    const response = await request(appFor(client)).post('/api/voices/profiles/voice/references')
      .set('Authorization', `Bearer ${token('owner')}`)
      .send({ assetId: 'sample', transcript: '请听清这句话。', language: 'zh', authorizationConfirmed: true })

    expect(response.status).toBe(201)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ profileId: 'voice', assetId: 'sample', authorizationConfirmed: true }) }))
  })

  it('binds an owned active profile only to a character in the owned project', async () => {
    const upsert = vi.fn().mockImplementation(async ({ create }) => ({ id: 'binding', ...create }))
    const client = {
      voiceProfile: { findFirst: vi.fn().mockResolvedValue({ id: 'voice', ownerId: 'owner', status: 'active' }) },
      project: { findFirst: vi.fn().mockResolvedValue({ id: 'project', authorId: 'owner' }) },
      character: { findFirst: vi.fn().mockResolvedValue({ id: 'character', projectId: 'project' }) },
      characterVoiceBinding: { upsert },
    } as unknown as PrismaClient

    const response = await request(appFor(client)).post('/api/voices/profiles/voice/bindings')
      .set('Authorization', `Bearer ${token('owner')}`)
      .send({ projectId: 'project', characterId: 'character' })

    expect(response.status).toBe(200)
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { characterId: 'character' } }))
  })

  it('reports provider availability without exposing the configured URL', async () => {
    const provider: VoiceProvider = {
      id: 'gpt-sovits',
      health: vi.fn().mockResolvedValue({ ok: true, provider: 'gpt-sovits', message: '服务可访问' }),
      synthesize: vi.fn(),
    }
    const response = await request(appFor({} as PrismaClient, provider)).get('/api/voices/provider/health')
      .set('Authorization', `Bearer ${token('owner')}`)
    expect(response.body).toEqual({ ok: true, provider: 'gpt-sovits', message: '服务可访问' })
    expect(JSON.stringify(response.body)).not.toContain('127.0.0.1')
  })
})
