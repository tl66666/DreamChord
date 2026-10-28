import { existsSync } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export type ManagedVoiceEngineState = 'not-installed' | 'stopped' | 'starting' | 'running' | 'failed'

export interface ManagedVoiceEngineStatus {
  installed: boolean
  canManage: boolean
  state: ManagedVoiceEngineState
  message: string
}

interface ManagedChild {
  pid?: number
  kill(signal?: NodeJS.Signals): boolean
  on(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): unknown
  on(event: 'error', listener: (error: Error) => void): unknown
}

interface EngineDependencies {
  exists: (filePath: string) => boolean
  spawnProcess: (command: string, args: string[], options: {
    cwd: string
    windowsHide: boolean
    shell: false
    stdio: 'ignore'
    env: NodeJS.ProcessEnv
  }) => ManagedChild
}

export interface ManagedVoiceEngineConfig {
  provider?: 'gpt-sovits' | 'cosyvoice'
  home: string
  python: string
  port: number
  entrypoint?: string
  modelDirectory?: string
}

export function readManagedVoiceEngineConfig(
  env: Record<string, string | undefined> = process.env,
  workingDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..'),
): ManagedVoiceEngineConfig {
  if (env.VOICE_PROVIDER?.trim() === 'cosyvoice') {
    const home = path.resolve(env.COSYVOICE_HOME || path.join(workingDirectory, '.runtime', 'cosyvoice'))
    const python = env.COSYVOICE_PYTHON || (process.platform === 'win32'
      ? path.join(home, '.conda', 'python.exe')
      : path.join(home, '.conda', 'bin', 'python'))
    const parsedPort = Number(env.COSYVOICE_PORT || 50_000)
    return {
      provider: 'cosyvoice',
      home,
      python,
      port: Number.isInteger(parsedPort) && parsedPort >= 1024 && parsedPort <= 65535 ? parsedPort : 50_000,
      entrypoint: path.resolve(env.COSYVOICE_BRIDGE || path.join(home, 'dreamchord_bridge.py')),
      modelDirectory: path.resolve(env.COSYVOICE_MODEL_HOME || path.join(home, 'pretrained_models', 'Fun-CosyVoice3-0.5B')),
    }
  }
  const home = path.resolve(env.GPT_SOVITS_HOME || path.join(workingDirectory, '.runtime', 'gpt-sovits'))
  const embeddedPython = process.platform === 'win32'
    ? path.join(home, 'runtime', 'python.exe')
    : path.join(home, 'runtime', 'python')
  const condaPython = process.platform === 'win32'
    ? path.join(home, '.conda', 'python.exe')
    : path.join(home, '.conda', 'bin', 'python')
  const parsedPort = Number(env.GPT_SOVITS_PORT || 9880)
  return {
    provider: 'gpt-sovits',
    home,
    python: env.GPT_SOVITS_PYTHON || (existsSync(embeddedPython) ? embeddedPython : existsSync(condaPython) ? condaPython : 'python'),
    port: Number.isInteger(parsedPort) && parsedPort >= 1024 && parsedPort <= 65535 ? parsedPort : 9880,
  }
}

/** Owns the optional local GPT-SoVITS child process; it never launches a shell or public listener. */
export class ManagedVoiceEngine {
  private child: ManagedChild | null = null
  private state: ManagedVoiceEngineState = 'stopped'
  private lastError = ''

  constructor(
    private readonly config: ManagedVoiceEngineConfig = readManagedVoiceEngineConfig(),
    private readonly dependencies: EngineDependencies = {
      exists: existsSync,
      spawnProcess: (command, args, options) => spawn(command, args, options),
    },
  ) {}

  private installed(): boolean {
    if (this.config.provider === 'cosyvoice') {
      const pythonReady = !path.isAbsolute(this.config.python) || this.dependencies.exists(this.config.python)
      return Boolean(
        this.config.entrypoint && this.dependencies.exists(this.config.entrypoint)
        && this.config.modelDirectory && this.dependencies.exists(this.config.modelDirectory)
        && ['cosyvoice3.yaml', 'llm.pt', 'flow.pt', 'hift.pt'].every((file) => this.dependencies.exists(path.join(this.config.modelDirectory!, file)))
        && pythonReady,
      )
    }
    const api = path.join(this.config.home, 'api_v2.py')
    const inferenceConfig = path.join(this.config.home, 'GPT_SoVITS', 'configs', 'tts_infer.yaml')
    const pythonReady = !path.isAbsolute(this.config.python) || this.dependencies.exists(this.config.python)
    return this.dependencies.exists(api) && this.dependencies.exists(inferenceConfig) && pythonReady
  }

  status(): ManagedVoiceEngineStatus {
    if (!this.installed()) return {
      installed: false, canManage: false, state: 'not-installed',
      message: '内置声音引擎尚未安装，请先运行项目提供的安装向导。',
    }
    const engineName = this.config.provider === 'cosyvoice' ? 'CosyVoice' : 'GPT-SoVITS'
    const messages: Record<Exclude<ManagedVoiceEngineState, 'not-installed'>, string> = {
      stopped: '声音引擎已安装，当前未启动。',
      starting: `正在加载 ${engineName} 模型，首次启动可能需要较长时间。`,
      running: `内置 ${engineName} 已可用。`,
      failed: this.lastError || '声音引擎启动失败，请查看服务端日志。',
    }
    return { installed: true, canManage: true, state: this.state, message: messages[this.state === 'not-installed' ? 'stopped' : this.state] }
  }

  start(): ManagedVoiceEngineStatus {
    if (!this.installed()) throw new Error('内置声音引擎尚未安装')
    if (this.child) return this.status()
    this.state = 'starting'
    this.lastError = ''
    const args = this.config.provider === 'cosyvoice'
      ? [this.config.entrypoint!, '--port', String(this.config.port)]
      : ['api_v2.py', '-a', '127.0.0.1', '-p', String(this.config.port), '-c', 'GPT_SoVITS/configs/tts_infer.yaml']
    const child = this.dependencies.spawnProcess(this.config.python, args, {
      cwd: this.config.home,
      windowsHide: true,
      shell: false,
      stdio: 'ignore',
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    })
    this.child = child
    child.on('error', (error) => {
      this.lastError = `声音引擎启动失败：${error.message}`
      this.state = 'failed'
      this.child = null
    })
    child.on('exit', (code) => {
      if (this.child !== child) return
      this.child = null
      if (this.state !== 'stopped') {
        this.state = code === 0 ? 'stopped' : 'failed'
        if (code !== 0) this.lastError = `声音引擎异常退出（代码 ${code ?? 'unknown'}）`
      }
    })
    return this.status()
  }

  markRunning(): void {
    if (this.installed()) this.state = 'running'
  }

  stop(): ManagedVoiceEngineStatus {
    const child = this.child
    this.child = null
    this.state = 'stopped'
    if (child) child.kill('SIGTERM')
    return this.status()
  }

  async stopAndWait(): Promise<void> {
    const child = this.child
    if (!child) { this.stop(); return }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('声音进程尚未退出，已取消加载另一套模型。')), 10000)
      child.on('exit', () => { clearTimeout(timer); resolve() })
      this.stop()
    })
  }
}

/** Only one GPU model is resident; changing dialogue language switches the managed child. */
export class LanguageManagedVoiceEngine extends ManagedVoiceEngine {
  private active: 'cosyvoice' | 'gpt-sovits' = 'cosyvoice'
  readonly japanese: ManagedVoiceEngine
  constructor(primary: ManagedVoiceEngineConfig, japanese: ManagedVoiceEngineConfig) {
    super(primary)
    this.japanese = new ManagedVoiceEngine(japanese)
  }
  get activeProviderId() { return this.active }
  async selectLanguage(language: string) {
    const next = /^(ja|jp)(-|$)/i.test(language) ? 'gpt-sovits' : 'cosyvoice'
    if (next === 'gpt-sovits' && !this.japanese.status().installed) throw new Error('日文配音需要本机 GPT-SoVITS，请先完成声音引擎安装。')
    if (next !== this.active) {
      if (this.active === 'gpt-sovits') await this.japanese.stopAndWait()
      else await super.stopAndWait()
      this.active = next
    }
    const status = this.status()
    if (status.state === 'stopped' || status.state === 'failed') this.start()
  }
  override status(): ManagedVoiceEngineStatus {
    const status = this.active === 'gpt-sovits' ? this.japanese.status() : super.status()
    return { ...status, message: `${status.message} ${this.active === 'gpt-sovits' ? '当前使用日文参考配音；切换到中文时会自动加载情感引擎。' : '日文生成会自动切换参考配音引擎，首次切换需加载模型。'}` }
  }
  override start() { return this.active === 'gpt-sovits' ? this.japanese.start() : super.start() }
  override markRunning() { if (this.active === 'gpt-sovits') this.japanese.markRunning(); else super.markRunning() }
  override stop() {
    this.japanese.stop()
    super.stop()
    return this.status()
  }
}

let sharedEngine: ManagedVoiceEngine | null = null

/** Created lazily so dotenv has loaded before environment-based paths are read. */
export function getManagedVoiceEngine(): ManagedVoiceEngine {
  if (!sharedEngine) {
    const config = readManagedVoiceEngineConfig()
    sharedEngine = config.provider === 'cosyvoice' && process.env.COSYVOICE_JAPANESE_FALLBACK !== 'false'
      ? new LanguageManagedVoiceEngine(config, readManagedVoiceEngineConfig({ ...process.env, VOICE_PROVIDER: 'gpt-sovits' }))
      : new ManagedVoiceEngine(config)
  }
  return sharedEngine
}
