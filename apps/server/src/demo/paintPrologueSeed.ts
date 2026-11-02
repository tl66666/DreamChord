import type { PrismaClient } from '@prisma/client'
import { installPaintPrologue, type PaintOptions } from '../project/paintTemplate.js'

/** Never updates existing official or author data, even when the bundled script changes. */
export async function seedPaintPrologue(client: PrismaClient, authorId: string, options: PaintOptions = {}) {
  return installPaintPrologue(client, authorId, 'dreamchord-paint-prologue', true, options)
}
