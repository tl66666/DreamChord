import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { cosyVoiceRuntimeConfig, renderCosyVoiceBridge } from './cosyvoice-runtime-config.mjs'

test('CosyVoice runtime stays isolated and loopback-only', () => {
  const config = cosyVoiceRuntimeConfig({ runtimeRoot: 'D:\\DreamChordRuntime' })
  assert.equal(config.home, path.win32.join('D:\\DreamChordRuntime', 'cosyvoice'))
  assert.equal(config.environment, path.win32.join('D:\\DreamChordRuntime', 'cosyvoice', '.conda'))
  assert.equal(config.host, '127.0.0.1')
  assert.equal(config.port, 50000)
  assert.equal(config.modelId, 'FunAudioLLM/Fun-CosyVoice3-0.5B-2512')
})

test('bridge launches the official AutoModel without exposing a public listener', () => {
  const source = renderCosyVoiceBridge({ modelDirectory: 'D:/DreamChordRuntime/cosyvoice/pretrained_models/Fun-CosyVoice3-0.5B' })
  assert.match(source, /AutoModel/)
  assert.match(source, /127\.0\.0\.1/)
  assert.match(source, /inference_instruct2/)
  assert.doesNotMatch(source, /0\.0\.0\.0/)
})
