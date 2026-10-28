import { expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { recoverInterruptedVoiceJobs } from './recoverVoiceJobs.js'
it('marks interrupted voice jobs retryable while preserving completed audio and its source records', async () => {
  const updateMany = vi.fn().mockResolvedValue({ count: 2 })
  await expect(recoverInterruptedVoiceJobs({ voiceGenerationJob: { updateMany } } as unknown as PrismaClient)).resolves.toEqual({ count: 2 })
  expect(updateMany).toHaveBeenCalledWith({ where: { status: { in: ['queued', 'running'] } }, data: { status: 'failed', errorMessage: expect.stringContaining('重新生成'), completedAt: expect.any(Date) } })
})
