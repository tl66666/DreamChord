import { describe, expect, it } from 'vitest'
import { getAgentToolPolicy, type AgentToolAccess } from './toolPolicy.js'

describe('agent tool policy', () => {
  it('classifies read-only tools as automatic reads', () => {
    expect(getAgentToolPolicy('read_project_brief')).toMatchObject<Partial<{ access: AgentToolAccess; decision: string }>>({
      access: 'read', decision: 'automatic',
    })
  })

  it('classifies asset preparation as an author-reviewed proposal', () => {
    expect(getAgentToolPolicy('prepare_character_asset')).toMatchObject({ access: 'prepare', decision: 'author_review' })
  })

  it('classifies story patch creation as an author-reviewed proposal', () => {
    expect(getAgentToolPolicy('create_story_patch')).toMatchObject({ access: 'propose', decision: 'author_review' })
  })
})
