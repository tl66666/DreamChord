import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { createVoicePreparationRouter } from './voicePreparation.js'

process.env.JWT_SECRET = 'voice-preparation-test-secret'
const auth = `Bearer ${jwt.sign({ userId: 'owner' }, process.env.JWT_SECRET)}`
function setup(owned = true) {
  const findFirst = vi.fn(async () => owned ? { id: 'project' } : null)
  const manager = { status: vi.fn(() => undefined), start: vi.fn(() => ({ state: 'working' as const, language: 'ja' as const, ready: 0, pending: 1, unbound: 0, message: '准备中' })), pauseAndFlush: vi.fn(async () => undefined) }
  const app = express(); app.use(express.json()); app.use('/api/projects', createVoicePreparationRouter({ project: { findFirst } } as unknown as PrismaClient, manager))
  return { app, manager, findFirst }
}
describe('project voice preparation boundary', () => {
  it('requires authentication and ownership before starting or pausing work', async () => {
    const { app, manager, findFirst } = setup(false)
    expect((await request(app).post('/api/projects/project/voice-preparation').send({ language: 'ja' })).status).toBe(401)
    for (const method of ['post', 'get', 'delete'] as const) expect((await request(app)[method]('/api/projects/project/voice-preparation').set('Authorization', auth).send({ language: 'ja' })).status).toBe(404)
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'project', authorId: 'owner' }, select: { id: true } })
    expect(manager.start).not.toHaveBeenCalled(); expect(manager.pauseAndFlush).not.toHaveBeenCalled()
  })
  it('validates language and scopes preparation to the authenticated author', async () => {
    const { app, manager } = setup()
    expect((await request(app).post('/api/projects/project/voice-preparation').set('Authorization', auth).send({ language: 'ja', owner: 'other' })).status).toBe(400)
    expect((await request(app).post('/api/projects/project/voice-preparation').set('Authorization', auth).send({ language: 'ja' })).status).toBe(202)
    expect(manager.start).toHaveBeenCalledWith('owner', 'project', 'ja')
    expect((await request(app).delete('/api/projects/project/voice-preparation').set('Authorization', auth)).status).toBe(200)
    expect(manager.pauseAndFlush).toHaveBeenCalledWith('owner', 'project')
  })
})
