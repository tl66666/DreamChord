import { describe, expect, it } from 'vitest'
import { editorPaneClasses } from './responsiveLayout'

describe('responsive editor pane strategy', () => {
  it('prioritizes the editor on mobile and keeps three panes on desktop', () => {
    const classes = editorPaneClasses(false)
    expect(classes.tree).toContain('hidden')
    expect(classes.tree).toContain('lg:block')
    expect(classes.center).not.toContain('hidden lg:block')
    expect(classes.side).toContain('hidden')
    expect(classes.side).toContain('lg:block')
  })

  it('replaces the mobile editor with a full-width utility panel', () => {
    const classes = editorPaneClasses(true)
    expect(classes.center).toContain('hidden lg:block')
    expect(classes.side).toContain('w-full')
    expect(classes.side).toContain('lg:w-80')
  })
})
