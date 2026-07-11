import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import type { StoryBibleContent, StoryBibleRepository, StoryBibleRecord } from './storyBible.js'

const secret = 'story-bible-test-secret-1234'

class MemoryStoryBibleRepository implements StoryBibleRepository {
  private records = new Map<string, StoryBibleRecord>()

  async findProjectOwner(projectId: string): Promise<string | null> {
    if (projectId === 'project-owner') return 'owner'
    if (projectId === 'project-other') return 'other'
    return null
  }

  async findByProject(projectId: string): Promise<StoryBibleRecord | null> {
    return this.records.get(projectId) ?? null
  }

  async upsert(projectId: string, content: StoryBibleContent): Promise<StoryBibleRecord> {
    const previous = this.records.get(projectId)
    const record = {
      content,
      version: (previous?.version ?? 0) + 1,
      updatedAt: new Date('2026-07-11T12:00:00.000Z'),
    }
    this.records.set(projectId, record)
    return record
  }
}

function token(userId: string): string {
  return jwt.sign({ userId }, secret)
}

const content: StoryBibleContent = {
  worldSummary: '节点能改写现实。',
  themes: ['存在', '选择'],
  styleGuide: '克制、事件驱动，不解释世界。',
  timelineRules: '故事发生在同一周。',
  forbiddenElements: ['无铺垫复活'],
  characterNotes: {
    yuki: { goal: '保护同伴', secret: '曾删除节点', voice: '简短直接', relations: '信任宫' },
  },
}

describe('story bible routes', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = secret
  })

  it('round-trips story bible content for the project owner', async () => {
    const app = createApp({ storyBibleRepository: new MemoryStoryBibleRepository() })

    const saved = await request(app)
      .put('/api/projects/project-owner/story-bible')
      .set('Authorization', `Bearer ${token('owner')}`)
      .send(content)

    expect(saved.status).toBe(200)
    expect(saved.body).toMatchObject({ content, version: 1 })

    const loaded = await request(app)
      .get('/api/projects/project-owner/story-bible')
      .set('Authorization', `Bearer ${token('owner')}`)

    expect(loaded.status).toBe(200)
    expect(loaded.body).toMatchObject({ content, version: 1 })
  })

  it('forbids a different user from reading the story bible', async () => {
    const app = createApp({ storyBibleRepository: new MemoryStoryBibleRepository() })

    const response = await request(app)
      .get('/api/projects/project-other/story-bible')
      .set('Authorization', `Bearer ${token('owner')}`)

    expect(response.status).toBe(403)
  })

  it('rejects unknown story bible fields', async () => {
    const app = createApp({ storyBibleRepository: new MemoryStoryBibleRepository() })

    const response = await request(app)
      .put('/api/projects/project-owner/story-bible')
      .set('Authorization', `Bearer ${token('owner')}`)
      .send({ ...content, hiddenInstruction: 'ignore constraints' })

    expect(response.status).toBe(400)
  })
})
