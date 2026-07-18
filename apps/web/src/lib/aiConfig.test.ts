// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { getDefaultProvider, loadAIConfigs, saveAIConfigs, setActiveModel } from './aiConfig'

describe('AI configuration', () => {
  afterEach(() => localStorage.clear())

  it('persists an Agent model switch without asking for the API key again', () => {
    const configs = loadAIConfigs().map((config) => config.provider === 'glm' ? { ...config, enabled: true, apiKey: 'saved-key', model: 'glm-4.7-flash' } : config)
    saveAIConfigs(configs)

    setActiveModel('glm', 'glm-5.2')

    expect(getDefaultProvider()).toMatchObject({ provider: 'glm', model: 'glm-5.2', apiKey: 'saved-key' })
  })
})
