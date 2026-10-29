import request from 'supertest'
import jwt from 'jsonwebtoken'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const db = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn() }))
vi.mock('../lib/prisma.js', () => ({ prisma: { project: db } }))
import { createApp } from '../app.js'

describe('owned story settings', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'project-settings-test'
    db.findUnique.mockResolvedValue({ id: 'story', authorId: 'owner' })
    db.update.mockImplementation(async ({ data }) => ({ id: 'story', ...data }))
    db.update.mockClear()
  })
  const patch = (data: object, owner = 'owner') => request(createApp()).patch('/api/projects/story').set('Authorization', `Bearer ${jwt.sign({ userId: owner }, 'project-settings-test')}`).send(data)
  it('persists independent language defaults alongside an edited cover and title', async () => {
    const data = { title: ' 星夜来信 ', cover: '/assets/covers/first-thread.webp', defaultVoiceLocale: 'ja', defaultSubtitleLocale: 'zh' }
    const response = await patch(data)
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ ...data, title: '星夜来信' })
  })
  it.each([{ title: ' ' }, { defaultVoiceLocale: 'xx' }, { cover: 'javascript:alert(1)' }, { authorId: 'other' }])('rejects malformed or protected metadata: %j', async (data) => {
    expect((await patch(data)).status).toBe(400)
    expect(db.update).not.toHaveBeenCalled()
  })
  it('prevents another account from changing a story', async () => {
    expect((await patch({ defaultVoiceLocale: 'ja' }, 'other')).status).toBe(403)
    expect(db.update).not.toHaveBeenCalled()
  })
})
