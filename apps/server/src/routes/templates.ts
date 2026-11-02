import { Router, type Router as ExpressRouter, type Response } from 'express'
import { z } from 'zod'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { createCurtainTemplate } from '../project/curtainTemplate.js'
import { createPaintTemplate } from '../project/paintTemplate.js'

export function createTemplateRouter(create = createCurtainTemplate, createPaint = createPaintTemplate): ExpressRouter {
  const router = Router()
  router.use(authenticateToken)
  router.post('/curtain-call', async (req: AuthRequest, res: Response) => {
    const input = z.object({ requestId: z.string().uuid() }).strict().safeParse(req.body)
    if (!input.success) return res.status(400).json({ error: '创建请求无效，请返回演示结尾重试。' })
    try { return res.status(201).json(await create(req.userId!, input.data.requestId)) }
    catch (error) {
      console.error('[官方模板]', error)
      return res.status(503).json({ error: '暂时无法准备示例副本，请重试。已有作品不会受影响。' })
    }
  })
  router.post('/paint-prologue', async (req: AuthRequest, res: Response) => {
    const input = z.object({ requestId: z.string().uuid() }).strict().safeParse(req.body)
    if (!input.success) return res.status(400).json({ error: '创建请求无效，请返回序章结尾重试。' })
    try { return res.status(201).json(await createPaint(req.userId!, input.data.requestId)) }
    catch (error) {
      console.error('[序章模板]', error instanceof Error ? error.message : '模板准备失败')
      return res.status(503).json({ error: '序章素材暂未就绪，请稍后重试。已有作品不会受影响。' })
    }
  })
  return router
}
