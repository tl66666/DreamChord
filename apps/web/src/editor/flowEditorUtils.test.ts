import { describe, expect, it } from 'vitest'
import { loadLibraryScenes } from '../lib/libraryData'
import { resolveBgUrl } from './storyFlowchart/bgUrl'
import * as flowEditorUtils from './flowEditorUtils'

describe('flow editor defaults', () => {
  it('uses a built-in background that resolves for every new scene', () => {
    const backgroundId = (flowEditorUtils as Record<string, unknown>).DEFAULT_SCENE_BACKGROUND_ID

    expect(backgroundId).toBe('bg-classroom')
    expect(resolveBgUrl(String(backgroundId), loadLibraryScenes())).toBe('/assets/backgrounds/bg-classroom.png')
  })
})
