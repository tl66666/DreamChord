import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import { ChapterVersionConflictError, type ChapterSaveInput, type ChapterSaveRepository } from './chapterSave.js'

const secret = 'chapter-save-test-secret-1234'

class MemoryChapterSaveRepository implements ChapterSaveRepository {
  version = 1
  saves = 0

  async save(input: ChapterSaveInput, userId: string): Promise<number> {
    if (userId !== 'owner') throw new Error('forbidden')
    if (input.baseVersion !== this.version) throw new ChapterVersionConflictError(this.version)
    this.version += 1
    this.saves += 1
    return this.version
  }
}

function token(): string {
  return jwt.sign({ userId: 'owner' }, secret)
}

const payload = {
  baseVersion: 1,
  nodes: [{ nodeId: 'start', type: 'subtitle', positionX: 0, positionY: 0, data: JSON.stringify({ text: '开始' }) }],
  edges: [],
}

describe('version-safe chapter save', () => {
  beforeEach(() => { process.env.JWT_SECRET = secret })

  it('rejects a stale second save without writing it', async () => {
    const repository = new MemoryChapterSaveRepository()
    const app = createApp({ chapterSaveRepository: repository })

    const first = await request(app)
      .put('/api/projects/project/chapters/chapter')
      .set('Authorization', `Bearer ${token()}`)
      .send(payload)
    const stale = await request(app)
      .put('/api/projects/project/chapters/chapter')
      .set('Authorization', `Bearer ${token()}`)
      .send(payload)

    expect(first.status).toBe(200)
    expect(first.body).toEqual({ success: true, version: 2 })
    expect(stale.status).toBe(409)
    expect(stale.body).toMatchObject({ error: '章节已被其他操作修改', currentVersion: 2 })
    expect(repository.saves).toBe(1)
  })

  it('rejects untyped node payloads', async () => {
    const app = createApp({ chapterSaveRepository: new MemoryChapterSaveRepository() })
    const response = await request(app)
      .put('/api/projects/project/chapters/chapter')
      .set('Authorization', `Bearer ${token()}`)
      .send({ ...payload, nodes: [{ nodeId: 'bad', data: {} }] })

    expect(response.status).toBe(400)
  })
})
