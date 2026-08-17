import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import type { LongImportDto, LongImportService } from '../imports/longImportService.js'

const secret = 'long-import-route-test-secret'
const dto: LongImportDto = {
  id: 'import-1', fileName: 'story.txt', status: 'queued', chunkSize: 12000, totalChunks: 2, completedChunks: 0, failedChunks: 0,
  progress: { total: 2, completed: 0, failed: 0, percent: 0 }, errorMessage: null, createdAt: '2026-08-17T00:00:00.000Z', updatedAt: '2026-08-17T00:00:00.000Z', completedAt: null,
  chunks: [{ id: 'chunk-1', index: 0, chapterTitle: '第一章', startOffset: 0, endOffset: 5, status: 'queued', attempts: 0, errorMessage: null }],
}

class MemoryLongImportService implements LongImportService {
  lastInput: unknown
  async create(input: unknown) { this.lastInput = input; return dto }
  async list() { return [dto] }
  async get() { return dto }
  async pause() { return { ...dto, status: 'paused' as const } }
  async resume() { return dto }
  async cancel() { return { ...dto, status: 'cancelled' as const } }
  async retry() { return dto }
  async result() { return { importId: dto.id, text: '第一章\n正文' } }
  async recoverInterruptedRuns() { return undefined }
}

function token() { return jwt.sign({ userId: 'owner' }, secret) }

describe('long import routes', () => {
  beforeEach(() => { process.env.JWT_SECRET = secret })

  it('creates, reports, pauses, resumes and returns a durable import result', async () => {
    const service = new MemoryLongImportService()
    const app = createApp({ longImportService: service })
    const auth = { Authorization: `Bearer ${token()}` }
    const created = await request(app).post('/api/projects/project/import-jobs').set(auth).send({ fileName: 'story.txt', text: '第一章\n正文' })
    expect(created.status).toBe(202)
    expect(service.lastInput).toMatchObject({ projectId: 'project', fileName: 'story.txt' })
    expect((await request(app).get('/api/projects/project/import-jobs').set(auth)).body).toHaveLength(1)
    expect((await request(app).post('/api/projects/project/import-jobs/import-1/pause').set(auth)).body.status).toBe('paused')
    expect((await request(app).post('/api/projects/project/import-jobs/import-1/resume').set(auth)).body.status).toBe('queued')
    const result = await request(app).get('/api/projects/project/import-jobs/import-1/result').set(auth)
    expect(result.body.text).toContain('第一章')
  })
})
