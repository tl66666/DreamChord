import dotenv from 'dotenv'
import { createApp } from './app.js'

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
const app = createApp()

const server = app.listen(PORT, () => {
  console.log(`梦弦后端服务已启动: http://localhost:${PORT}`)
})

// ---------- Graceful Shutdown ----------
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭服务...')
  server.close(() => {
    console.log('服务已关闭')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('收到 SIGINT 信号，正在关闭服务...')
  server.close(() => {
    console.log('服务已关闭')
    process.exit(0)
  })
})
