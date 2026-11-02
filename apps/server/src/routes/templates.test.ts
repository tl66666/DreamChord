import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTemplateRouter } from './templates.js'

describe('official template endpoint', () => {
  const create = vi.fn()
  const app = express().use(express.json()).use('/api/projects/templates', createTemplateRouter(create))
  beforeEach(() => { process.env.JWT_SECRET = 'template-test'; create.mockReset().mockResolvedValue({ id: 'copy', title: 'copy', focusNodeId: 'n', focusSceneId: 's' }) })
  const post = (body: object, auth = true) => {
    const req = request(app).post('/api/projects/templates/curtain-call')
    if (auth) req.set('Authorization', `Bearer ${jwt.sign({ userId: 'owner' }, process.env.JWT_SECRET!)}`)
    return req.send(body)
  }
  it('requires login and ignores no supplied ownership fields', async () => {
    expect((await post({ requestId: randomUUID() }, false)).status).toBe(401)
    expect((await post({ requestId: randomUUID(), ownerId: 'stranger' })).status).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })
  it('uses authenticated author and an idempotency request id', async () => {
    const requestId = randomUUID()
    expect((await post({ requestId })).status).toBe(201)
    expect(create).toHaveBeenCalledWith('owner', requestId)
  })
})
