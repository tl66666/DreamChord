import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import type { AgentMemoryDto, CreateMemoryInput, MemoryService } from '../agent/memoryService.js'

const secret = 'memory-route-test-secret-1234'
const now = '2026-07-12T00:00:00.000Z'

class FakeMemoryService implements MemoryService {
  item: AgentMemoryDto = { id: 'memory', projectId: 'project', conversationId: null, kind: 'canon', title: '雪的秘密', content: '雪害怕被遗忘', tags: ['主线'], importance: 80, status: 'active', isPinned: false, sourceType: 'user', sourceId: null, supersededById: null, createdAt: now, updatedAt: now }
  async list() { return [this.item] }
  async create(_projectId: string, _userId: string, input: CreateMemoryInput) { this.item = { ...this.item, ...input }; return this.item }
  async update(_id: string, _userId: string, patch: Partial<CreateMemoryInput>) { this.item = { ...this.item, ...patch }; return this.item }
  async forget() { return undefined }
  async retrieve() { return [{ memory: { ...this.item, updatedAt: new Date(this.item.updatedAt) }, score: 120, reasons: ['固定记忆'] }] }
}

function token(): string { return jwt.sign({ userId: 'owner' }, secret) }

describe('memory routes', () => {
  beforeEach(() => { process.env.JWT_SECRET = secret; process.env.NODE_ENV = 'test' })

  it('lists, creates, updates, retrieves, and forgets memories', async () => {
    const app = createApp({ memoryService: new FakeMemoryService() })
    const auth = { Authorization: `Bearer ${token()}` }
    expect((await request(app).get('/api/projects/project/agent/memories?conversationId=conversation').set(auth)).status).toBe(200)
    expect((await request(app).post('/api/projects/project/agent/memories').set(auth).send({ kind: 'character', title: '雪', content: '主角', importance: 90 })).status).toBe(201)
    expect((await request(app).get('/api/projects/project/agent/memories/retrieve?q=雪').set(auth)).body[0].reasons).toContain('固定记忆')
    expect((await request(app).patch('/api/agent/memories/memory').set(auth).send({ isPinned: true })).body.isPinned).toBe(true)
    expect((await request(app).delete('/api/agent/memories/memory').set(auth)).status).toBe(204)
  })

  it('rejects invalid memory fields and unauthenticated access', async () => {
    const app = createApp({ memoryService: new FakeMemoryService() })
    expect((await request(app).get('/api/projects/project/agent/memories')).status).toBe(401)
    const invalid = await request(app).post('/api/projects/project/agent/memories').set('Authorization', `Bearer ${token()}`).send({ kind: 'unknown', title: '', content: '' })
    expect(invalid.status).toBe(400)
  })
})
