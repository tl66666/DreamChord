import { describe, expect, it } from 'vitest'
import { safeAuthReturnTo, templateRequestId, resumeTemplateRequest } from './templateEntry'
describe('creator login destination', () => {
  it('retains only the approved local template route', () => {
    expect(safeAuthReturnTo('?next=%2Fstart%2Fcurtain-call')).toBe('/start/curtain-call')
    expect(safeAuthReturnTo('?next=%2Fstart%2Fpaint-prologue')).toBe('/start/paint-prologue')
    for (const value of ['https://evil.invalid', '//evil.invalid', '/editor/private', '/\\evil.invalid']) expect(safeAuthReturnTo(`?next=${encodeURIComponent(value)}`)).toBe('/')
  })
  it('reuses one template request per user and story across visits, without crossing accounts', () => {
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
    let next = 0
    const uuid = () => `00000000-0000-4000-8000-${String(++next).padStart(12, '0')}`
    const first = templateRequestId(storage, 'paint', 'alice', uuid)
    expect(templateRequestId(storage, 'paint', 'alice', uuid)).toBe(first)
    expect(templateRequestId(storage, 'paint', 'bob', uuid)).not.toBe(first)
    expect(templateRequestId(storage, 'curtain', 'alice', uuid)).not.toBe(first)
  })
  it('rotates once only for a specifically deleted copy; ordinary failures retain the request', async () => {
    const calls: string[] = []
    const create = async (id: string) => { calls.push(id); if (id === 'deleted') throw { response: { status: 409, data: { code: 'TEMPLATE_COPY_DELETED' } } }; return id }
    expect(await resumeTemplateRequest('deleted', create, () => 'fresh')).toBe('fresh')
    expect(calls).toEqual(['deleted', 'fresh'])
    let rotations = 0
    await expect(resumeTemplateRequest('same', async () => { throw new Error('network') }, () => { rotations++; return 'new' })).rejects.toThrow('network')
    expect(rotations).toBe(0)
  })
})
