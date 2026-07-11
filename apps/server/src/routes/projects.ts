import { Router, type Request, type Response, type Router as ExpressRouter } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'

const router: ExpressRouter = Router()

/** 将阿拉伯数字转为中文数字（支持 1-99） */
function toChineseNumber(n: number): string {
  const numerals = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  if (n <= 10) return numerals[n] || String(n)
  if (n < 20) return '十' + (n % 10 === 0 ? '' : numerals[n % 10])
  if (n < 100) {
    const tens = Math.floor(n / 10)
    const ones = n % 10
    return numerals[tens] + '十' + (ones === 0 ? '' : numerals[ones])
  }
  return String(n)
}

// 公开作品广场：不需要登录
router.get('/', async (_req, res) => {
  const projects = await prisma.project.findMany({
    where: { isPublic: true, isPublished: true },
    include: { author: { select: { username: true, nickname: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json(projects)
})

// 获取当前用户的项目列表
router.get('/me/list', authenticateToken, async (req: AuthRequest, res: Response) => {
  const projects = await prisma.project.findMany({
    where: { authorId: req.userId },
    orderBy: { createdAt: 'desc' },
    include: { chapters: { select: { id: true } } },
  })
  res.json(projects)
})

// 获取单个项目：公开项目可直接访问；私有项目需要作者本人
router.get('/:id', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  let userId: string | undefined
  if (authHeader) {
    try {
      const token = authHeader.split(' ')[1]
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
      userId = decoded.userId
    } catch {
      userId = undefined
    }
  }

  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      author: { select: { username: true, nickname: true } },
      chapters: { orderBy: { order: 'asc' }, include: { nodes: true, edges: true } },
      characters: true,
    },
  })

  if (!project) return res.status(404).json({ error: '项目不存在' })

  const isOwner = userId && project.authorId === userId
  if (!project.isPublished && !isOwner) {
    return res.status(403).json({ error: '该项目尚未发布' })
  }

  res.json(project)
})

// 以下路由需要登录
router.use(authenticateToken)

// 创建项目
router.post('/', async (req: AuthRequest, res: Response) => {
  const { title = '未命名项目', description = '' } = req.body
  const userId = req.userId!

  const project = await prisma.project.create({
    data: {
      title,
      description,
      authorId: userId,
      chapters: {
        create: {
          title: '第一章',
          order: 0,
          nodes: {
            create: {
              nodeId: 'node-1',
              type: 'dialogue',
              positionX: 250,
              positionY: 100,
              data: JSON.stringify({ role: '旁白', text: '故事从这里开始...' }),
            },
          },
        },
      },
    },
    include: { chapters: true },
  })

  res.status(201).json(project)
})

// 更新项目元数据 / 发布状态
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { title, description, cover, isPublic, isPublished } = req.body

  const project = await prisma.project.findUnique({ where: { id } })
  if (!project) return res.status(404).json({ error: '项目不存在' })
  if (project.authorId !== req.userId) return res.status(403).json({ error: '无权修改此项目' })

  const updated = await prisma.project.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(cover !== undefined && { cover }),
      ...(isPublic !== undefined && { isPublic }),
      ...(isPublished !== undefined && { isPublished }),
    },
    include: {
      author: { select: { username: true, nickname: true } },
      chapters: { orderBy: { order: 'asc' }, include: { nodes: true, edges: true } },
      characters: true,
    },
  })

  res.json(updated)
})

// 新建章节
router.post('/:id/chapters', async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { title } = req.body

  const project = await prisma.project.findUnique({
    where: { id },
    include: { chapters: { select: { order: true } } },
  })
  if (!project) return res.status(404).json({ error: '项目不存在' })
  if (project.authorId !== req.userId) return res.status(403).json({ error: '无权修改此项目' })

  const nextOrder = project.chapters.length > 0
    ? Math.max(...project.chapters.map((chapter) => chapter.order)) + 1
    : 0
  const chapterTitle = title || `第${toChineseNumber(nextOrder + 1)}章`
  const chapter = await prisma.chapter.create({
    data: {
      projectId: id,
      title: chapterTitle,
      order: nextOrder,
      nodes: {
        create: {
          nodeId: `chapter-${nextOrder + 1}-start`,
          type: 'subtitle',
          positionX: 250,
          positionY: 120,
          data: JSON.stringify({ text: `${chapterTitle}从这里开始。`, position: 'bottom', duration: 0, sceneCode: `${nextOrder + 1}-1` }),
        },
      },
    },
    include: { nodes: true, edges: true },
  })

  res.status(201).json(chapter)
})

// 重命名章节
router.patch('/:id/chapters/:chapterId', async (req: AuthRequest, res: Response) => {
  const { id, chapterId } = req.params
  const { title } = req.body

  const project = await prisma.project.findUnique({ where: { id } })
  if (!project) return res.status(404).json({ error: '项目不存在' })
  if (project.authorId !== req.userId) return res.status(403).json({ error: '无权修改此项目' })

  const chapter = await prisma.chapter.update({
    where: { id: chapterId },
    data: {
      ...(title !== undefined && { title }),
    },
    include: { nodes: true, edges: true },
  })

  res.json(chapter)
})

// 删除章节
router.delete('/:id/chapters/:chapterId', async (req: AuthRequest, res: Response) => {
  const { id, chapterId } = req.params

  const project = await prisma.project.findUnique({
    where: { id },
    include: { chapters: { select: { id: true } } },
  })
  if (!project) return res.status(404).json({ error: '项目不存在' })
  if (project.authorId !== req.userId) return res.status(403).json({ error: '无权修改此项目' })
  if (project.chapters.length <= 1) return res.status(400).json({ error: '至少保留一个章节，无法删除' })

  await prisma.chapter.delete({ where: { id: chapterId } })
  res.json({ success: true })
})

// 删除项目
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const project = await prisma.project.findUnique({ where: { id } })
  if (!project) return res.status(404).json({ error: '项目不存在' })
  if (project.authorId !== req.userId) return res.status(403).json({ error: '无权删除此项目' })

  await prisma.project.delete({ where: { id } })
  res.json({ success: true })
})

export default router
