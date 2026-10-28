import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
dotenv.config()
const prisma = new PrismaClient()
// The first Japanese instruct2 audition spoke unrelated content in independent ASR review.
// Preserve the file and history, but remove it from playable successful candidates.
prisma.voiceGenerationJob.updateMany({
  where: { id: 'f53303c6-5638-4ebe-9a64-799fb83a5ac4', owner: { username: 'demo' }, status: 'completed', language: 'ja' },
  data: { status: 'failed', errorMessage: '日文内容校验未通过：指令模式出现错读。已改用 GPT-SoVITS 日文参考配音，请重新生成。' },
}).then((result) => console.log(`已标记 ${result.count} 条未通过内容校验的候选，保留历史音频。`)).finally(() => prisma.$disconnect())
