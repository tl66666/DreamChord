import type { Request, Response } from 'express'
import type { z } from 'zod'

export function parseBody<TSchema extends z.ZodTypeAny>(schema: TSchema, req: Request, res: Response): z.output<TSchema> | undefined {
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0]?.message ?? '请求参数不正确', details: result.error.flatten() })
    return undefined
  }
  return result.data
}
