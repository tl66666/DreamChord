import jwt from 'jsonwebtoken'
import request from 'supertest'
import { lookup } from 'node:dns/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app.js'
import type { AgentRunDto, AgentRunService, CreateAgentRunInput } from '../agent/runService.js'
import type { ConversationDto, ConversationService } from '../agent/conversationService.js'

const secret = 'agent-route-test-secret-1234'

vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }))
const lookupMock = vi.mocked(lookup)

class MemoryAgentRunService implements AgentRunService {
  lastInput: CreateAgentRunInput | null = null
  run: AgentRunDto = {
    id: 'run', status: 'queued', prompt: '检查第二章', scope: 'chapter', targetId: null,
    provider: 'custom', model: 'fake', plan: [], timeline: [], sources: [], validation: {},
    errorCode: null, errorMessage: null, patch: null, createdAt: '2026-07-11T00:00:00.000Z', updatedAt: '2026-07-11T00:00:00.000Z', completedAt: null,
  }
  async listConversations() { return [] }
  async createConversation() { return { id: 'conversation', title: '新任务', scope: 'chapter', createdAt: this.run.createdAt, updatedAt: this.run.updatedAt } }
  async createRun(input: CreateAgentRunInput, _userId: string) { this.lastInput = input; return this.run }
  async getRun() { return this.run }
  async cancelRun() { this.run = { ...this.run, status: 'cancelled' }; return this.run }
  async rejectRun() { this.run = { ...this.run, status: 'cancelled' }; return this.run }
  async retryRun() { this.run = { ...this.run, status: 'queued' }; return this.run }
  async applyRun() { return { chapterId: 'chapter', version: 2, graph: { nodes: [], edges: [] } } }
  async undoRun() { return { chapterId: 'chapter', version: 3, graph: { nodes: [], edges: [] } } }
}

class MemoryConversationService implements ConversationService {
  conversation: ConversationDto = {
    id: 'conversation', title: '新任务', scope: 'chapter', chapterId: 'chapter', isPinned: false, summary: '',
    createdAt: '2026-07-11T00:00:00.000Z', updatedAt: '2026-07-11T00:00:00.000Z',
  }
  async list() { return [this.conversation] }
  async create() { return this.conversation }
  async get() { return this.conversation }
  async update(_id: string, _userId: string, patch: Partial<ConversationDto>) { this.conversation = { ...this.conversation, ...patch }; return this.conversation }
  async remove() { return undefined }
  async messages() { return { items: [{ id: 'message', role: 'user', content: '继续写', metadata: {}, createdAt: this.conversation.createdAt }], nextCursor: null } }
}

function testApp() {
  return createApp({ agentRunService: new MemoryAgentRunService(), conversationService: new MemoryConversationService() })
}

function token(userId = 'owner'): string { return jwt.sign({ userId }, secret) }
const providerConfig = { provider: 'custom', model: 'fake', apiKey: 'top-secret-key', baseUrl: 'https://models.example.com/v1' }

describe('agent routes', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = secret
    process.env.NODE_ENV = 'test'
    lookupMock.mockReset()
    lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never)
  })

  it('creates a conversation and queues a sanitized run', async () => {
    const app = testApp()
    const conversation = await request(app).post('/api/projects/project/agent/conversations').set('Authorization', `Bearer ${token()}`).send({ title: '新任务', scope: 'chapter' })
    expect(conversation.status).toBe(201)

    const response = await request(app).post('/api/projects/project/agent/runs').set('Authorization', `Bearer ${token()}`).send({
      conversationId: 'conversation', chapterId: 'chapter', prompt: '检查第二章', scope: 'chapter', providerConfig,
    })
    expect(response.status).toBe(202)
    expect(JSON.stringify(response.body)).not.toContain('top-secret-key')
  })

  it('allows a project run without a chapter and requires one for story scopes', async () => {
    const app = testApp()
    const auth = { Authorization: `Bearer ${token()}` }
    const projectRun = await request(app).post('/api/projects/project/agent/runs').set(auth).send({
      conversationId: 'conversation', prompt: '聊聊整个项目', scope: 'project', providerConfig,
    })
    const chapterRun = await request(app).post('/api/projects/project/agent/runs').set(auth).send({
      conversationId: 'conversation', prompt: '修改当前章节', scope: 'chapter', providerConfig,
    })

    expect(projectRun.status).toBe(202)
    expect(chapterRun.status).toBe(400)
    expect(chapterRun.body.error).toContain('章节')
  })

  it('polls, cancels, applies, and undoes a run', async () => {
    const app = testApp()
    expect((await request(app).get('/api/agent/runs/run').set('Authorization', `Bearer ${token()}`)).status).toBe(200)
    expect((await request(app).post('/api/agent/runs/run/cancel').set('Authorization', `Bearer ${token()}`)).body.status).toBe('cancelled')
    expect((await request(app).post('/api/agent/runs/run/apply').set('Authorization', `Bearer ${token()}`)).body.version).toBe(2)
    expect((await request(app).post('/api/agent/runs/run/undo').set('Authorization', `Bearer ${token()}`)).body.version).toBe(3)
  })

  it('reads, updates, paginates, and deletes a conversation', async () => {
    const app = testApp()
    const auth = { Authorization: `Bearer ${token()}` }

    const detail = await request(app).get('/api/agent/conversations/conversation').set(auth)
    expect(detail.status).toBe(200)
    expect(detail.body.title).toBe('新任务')

    const messages = await request(app).get('/api/agent/conversations/conversation/messages?limit=20').set(auth)
    expect(messages.status).toBe(200)
    expect(messages.body.items).toEqual(expect.any(Array))

    const updated = await request(app).patch('/api/agent/conversations/conversation').set(auth).send({ title: '第二章续写', isPinned: true })
    expect(updated.status).toBe(200)
    expect(updated.body).toMatchObject({ title: '第二章续写', isPinned: true })

    const removed = await request(app).delete('/api/agent/conversations/conversation').set(auth)
    expect(removed.status).toBe(204)
  })

  it.each([
    'ftp://models.example.com/v1',
    'http://0.0.0.0/v1',
    'http://127.0.0.1:11434/v1',
    'http://169.254.169.254/v1',
    'http://10.1.2.3/v1',
    'http://172.16.0.1/v1',
    'http://192.168.1.1/v1',
    'http://224.0.0.1/v1',
    'http://[::]/v1',
    'http://[::1]/v1',
    'http://[fc00::1]/v1',
    'http://[fe80::1]/v1',
    'http://[ff02::1]/v1',
    'http://[::ffff:127.0.0.1]/v1',
  ])(
    'rejects unsafe provider URL %s in every environment', async (baseUrl) => {
      const response = await request(testApp())
        .post('/api/projects/project/agent/runs').set('Authorization', `Bearer ${token()}`)
        .send({ conversationId: 'conversation', chapterId: 'chapter', prompt: '检查', scope: 'chapter', providerConfig: { ...providerConfig, baseUrl } })
      expect(response.status).toBe(400)
    },
  )

  it('rejects a provider hostname when DNS resolves to a private address', async () => {
    lookupMock.mockResolvedValueOnce([{ address: '10.20.30.40', family: 4 }] as never)
    const response = await request(testApp())
      .post('/api/projects/project/agent/runs').set('Authorization', `Bearer ${token()}`)
      .send({ conversationId: 'conversation', chapterId: 'chapter', prompt: '检查', scope: 'chapter', providerConfig: { ...providerConfig, baseUrl: 'https://private.example/v1' } })

    expect(response.status).toBe(400)
  })

  it('keeps a provider hostname when every DNS result is public', async () => {
    lookupMock.mockResolvedValueOnce([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
    ] as never)
    const response = await request(testApp())
      .post('/api/projects/project/agent/runs').set('Authorization', `Bearer ${token()}`)
      .send({ conversationId: 'conversation', chapterId: 'chapter', prompt: '检查', scope: 'chapter', providerConfig })

    expect(response.status).toBe(202)
  })
})
