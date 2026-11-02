import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTemplateRouter } from './templates.js'

describe('trusted paint template endpoint', () => {
  const createPaint = vi.fn()
  const app = express().use(express.json()).use('/api/projects/templates', createTemplateRouter(undefined, createPaint))
  beforeEach(() => { process.env.JWT_SECRET = 'paint-template-test'; createPaint.mockReset().mockResolvedValue({ id: 'copy', title: 'copy', focusNodeId: 'n', focusSceneId: 's' }) })
  const post = (body: object, auth = true) => {
    const req = request(app).post('/api/projects/templates/paint-prologue')
    if (auth) req.set('Authorization', `Bearer ${jwt.sign({ userId: 'owner' }, process.env.JWT_SECRET!)}`)
    return req.send(body)
  }
  it('requires authentication and accepts only a UUID requestId', async () => {
    expect((await post({ requestId: randomUUID() }, false)).status).toBe(401)
    for (const body of [{ requestId: 'arbitrary' }, { requestId: randomUUID(), ownerId: 'other' }, { requestId: randomUUID(), sourceProjectId: 'other' }]) expect((await post(body)).status).toBe(400)
    expect(createPaint).not.toHaveBeenCalled()
  })
  it('uses the authenticated owner and returns the editable focus entry', async () => {
    const requestId = randomUUID()
    const response = await post({ requestId })
    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({ focusNodeId: 'n', focusSceneId: 's' })
    expect(createPaint).toHaveBeenCalledWith('owner', requestId)
  })
})
