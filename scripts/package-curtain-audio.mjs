import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { CURTAIN_CALL_DEMO, CURTAIN_STARTER_ENDING } from '../packages/story-domain/dist/index.js'
const root = resolve(import.meta.dirname, '..'), pack = resolve(root, 'assets/voice-packs/curtain-call')
const manifest = JSON.parse(readFileSync(resolve(pack, 'manifest.json'), 'utf8'))
const out = resolve(root, 'apps/web/public/assets/audio/curtain-call')
mkdirSync(out, { recursive: true })
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex')
for (const n of [...CURTAIN_CALL_DEMO.graph.nodes.filter(n => n.type === 'dialogue'), CURTAIN_STARTER_ENDING]) for (const language of ['zh', 'ja']) {
  const id = `${n.id}-${language}`, take = manifest.takes.find(t => t.id === id)
  const text = language === 'zh' ? n.data.text : n.data.localizations.ja.text
  if (!take || take.text !== text || !/^[a-z0-9-]+\.wav$/.test(take.outputFile) || hash(resolve(pack, take.outputFile)) !== take.sha256) throw new Error(`Unverified take: ${id}`)
  const target = resolve(out, `${id}.ogg`)
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', resolve(pack, take.outputFile), '-af', 'loudnorm=I=-18:TP=-1.5:LRA=11', '-ar', '24000', '-c:a', 'libvorbis', '-q:a', '5', target], { stdio: 'pipe' })
  take.runtimeFile = `/assets/audio/curtain-call/${id}.ogg`
  take.runtimeSha256 = hash(target)
}
const oldRoot = resolve(root, 'apps/web/public/assets/audio/seventh-row')
const credits = JSON.parse(readFileSync(resolve(oldRoot, 'music-credits.json'), 'utf8'))
const music = [
  { id: 'backstage', old: 'live', name: '谢幕之前 · 排练与拌嘴', mood: '日常', scene: '晚会后台，轻松对话' },
  { id: 'unsaid', old: 'room', name: '没说出口 · 上台前一分钟', mood: '忧郁', scene: '克制的谈心，选择前留白' },
  { id: 'invitation', old: 'original', name: '下一次见面 · 夏夜约定', mood: '温柔', scene: '散场礼堂，校园同行' },
  { id: 'station', old: 'rain', name: '话还没说完 · 清晨送行', mood: '治愈', scene: '车站告别，开放式结尾' },
].map(({ old, ...track }) => {
  const credit = credits.find(t => t.id === old)
  if (!credit || hash(resolve(oldRoot, `${old}.ogg`)) !== credit.sha256) throw new Error(`Missing verified source music: ${old}`)
  copyFileSync(resolve(oldRoot, `${old}.ogg`), resolve(out, `${track.id}.ogg`))
  return { ...credit, ...track, originalSourceRole: credit.sourceRole, generativeAiUsed: false }
})
writeFileSync(resolve(out, 'music-credits.json'), JSON.stringify(music, null, 2) + '\n')
manifest.runtimeEncoding = 'Ogg Vorbis q5, mono 24 kHz, -18 LUFS, -1.5 dBTP'
writeFileSync(resolve(pack, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`Verified and packaged ${manifest.takes.length} dialogue clips and ${music.length} human-composed tracks.`)
