import { Router, type Response, type Router as ExpressRouter } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { parseBody } from '../validation/http.js'

const characterNoteSchema = z.object({
  goal: z.string().max(2_000),
  secret: z.string().max(2_000),
  voice: z.string().max(2_000),
  relations: z.string().max(2_000),
}).strict()

export const storyBibleContentSchema = z.object({
  worldSummary: z.string().max(20_000),
  themes: z.array(z.string().max(200)).max(30),
  styleGuide: z.string().max(10_000),
  timelineRules: z.string().max(10_000),
  forbiddenElements: z.array(z.string().max(500)).max(100),
  characterNotes: z.record(z.string().min(1).max(200), characterNoteSchema),
}).strict()

export type StoryBibleContent = z.infer<typeof storyBibleContentSchema>

export interface StoryBibleRecord {
  content: StoryBibleContent
  version: number
  updatedAt: Date
}

export interface StoryBibleRepository {
  findProjectOwner(projectId: string): Promise<string | null>
  findByProject(projectId: string): Promise<StoryBibleRecord | null>
  upsert(projectId: string, content: StoryBibleContent): Promise<StoryBibleRecord>
}

const EMPTY_STORY_BIBLE: StoryBibleContent = {
  worldSummary: '',
  themes: [],
  styleGuide: '',
  timelineRules: '',
  forbiddenElements: [],
  characterNotes: {},
}

function parseStoredContent(raw: string): StoryBibleContent {
  try {
    const parsed: unknown = JSON.parse(raw)
    const result = storyBibleContentSchema.safeParse(parsed)
    return result.success ? result.data : EMPTY_STORY_BIBLE
  } catch {
    return EMPTY_STORY_BIBLE
  }
}

export const prismaStoryBibleRepository: StoryBibleRepository = {
  async findProjectOwner(projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { authorId: true } })
    return project?.authorId ?? null
  },
  async findByProject(projectId) {
    const bible = await prisma.storyBible.findUnique({ where: { projectId } })
    return bible ? { content: parseStoredContent(bible.content), version: bible.version, updatedAt: bible.updatedAt } : null
  },
  async upsert(projectId, content) {
    const bible = await prisma.storyBible.upsert({
      where: { projectId },
      create: { projectId, content: JSON.stringify(content) },
      update: { content: JSON.stringify(content), version: { increment: 1 } },
    })
    return { content: parseStoredContent(bible.content), version: bible.version, updatedAt: bible.updatedAt }
  },
}

async function requireOwner(repository: StoryBibleRepository, req: AuthRequest, res: Response): Promise<boolean> {
  const ownerId = await repository.findProjectOwner(req.params.projectId)
  if (!ownerId) {
    res.status(404).json({ error: '项目不存在' })
    return false
  }
  if (ownerId !== req.userId) {
    res.status(403).json({ error: '无权访问此项目的故事圣经' })
    return false
  }
  return true
}

export function createStoryBibleRouter(repository: StoryBibleRepository = prismaStoryBibleRepository): ExpressRouter {
  const router: ExpressRouter = Router()
  router.use(authenticateToken)

  router.get('/:projectId/story-bible', async (req: AuthRequest, res: Response) => {
    try {
      if (!await requireOwner(repository, req, res)) return
      const record = await repository.findByProject(req.params.projectId)
      res.json(record ?? { content: EMPTY_STORY_BIBLE, version: 0, updatedAt: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : '读取故事圣经失败'
      res.status(500).json({ error: message })
    }
  })

  router.put('/:projectId/story-bible', async (req: AuthRequest, res: Response) => {
    try {
      if (!await requireOwner(repository, req, res)) return
      const content = parseBody(storyBibleContentSchema, req, res)
      if (!content) return
      res.json(await repository.upsert(req.params.projectId, content))
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存故事圣经失败'
      res.status(500).json({ error: message })
    }
  })

  return router
}
