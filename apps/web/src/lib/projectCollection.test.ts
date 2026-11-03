import { describe, expect, it } from 'vitest'
import { isOfficialStory } from './projectCollection'
describe('story shelf classification', () => {
  it('recognizes original IDs rather than repeated titles or publication state', () => {
    expect(isOfficialStory({ id: 'dreamchord-paint-prologue' })).toBe(true)
    expect(isOfficialStory({ id: 'dreamchord-curtain-call' })).toBe(true)
    expect(isOfficialStory({ id: 'paint-9770af1fe07ef3a281cde5ab2fedc2fc' })).toBe(false)
    expect(isOfficialStory({ id: 'my-own-published-story' })).toBe(false)
  })
})
