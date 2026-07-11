import express, { type Express } from 'express'
import cors from 'cors'
import path from 'path'
import projectRoutes from './routes/projects.js'
import assetRoutes from './routes/assets.js'
import aiRoutes from './routes/ai.js'
import authRoutes from './routes/auth.js'
import { createStoryBibleRouter, prismaStoryBibleRepository, type StoryBibleRepository } from './routes/storyBible.js'
import { createChapterSaveRouter, prismaChapterSaveRepository, type ChapterSaveRepository } from './routes/chapterSave.js'
import { createHealthRouter, prismaHealthRepository, type HealthRepository } from './routes/health.js'
import { createAgentProjectRouter, createAgentRunRouter } from './routes/agent.js'
import { prismaAgentRunService, type AgentRunService } from './agent/runService.js'
import { prismaConversationService, type ConversationService } from './agent/conversationService.js'

export interface AppDependencies {
  storyBibleRepository?: StoryBibleRepository
  chapterSaveRepository?: ChapterSaveRepository
  healthRepository?: HealthRepository
  agentRunService?: AgentRunService
  conversationService?: ConversationService
}

export function createApp(dependencies: AppDependencies = {}): Express {
  const app = express()
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : ['http://localhost:5173', 'http://localhost:4173']

  app.use(cors({ origin: corsOrigins, credentials: true }))
  app.use(express.json({ limit: '10mb' }))
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')))

  app.use('/api/auth', authRoutes)
  app.use('/api/projects', createStoryBibleRouter(dependencies.storyBibleRepository ?? prismaStoryBibleRepository))
  app.use('/api/projects', createChapterSaveRouter(dependencies.chapterSaveRepository ?? prismaChapterSaveRepository))
  app.use('/api/projects', createHealthRouter(dependencies.healthRepository ?? prismaHealthRepository))
  app.use('/api/projects', createAgentProjectRouter(dependencies.agentRunService ?? prismaAgentRunService, dependencies.conversationService ?? prismaConversationService))
  app.use('/api/projects', projectRoutes)
  app.use('/api/agent', createAgentRunRouter(dependencies.agentRunService ?? prismaAgentRunService, dependencies.conversationService ?? prismaConversationService))
  app.use('/api/assets', assetRoutes)
  app.use('/api/ai', aiRoutes)

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'dreamchord-server' })
  })

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: '接口不存在' })
  })

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[未捕获错误]', error)
    const message = error instanceof Error ? error.message : '服务器内部错误'
    res.status(500).json({ error: message })
  })

  return app
}
