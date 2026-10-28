import type { PrismaClient } from '@prisma/client'

/** An in-memory synthesis cannot continue after a backend restart. Preserve a retryable record. */
export async function recoverInterruptedVoiceJobs(client: Pick<PrismaClient, 'voiceGenerationJob'>) {
  return client.voiceGenerationJob.updateMany({
    where: { status: { in: ['queued', 'running'] } },
    data: { status: 'failed', errorMessage: '本机服务重启，配音任务已中断。原台词与参考片段已保留，请重新生成。', completedAt: new Date() },
  })
}
