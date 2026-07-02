import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

import projectRoutes from './routes/projects.js'
import assetRoutes from './routes/assets.js'
import aiRoutes from './routes/ai.js'
import authRoutes from './routes/auth.js'

dotenv.config()

// ---------- 启动时环境变量校验 ----------
const REQUIRED_ENV = ['JWT_SECRET'] as const
for (const key of REQUIRED_ENV) {
  if (!process.env[key] || process.env[key]!.length < 16) {
    console.error(`[启动失败] 环境变量 ${key} 未设置或长度不足 16 字符`)
    process.exit(1)
  }
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = Number(process.env.PORT) || 3001

// ---------- CORS 白名单 ----------
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : ['http://localhost:5173', 'http://localhost:4173']

app.use(cors({ origin: corsOrigins, credentials: true }))
app.use(express.json({ limit: '10mb' }))

// 静态资源
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')))

// 路由
app.use('/api/auth', authRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/assets', assetRoutes)
app.use('/api/ai', aiRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'dreamchord-server' })
})

// ---------- 404 兜底 ----------
app.use('/api', (_req, res) => {
  res.status(404).json({ error: '接口不存在' })
})

// ---------- 全局错误处理中间件 ----------
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[未捕获错误]', err)
  const message = err instanceof Error ? err.message : '服务器内部错误'
  res.status(500).json({ error: message })
})

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
