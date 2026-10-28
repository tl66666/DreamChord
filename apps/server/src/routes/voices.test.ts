import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VoiceProvider } from '../voice/provider.js'
import type { ManagedVoiceEngine } from '../voice/managedVoiceEngine.js'
import { createVoiceRouter } from './voices.js'

const secret = 'voice-route-secret-1234'
const token = (userId: string) => jwt.sign({ userId }, secret)

function appFor(client: PrismaClient, provider: VoiceProvider | null = null, storageRoot?: string, engine?: ManagedVoiceEngine) {
  const app = express()
  app.use(express.json())
  app.use('/api/voices', createVoiceRouter(client, provider, { ...(storageRoot ? { storageRoot } : {}), ...(engine ? { engine } : {}) }))
  return app
}

describe('voice library routes', () => {
  beforeEach(() => { process.env.JWT_SECRET = secret })

  it('translates Chinese for an authenticated author without requiring a Japanese source field', async () => {
    const translate = vi.fn().mockResolvedValue({ text: '一緒に帰ろう。', sourceLanguage: 'zh', targetLanguage: 'ja', sourceHash: '12345678', source: 'local-cpu' })
    const app = express(); app.use(express.json())
    app.use('/api/voices', createVoiceRouter({} as PrismaClient, null, { translator: { translate } }))
    const response = await request(app).post('/api/voices/translate').set('Authorization', `Bearer ${token('owner')}`).send({ text: '一起回家吧。', targetLanguage: 'ja' })
    expect(response.status).toBe(200)
    expect(response.body.text).toBe('一緒に帰ろう。')
    expect(translate).toHaveBeenCalledWith({ text: '一起回家吧。', targetLanguage: 'ja' })
    expect((await request(app).post('/api/voices/translate').send({ text: '一起回家吧。', targetLanguage: 'ja' })).status).toBe(401)
  })

  it.each([{ bindings: 1, generationJobs: 0 }, { bindings: 0, generationJobs: 2 }])('protects referenced profiles from deletion: %j', async (counts) => {
    const remove = vi.fn()
    const tx = { voiceProfile: { findFirst: vi.fn().mockResolvedValue({ id: 'voice', _count: counts }), delete: remove } }
    const client = { $transaction: (operation: (value: unknown) => unknown) => operation(tx) } as unknown as PrismaClient
    const response = await request(appFor(client)).delete('/api/voices/profiles/voice').set('Authorization', `Bearer ${token('owner')}`)
    expect(response.status).toBe(409)
    expect(remove).not.toHaveBeenCalled()
  })

  it('deletes an unused owned profile and its associations without deleting audio assets', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'voice', _count: { bindings: 0, generationJobs: 0 } })
    const remove = vi.fn(), removeReferences = vi.fn(), removeAssets = vi.fn()
    const tx = { voiceProfile: { findFirst, delete: remove }, voiceReference: { deleteMany: removeReferences }, asset: { deleteMany: removeAssets } }
    const client = { $transaction: (operation: (value: unknown) => unknown) => operation(tx) } as unknown as PrismaClient
    const response = await request(appFor(client)).delete('/api/voices/profiles/voice').set('Authorization', `Bearer ${token('owner')}`)
    expect(response.status).toBe(204)
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'voice', ownerId: 'owner' } }))
    expect(removeReferences).toHaveBeenCalledWith({ where: { profileId: 'voice' } })
    expect(remove).toHaveBeenCalledWith({ where: { id: 'voice' } })
    expect(removeAssets).not.toHaveBeenCalled()
  })

  it('returns 404 without deleting a missing or unowned profile', async () => {
    const remove = vi.fn()
    const tx = { voiceProfile: { findFirst: vi.fn().mockResolvedValue(null), delete: remove } }
    const client = { $transaction: (operation: (value: unknown) => unknown) => operation(tx) } as unknown as PrismaClient
    const response = await request(appFor(client)).delete('/api/voices/profiles/other').set('Authorization', `Bearer ${token('owner')}`)
    expect(response.status).toBe(404)
    expect(remove).not.toHaveBeenCalled()
  })

  it('keeps reference clips that have generated dialogue history', async () => {
    const remove = vi.fn()
    const client = { voiceReference: { findFirst: vi.fn().mockResolvedValue({ id: 'reference', _count: { generationJobs: 1 } }), delete: remove } } as unknown as PrismaClient
    const response = await request(appFor(client)).delete('/api/voices/profiles/voice/references/reference').set('Authorization', `Bearer ${token('owner')}`)
    expect(response.status).toBe(409)
    expect(remove).not.toHaveBeenCalled()
  })

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
      capabilities: { voiceClone: true, instructionEmotion: false, emotionReference: true, speedControl: true },
      health: vi.fn().mockResolvedValue({ ok: true, provider: 'gpt-sovits', message: '服务可访问' }),
      synthesize: vi.fn(),
    }
    const response = await request(appFor({} as PrismaClient, provider)).get('/api/voices/provider/health')
      .set('Authorization', `Bearer ${token('owner')}`)
    expect(response.body).toEqual(expect.objectContaining({ ok: true, provider: 'gpt-sovits', message: '服务可访问' }))
    expect(JSON.stringify(response.body)).not.toContain('127.0.0.1')
  })

  it('starts and stops the embedded engine through authenticated controls', async () => {
    const start = vi.fn().mockReturnValue({ installed: true, canManage: true, state: 'starting', message: '正在加载' })
    const stop = vi.fn().mockReturnValue({ installed: true, canManage: true, state: 'stopped', message: '已停止' })
    const engine = { start, stop, status: vi.fn(), markRunning: vi.fn() } as unknown as ManagedVoiceEngine
    const app = appFor({} as PrismaClient, null, undefined, engine)

    const started = await request(app).post('/api/voices/provider/start').set('Authorization', `Bearer ${token('owner')}`)
    const stopped = await request(app).post('/api/voices/provider/stop').set('Authorization', `Bearer ${token('owner')}`)

    expect(started.status).toBe(202)
    expect(stopped.status).toBe(200)
    expect(start).toHaveBeenCalledOnce()
    expect(stop).toHaveBeenCalledOnce()
  })

  it('queues one authorized synthesis job and stores its preview outside the asset library', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'dreamchord-voice-'))
    const create = vi.fn().mockResolvedValue({ id: 'job', status: 'queued' })
    const update = vi.fn().mockImplementation(async ({ data }) => ({ id: 'job', ...data }))
    const provider: VoiceProvider = {
      id: 'gpt-sovits',
      capabilities: { voiceClone: true, instructionEmotion: false, emotionReference: true, speedControl: true },
      health: vi.fn(),
      synthesize: vi.fn().mockResolvedValue({ bytes: Buffer.from('RIFF-test'), mimeType: 'audio/wav', seed: 42 }),
    }
    const client = {
      project: { findFirst: vi.fn().mockResolvedValue({ id: 'project', authorId: 'owner' }) },
      character: { findFirst: vi.fn().mockResolvedValue({ id: 'character', name: '雪', projectId: 'project' }) },
      characterVoiceBinding: { findFirst: vi.fn().mockResolvedValue({ profileId: 'voice' }) },
      voiceReference: { findFirst: vi.fn().mockResolvedValue({
        id: 'reference', profileId: 'voice', transcript: '参考原文', language: 'zh', status: 'active',
        asset: { id: 'sample', ownerId: 'owner', url: '/uploads/library/owner/sample.wav' },
      }) },
      voiceGenerationJob: { create, update },
    } as unknown as PrismaClient

    try {
      const response = await request(appFor(client, provider, root)).post('/api/voices/generate')
        .set('Authorization', `Bearer ${token('owner')}`)
        .send({ projectId: 'project', characterId: 'character', referenceId: 'reference', text: '我……真的还能重新写吗？', language: 'zh', speed: 1.2, emotion: '愤怒', directionMode: 'auto' })

      expect(response.status).toBe(202)
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ownerId: 'owner', profileId: 'voice', status: 'queued' }) }))
      await vi.waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'job' }, data: expect.objectContaining({ status: 'completed', outputMimeType: 'audio/wav' }),
      })))
      const completed = update.mock.calls.find(([arg]) => arg.data.status === 'completed')?.[0].data
      expect(provider.synthesize).toHaveBeenCalledWith(expect.objectContaining({
        speed: 0.92, direction: expect.objectContaining({ emotion: 'afraid', source: 'auto' }),
      }))
      expect(JSON.parse(completed.providerMetadata)).toMatchObject({
        direction: { emotion: 'afraid' }, referenceId: 'reference', textHash: expect.any(String),
      })
      expect(completed.outputUrl).toMatch(/^\/uploads\/library\/owner\/voice-generated\/.+\.wav$/)
      expect(existsSync(path.join(root, completed.outputUrl.slice('/uploads/'.length)))).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects a chapter from another project before queuing synthesis', async () => {
    const create = vi.fn()
    const provider: VoiceProvider = {
      id: 'gpt-sovits',
      capabilities: { voiceClone: true, instructionEmotion: false, emotionReference: true, speedControl: true },
      health: vi.fn(), synthesize: vi.fn(),
    }
    const client = {
      project: { findFirst: vi.fn().mockResolvedValue({ id: 'project', authorId: 'owner' }) },
      character: { findFirst: vi.fn().mockResolvedValue({ id: 'character', projectId: 'project' }) },
      characterVoiceBinding: { findFirst: vi.fn().mockResolvedValue({ profileId: 'voice' }) },
      voiceReference: { findFirst: vi.fn().mockResolvedValue({
        id: 'reference', profileId: 'voice', transcript: '参考原文', language: 'zh',
        asset: { ownerId: 'owner', url: '/uploads/library/owner/sample.wav' },
      }) },
      chapter: { findFirst: vi.fn().mockResolvedValue(null) },
      voiceGenerationJob: { create },
    } as unknown as PrismaClient

    const response = await request(appFor(client, provider)).post('/api/voices/generate')
      .set('Authorization', `Bearer ${token('owner')}`)
      .send({ projectId: 'project', characterId: 'character', chapterId: 'foreign', referenceId: 'reference', text: '测试台词', language: 'zh' })

    expect(response.status).toBe(400)
    expect(response.body.error).toMatch(/章节/)
    expect(create).not.toHaveBeenCalled()
  })

  it('accepts a completed candidate into the ordinary VOICE asset library', async () => {
    const assetCreate = vi.fn().mockResolvedValue({ id: 'asset', type: 'VOICE', status: 'ready' })
    const jobUpdate = vi.fn().mockResolvedValue({ id: 'job', acceptedAssetId: 'asset' })
    const client = {
      voiceGenerationJob: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'job', ownerId: 'owner', status: 'completed', outputUrl: '/uploads/library/owner/voice-generated/job.wav',
          outputMimeType: 'audio/wav', text: '今晚也要继续写下去。', emotion: '自然', speed: 1,
          projectId: 'project', characterId: 'character', profileId: 'voice', acceptedAssetId: null,
          character: { name: '雪' }, profile: { name: '雪·轻声' },
        }),
        update: jobUpdate,
      },
      asset: { create: assetCreate },
    } as unknown as PrismaClient

    const response = await request(appFor(client)).post('/api/voices/jobs/job/accept')
      .set('Authorization', `Bearer ${token('owner')}`)
      .send({ name: '雪-序章对白' })

    expect(response.status).toBe(200)
    expect(assetCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      ownerId: 'owner', projectId: 'project', type: 'VOICE', url: '/uploads/library/owner/voice-generated/job.wav', name: '雪-序章对白',
    }) }))
    expect(jobUpdate).toHaveBeenCalledWith({ where: { id: 'job' }, data: { acceptedAssetId: 'asset' } })
  })
})
