import { randomUUID } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from './app.js'

const uploadRoot = path.join(tmpdir(), `dreamchord-static-${randomUUID()}`)

describe('upload static serving', () => {
  beforeAll(() => {
    mkdirSync(uploadRoot, { recursive: true })
    writeFileSync(path.join(uploadRoot, 'unsafe.html'), '<script>globalThis.pwned=true</script>')
    writeFileSync(path.join(uploadRoot, 'safe.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    process.env.UPLOAD_DIR = uploadRoot
  })
  afterAll(() => {
    delete process.env.UPLOAD_DIR
    rmSync(uploadRoot, { recursive: true, force: true })
  })

  it('does not expose executable file extensions from the upload directory', async () => {
    expect((await request(createApp()).get('/uploads/unsafe.html')).status).toBe(404)
  })

  it('serves allowlisted media with content sniffing disabled', async () => {
    const response = await request(createApp()).get('/uploads/safe.png')
    expect(response.status).toBe(200)
    expect(response.headers['x-content-type-options']).toBe('nosniff')
  })

  it('accepts portable backup request bodies above the general API limit', async () => {
    const response = await request(createApp())
      .post('/api/projects/import')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ padding: 'x'.repeat(11 * 1024 * 1024) }))

    expect(response.status).toBe(401)
  }, 20_000)

  it('allows anonymous readers to load a published project', async () => {
    const response = await request(createApp()).get('/api/projects/dreamchord-first-thread')
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ id: 'dreamchord-first-thread', isPublished: true })
  })
})
