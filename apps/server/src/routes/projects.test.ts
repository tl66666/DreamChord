import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { removeProjectUploadFiles } from './projects.js'

const roots: string[] = []

describe('project upload cleanup', () => {
  afterEach(() => { for (const item of roots.splice(0)) rmSync(item, { recursive: true, force: true }) })

  it('removes flat assets and the imported project directory without escaping the upload root', async () => {
    const root = path.join(tmpdir(), `dreamchord-project-cleanup-${randomUUID()}`)
    const projectId = randomUUID()
    const outside = `${root}-outside.txt`
    roots.push(root, outside)
    mkdirSync(path.join(root, projectId), { recursive: true })
    writeFileSync(path.join(root, 'flat.png'), 'flat')
    writeFileSync(path.join(root, projectId, 'embedded.png'), 'embedded')
    writeFileSync(outside, 'keep')

    await removeProjectUploadFiles(projectId, ['/uploads/flat.png', `/uploads/../${path.basename(outside)}`], root)

    expect(existsSync(path.join(root, 'flat.png'))).toBe(false)
    expect(existsSync(path.join(root, projectId))).toBe(false)
    expect(existsSync(outside)).toBe(true)
  })
})
