import { EventEmitter } from 'node:events'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { ManagedVoiceEngine } from './managedVoiceEngine.js'

describe('ManagedVoiceEngine', () => {
  it('waits for process exit before another GPU model may start', async () => {
    const child = Object.assign(new EventEmitter(), { pid: 1234, kill: vi.fn().mockReturnValue(true) })
    const engine = new ManagedVoiceEngine({ home: path.resolve('runtime'), python: 'python', port: 9880 }, { exists: () => true, spawnProcess: vi.fn().mockReturnValue(child) })
    engine.start()
    let stopped = false
    const waiting = engine.stopAndWait().then(() => { stopped = true })
    await Promise.resolve()
    expect(stopped).toBe(false)
    expect(child.kill).toHaveBeenCalledWith('SIGTERM')
    child.emit('exit', 0, null)
    await waiting
    expect(stopped).toBe(true)
  })
  it('reports an actionable uninstalled state without spawning anything', () => {
    const spawnProcess = vi.fn()
    const engine = new ManagedVoiceEngine({
      home: path.resolve('missing-runtime'), python: 'python', port: 9880,
    }, { exists: () => false, spawnProcess })

    expect(engine.status()).toEqual(expect.objectContaining({ installed: false, state: 'not-installed', canManage: false }))
    expect(() => engine.start()).toThrow(/尚未安装/)
    expect(spawnProcess).not.toHaveBeenCalled()
  })

  it('treats a partially installed runtime as unavailable', () => {
    const home = path.resolve('partial-runtime')
    const engine = new ManagedVoiceEngine({ home, python: path.join(home, '.conda', 'python.exe'), port: 9880 }, {
      exists: (filePath) => filePath.endsWith('api_v2.py'),
      spawnProcess: vi.fn(),
    })

    expect(engine.status()).toEqual(expect.objectContaining({ installed: false, state: 'not-installed' }))
  })

  it('starts the official API v2 hidden and bound to loopback only', () => {
    const child = Object.assign(new EventEmitter(), { pid: 1234, kill: vi.fn() })
    const spawnProcess = vi.fn().mockReturnValue(child)
    const home = path.resolve('runtime', 'gpt-sovits')
    const engine = new ManagedVoiceEngine({ home, python: 'runtime/python.exe', port: 9880 }, {
      exists: () => true, spawnProcess,
    })

    expect(engine.start()).toEqual(expect.objectContaining({ installed: true, state: 'starting', canManage: true }))
    expect(spawnProcess).toHaveBeenCalledWith('runtime/python.exe', [
      'api_v2.py', '-a', '127.0.0.1', '-p', '9880', '-c', 'GPT_SoVITS/configs/tts_infer.yaml',
    ], expect.objectContaining({ cwd: home, windowsHide: true, shell: false }))
  })

  it('starts the DreamChord CosyVoice bridge without a public listener argument', () => {
    const child = Object.assign(new EventEmitter(), { pid: 4321, kill: vi.fn() })
    const spawnProcess = vi.fn().mockReturnValue(child)
    const home = path.resolve('runtime', 'cosyvoice')
    const bridge = path.join(home, 'dreamchord_bridge.py')
    const modelDirectory = path.join(home, 'pretrained_models', 'Fun-CosyVoice3-0.5B')
    const engine = new ManagedVoiceEngine({
      provider: 'cosyvoice', home, python: path.join(home, '.conda', 'python.exe'),
      port: 50000, entrypoint: bridge, modelDirectory,
    }, { exists: () => true, spawnProcess })

    expect(engine.start()).toEqual(expect.objectContaining({ installed: true, state: 'starting' }))
    expect(spawnProcess).toHaveBeenCalledWith(path.join(home, '.conda', 'python.exe'), [
      bridge, '--port', '50000',
    ], expect.objectContaining({ cwd: home, windowsHide: true, shell: false }))
    expect(JSON.stringify(spawnProcess.mock.calls[0]?.[1])).not.toContain('0.0.0.0')
  })

  it('can stop only the child process it started', () => {
    const child = Object.assign(new EventEmitter(), { pid: 1234, kill: vi.fn().mockReturnValue(true) })
    const engine = new ManagedVoiceEngine({ home: path.resolve('runtime'), python: 'python', port: 9880 }, {
      exists: () => true, spawnProcess: vi.fn().mockReturnValue(child),
    })
    engine.start()

    expect(engine.stop()).toEqual(expect.objectContaining({ state: 'stopped' }))
    expect(child.kill).toHaveBeenCalledWith('SIGTERM')
  })
})
