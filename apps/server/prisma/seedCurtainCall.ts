import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { seedCurtainCall } from '../src/demo/curtainCallSeed.js'
import { prepareCurtainCast, installCurtainCast } from '../src/project/curtainTemplate.js'
const server = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(server, '.env') })
const client = new PrismaClient()
async function main() {
  const owner = await client.user.findUniqueOrThrow({ where: { username: 'demo' } })
  const cast = await prepareCurtainCast(owner.id, 'official-curtain-call', path.resolve(server, process.env.UPLOAD_DIR || './uploads'))
  const project = await seedCurtainCall(client, owner.id)
  await client.$transaction(async tx => {
    const profiles = await installCurtainCast(tx, owner.id, 'official-curtain-call', cast, true)
    for (const voice of cast.voices) {
      const character = await tx.character.findUnique({ where: { projectId_name: { projectId: project.id, name: voice.role } } })
      if (character) await tx.characterVoiceBinding.upsert({ where: { characterId: character.id }, update: {}, create: { projectId: project.id, characterId: character.id, profileId: profiles.get(voice.id)! } })
    }
  })
  const credits = JSON.parse(await readFile(path.resolve(server, '../web/public/assets/audio/curtain-call/music-credits.json'), 'utf8')) as Array<{ id: string; name: string; mood: string; scene: string; author: string; license: string; sourceUrl: string; durationSeconds: number; sha256: string }>
  for (const t of credits) await client.asset.upsert({ where: { id: `curtain-music-${t.id}` }, update: {}, create: { id: `curtain-music-${t.id}`, ownerId: owner.id, name: t.name, type: 'BGM', url: `/assets/audio/curtain-call/${t.id}.ogg`, mimeType: 'audio/ogg', metadata: JSON.stringify({ audioLibrary: { mood: t.mood, style: '视觉小说原声', scene: t.scene, loop: true, license: `${t.license} · ${t.author}`, source: t.sourceUrl }, durationSeconds: t.durationSeconds, sha256: t.sha256, generativeAiUsed: false }) } })
  console.log(`${project.title}：3 位角色、62 条中日配音、4 首配乐。已有作品内容和绑定保留。`)
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => client.$disconnect())
