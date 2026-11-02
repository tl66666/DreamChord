import { Router, type Response, type Router as ExpressRouter } from 'express'
import { z } from 'zod'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { projectVoicePreparation } from '../voice/prismaVoicePreparation.js'
import type { PrismaClient } from '@prisma/client'
import type { ProjectVoicePreparation } from '../voice/projectVoicePreparation.js'

export function createVoicePreparationRouter(client: PrismaClient = prisma, manager: Pick<ProjectVoicePreparation, 'status' | 'start' | 'pauseAndFlush'> = projectVoicePreparation): ExpressRouter {
  const router = Router()
  router.use(authenticateToken)
  router.all('/:projectId/voice-preparation', async (req: AuthRequest, res: Response) => {
    const projectId = req.params.projectId!, owner = req.userId!
    if (!await client.project.findFirst({ where: { id: projectId, authorId: owner }, select: { id: true } })) return res.status(404).json({ error: '故事不存在或无权编辑。' })
    if (req.method === 'GET') return res.json(manager.status(owner, projectId) || null)
    if (req.method === 'DELETE') return res.json(await manager.pauseAndFlush(owner, projectId) || null)
    if (req.method !== 'POST') return res.sendStatus(405)
    const parsed = z.object({ language: z.enum(['zh', 'ja']) }).strict().safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: '请选择中文或日语配音。' })
    const current = manager.status(owner, projectId)
    if (current?.state === 'working' && current.language !== parsed.data.language) await manager.pauseAndFlush(owner, projectId)
    return res.status(202).json(manager.start(owner, projectId, parsed.data.language))
  })
  return router
}
