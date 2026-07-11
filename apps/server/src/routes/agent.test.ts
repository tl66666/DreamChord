import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import type { AgentRunDto, AgentRunService, CreateAgentRunInput } from '../agent/runService.js'

const secret = 'agent-route-test-secret-1234'

class MemoryAgentRunService implements AgentRunService {
  run: AgentRunDto = {
    id: 'run', status: 'queued', prompt: '检查第二章', scope: 'chapter', targetId: null,
    provider: 'custom', model: 'fake', plan: [], timeline: [], sources: [], validation: {},
    errorCode: null, errorMessage: null, patch: null, createdAt: '2026-07-11T00:00:00.000Z', updatedAt: '2026-07-11T00:00:00.000Z', completedAt: null,
  }
  async listConversations() { return [] }
  async createConversation() { return { id: 'conversation', title: '新任务', scope: 'chapter', createdAt: this.run.createdAt, updatedAt: this.run.updatedAt } }
  async createRun(_input: CreateAgentRunInput, _userId: string) { return this.run }
  async getRun() { return this.run }
  async cancelRun() { this.run = { ...this.run, status: 'cancelled' }; return this.run }
  async rejectRun() { this.run = { ...this.run, status: 'cancelled' }; return this.run }
  async retryRun() { this.run = { ...this.run, status: 'queued' }; return this.run }
  async applyRun() { return { chapterId: 'chapter', version: 2, graph: { nodes: [], edges: [] } } }
  async undoRun() { return { chapterId: 'chapter', version: 3, graph: { nodes: [], edges: [] } } }
}

function token(userId = 'owner'): string { return jwt.sign({ userId }, secret) }
const providerConfig = { provider: 'custom', model: 'fake', apiKey: 'top-secret-key', baseUrl: 'https://models.example.com/v1' }

describe('agent routes', () => {
  beforeEach(() => { process.env.JWT_SECRET = secret; process.env.NODE_ENV = 'test' })

  it('creates a conversation and queues a sanitized run', async () => {
    const app = createApp({ agentRunService: new MemoryAgentRunService() })
    const conversation = await request(app).post('/api/projects/project/agent/conversations').set('Authorization', `Bearer ${token()}`).send({ title: '新任务', scope: 'chapter' })
    expect(conversation.status).toBe(201)

    const response = await request(app).post('/api/projects/project/agent/runs').set('Authorization', `Bearer ${token()}`).send({
      conversationId: 'conversation', chapterId: 'chapter', prompt: '检查第二章', scope: 'chapter', providerConfig,
    })
    expect(response.status).toBe(202)
    expect(JSON.stringify(response.body)).not.toContain('top-secret-key')
  })

  it('polls, cancels, applies, and undoes a run', async () => {
    const app = createApp({ agentRunService: new MemoryAgentRunService() })
    expect((await request(app).get('/api/agent/runs/run').set('Authorization', `Bearer ${token()}`)).status).toBe(200)
    expect((await request(app).post('/api/agent/runs/run/cancel').set('Authorization', `Bearer ${token()}`)).body.status).toBe('cancelled')
    expect((await request(app).post('/api/agent/runs/run/apply').set('Authorization', `Bearer ${token()}`)).body.version).toBe(2)
    expect((await request(app).post('/api/agent/runs/run/undo').set('Authorization', `Bearer ${token()}`)).body.version).toBe(3)
  })

  it.each(['http://127.0.0.1:11434/v1', 'http://169.254.169.254/v1', 'http://10.1.2.3/v1'])(
    'rejects private provider URL %s in production', async (baseUrl) => {
      process.env.NODE_ENV = 'production'
      const response = await request(createApp({ agentRunService: new MemoryAgentRunService() }))
        .post('/api/projects/project/agent/runs').set('Authorization', `Bearer ${token()}`)
        .send({ conversationId: 'conversation', chapterId: 'chapter', prompt: '检查', scope: 'chapter', providerConfig: { ...providerConfig, baseUrl } })
      expect(response.status).toBe(400)
    },
  )
})
