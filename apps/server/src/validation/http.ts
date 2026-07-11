import type { Request, Response } from 'express'
import type { z } from 'zod'

export function parseBody<T>(schema: z.ZodType<T>, req: Request, res: Response): T | undefined {
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: '请求参数不正确', details: result.error.flatten() })
    return undefined
  }
  return result.data
}
