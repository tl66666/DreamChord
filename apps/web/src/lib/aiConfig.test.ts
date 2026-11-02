// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { getDefaultProvider, loadAIConfigs, saveAIConfigs, setActiveModel, validateAIConfigs } from './aiConfig'

describe('user supplied model configuration', () => {
  afterEach(() => localStorage.clear())
  it('persists a new model ID without asking for the API key again', () => {
    saveAIConfigs(loadAIConfigs().map((config) => config.provider === 'glm' ? { ...config, enabled: true, apiKey: 'saved-key', model: 'existing-id' } : config))
    setActiveModel('glm', 'my-new-deployment')
    expect(getDefaultProvider()).toMatchObject({ provider: 'glm', model: 'my-new-deployment', apiKey: 'saved-key' })
  })
  it('requires an explicit model ID rather than guessing a provider version', () => {
    expect(loadAIConfigs().every((config) => config.model === '')).toBe(true)
  })
  it('preserves arbitrary existing model IDs and rejects incomplete active configurations', () => {
    const configs = loadAIConfigs().map((config) => config.provider === 'custom'
      ? { ...config, enabled: true, apiKey: 'test-key', model: ' my-org/writer-2026 ', baseUrl: 'https://example.com/v1' } : config)
    saveAIConfigs(configs)
    expect(getDefaultProvider()?.model).toBe('my-org/writer-2026')
    const incomplete = configs.map((config) => ({ ...config, model: '' }))
    expect(validateAIConfigs(incomplete)).toMatch(/模型/)
    expect(() => saveAIConfigs(incomplete)).toThrow(/模型/)
    expect(getDefaultProvider()?.model).toBe('my-org/writer-2026')
  })
  it('requires an HTTP endpoint for a custom provider and does not activate old incomplete settings', () => {
    const configs = loadAIConfigs().map((config) => config.provider === 'custom'
      ? { ...config, enabled: true, apiKey: 'test-key', model: 'writer', baseUrl: 'javascript:alert(1)' } : config)
    expect(validateAIConfigs(configs)).toMatch(/URL/)
    localStorage.setItem('dreamchord_ai_configs_v2', JSON.stringify(configs))
    expect(getDefaultProvider()).toBeNull()
  })
})
