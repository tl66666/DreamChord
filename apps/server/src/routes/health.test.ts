import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import type { HealthRepository } from './health.js'

const secret = 'health-route-test-secret-1234'
const repository: HealthRepository = {
  async findProjectGraph(projectId) {
    if (projectId === 'missing') return null
    return {
      ownerId: 'owner',
      graph: { nodes: [{ id: 'choice', type: 'choice', position: { x: 0, y: 0 }, data: { choices: ['A'] } }], edges: [] },
    }
  },
}

function token(userId: string): string { return jwt.sign({ userId }, secret) }

describe('project health route', () => {
  beforeEach(() => { process.env.JWT_SECRET = secret })

  it('returns deterministic issue codes to the owner', async () => {
    const response = await request(createApp({ healthRepository: repository }))
      .get('/api/projects/project/health')
      .set('Authorization', `Bearer ${token('owner')}`)
    expect(response.status).toBe(200)
    expect(response.body.issues.some((issue: { code: string }) => issue.code === 'choice-exit-missing')).toBe(true)
  })

  it('forbids other users', async () => {
    const response = await request(createApp({ healthRepository: repository }))
      .get('/api/projects/project/health')
      .set('Authorization', `Bearer ${token('other')}`)
    expect(response.status).toBe(403)
  })
})
