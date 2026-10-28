import dotenv from 'dotenv'
import { createApp } from './app.js'
import { prismaAgentRunService } from './agent/runService.js'
import { prismaLongImportService } from './imports/longImportService.js'
import { getManagedVoiceEngine } from './voice/managedVoiceEngine.js'

dotenv.config()

// ---------- 启动时环境变量校验 ----------
const REQUIRED_ENV = ['JWT_SECRET'] as const
for (const key of REQUIRED_ENV) {
  if (!process.env[key] || process.env[key]!.length < 16) {
    console.error(`[启动失败] 环境变量 ${key} 未设置或长度不足 16 字符`)
    process.exit(1)
  }
}

const PORT = Number(process.env.PORT) || 3001
await prismaAgentRunService.recoverInterruptedRuns()
await prismaLongImportService.recoverInterruptedRuns()
const managedVoiceEngine = getManagedVoiceEngine()
const configuredAutoStart = process.env.VOICE_PROVIDER === 'cosyvoice'
  ? process.env.COSYVOICE_AUTO_START
  : process.env.GPT_SOVITS_AUTO_START
if (configuredAutoStart !== 'false' && managedVoiceEngine.status().installed) {
  try {
    managedVoiceEngine.start()
    console.log('正在后台启动 DreamChord 内置声音引擎…')
  } catch (error) {
    console.error('内置声音引擎自动启动失败，可在声音库中重试。', error)
  }
}
const app = createApp()

const server = app.listen(PORT, () => {
  console.log(`梦弦后端服务已启动: http://localhost:${PORT}`)
})

// ---------- Graceful Shutdown ----------
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭服务...')
  managedVoiceEngine.stop()
  server.close(() => {
    console.log('服务已关闭')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('收到 SIGINT 信号，正在关闭服务...')
  managedVoiceEngine.stop()
  server.close(() => {
    console.log('服务已关闭')
    process.exit(0)
  })
})
