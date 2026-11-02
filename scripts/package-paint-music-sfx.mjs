import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const root = resolve(import.meta.dirname, '..')
const out = resolve(root, 'apps/web/public/assets/audio/paint-prologue')
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const probe = file => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,sample_rate,channels', '-of', 'json', file], { encoding: 'utf8' }))
const checked = (file, sha) => { if (hash(resolve(root, file)) !== sha) throw new Error(`Source SHA mismatch: ${file}`); return resolve(root, file) }
const duration = file => Number(Number(probe(file).format.duration).toFixed(6))
const save = (kind, rows) => writeFileSync(resolve(out, `${kind}-credits.json`), JSON.stringify(rows, null, 2) + '\n')
const runtimeFields = (id, sourceFile, processing) => ({ sourceFile, sourceSha256: hash(resolve(root, sourceFile)), runtimeFile: `/assets/audio/paint-prologue/${id}.ogg`, runtimeSha256: hash(resolve(out, `${id}.ogg`)), durationSeconds: duration(resolve(out, `${id}.ogg`)), processing, generativeAiUsed: false, humanListeningCompleted: false, technicalValidation: 'ffprobe duration/codec; full ffmpeg decode; source and runtime SHA-256', checkedAt: '2026-11-02' })
mkdirSync(out, { recursive: true })

const ternox = JSON.parse(readFileSync(resolve(root, 'assets/music-packs/ternox-vn/manifest.json'), 'utf8'))
const music = [
  { id: 'workshop', role: 'afternoon', name: '工房的午后 · 午后余白', scene: '序章工房与修椅子' },
  { id: 'afterglow', role: 'twilight', name: '散场后的灯 · 暮色校舍', scene: '序章散场后与创作起始场景' },
].map(({ role, ...track }) => {
  const original = ternox.tracks.find(t => t.role === role)
  if (!original || original.license !== 'CC0-1.0' || original.author !== 'TERNOX') throw new Error(`Unverified music credit: ${role}`)
  const sourceFile = `assets/music-packs/ternox-vn/${original.outputFile}`
  copyFileSync(checked(sourceFile, original.sha256), resolve(out, `${track.id}.ogg`))
  return { ...track, author: 'TERNOX', license: 'CC0-1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', sourceUrl: 'https://ternox.itch.io/vn-music', originalFile: original.originalFile, originalSha256: original.originalSha256, attribution: 'Music by TERNOX — Big music pack for visual novel (CC0)', loop: true, ...runtimeFields(track.id, sourceFile, '原样复制已验证的官方TERNOX Ogg；原pack已从原MP3双遍标准化约-18 LUFS/-1 dBTP，Vorbis q5。此次未重编码、未裁切、未改变音乐。中文曲名为本项目场景别名。') }
})
save('music', music)

const sourceRoot = 'assets/audio-packs/paint-prologue/source'
const applauseSource = `${sourceRoot}/Applause01-5-Random-Slow.mp3`
const woodSource = `${sourceRoot}/Sensu02-13-Put-Wood.mp3`
checked(applauseSource, '83358f39b24b2e048b4a35fba8c09366c49ce1e6d2779d7caddbf7e3fb959f50')
checked(woodSource, '334360dfaf71a96ef2e89a30265039b1e8acd3940bf6715d77f79a95d39b6ea6')
const applausePositions = [
  { speed: .88, delay: 0, left: .9, right: .25 }, { speed: .94, delay: 137, left: .8, right: .4 },
  { speed: 1.03, delay: 281, left: .7, right: .5 }, { speed: 1.09, delay: 73, left: .6, right: .6 },
  { speed: .91, delay: 392, left: .5, right: .7 }, { speed: .98, delay: 214, left: .4, right: .8 },
  { speed: 1.06, delay: 476, left: .25, right: .9 }, { speed: 1.13, delay: 329, left: .55, right: .65 },
]
const applauseFilter = [
  `[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=mono,asplit=8${applausePositions.map((_, i) => `[a${i}]`).join('')}`,
  ...applausePositions.map((p, i) => `[a${i}]atempo=${p.speed},adelay=${p.delay}:all=1,pan=stereo|c0=${p.left}*c0|c1=${p.right}*c0[b${i}]`),
  `${applausePositions.map((_, i) => `[b${i}]`).join('')}amix=inputs=8:normalize=1:dropout_transition=0,atrim=duration=5,highpass=f=100,lowpass=f=7000,afade=t=in:st=0:d=0.1,afade=t=out:st=3.7:d=1.3,loudnorm=I=-24:TP=-4:LRA=7,aresample=44100[output]`,
].join(';')
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', resolve(root, applauseSource), '-filter_complex', applauseFilter, '-map', '[output]', '-c:a', 'libvorbis', '-q:a', '5', resolve(out, 'applause.ogg')], { stdio: 'pipe' })
const woodFilter = 'asetrate=39690,aresample=44100,highpass=f=60,lowpass=f=5000,silenceremove=start_periods=1:start_duration=0.01:start_threshold=-50dB,atrim=duration=1.25,afade=t=out:st=1.05:d=0.2,loudnorm=I=-24:TP=-6:LRA=7,aresample=44100'
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', resolve(root, woodSource), '-af', woodFilter, '-c:a', 'libvorbis', '-q:a', '5', resolve(out, 'wood.ogg')], { stdio: 'pipe' })
const community = JSON.parse(readFileSync(resolve(root, 'assets/music-packs/community-vn/manifest.json'), 'utf8'))
const paper = community.demoSfx.files.find(f => f.role === 'sfx-paper')
if (!paper) throw new Error('Missing credited Book01 source')
copyFileSync(checked(paper.outputFile, paper.sha256), resolve(out, 'paper.ogg'))
const commonSfx = { author: 'OtoLogic', license: 'CC-BY-4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', termsUrl: 'https://otologic.jp/free/license', attribution: 'Sound effects by OtoLogic (https://otologic.jp/) — CC BY 4.0; adaptations described per clip.', usage: '场景音效播放；未用于任何声音克隆、模型训练或语音参考。' }
save('sfx', [
  { id: 'wood', name: '轻木质碰撞 · 竹木道具置于木面', ...commonSfx, sourceUrl: 'https://otologic.jp/free/se/household-others01.html', sourceDownloadUrl: 'https://otologic.jp/sounds/se/pre/Sensu02-13%28Put-Wood%29.mp3', originalSound: '扇子02-13（置く 木）', originalRecording: 'OtoLogic实录竹骨和纸折扇置于木面；C414 XLS / Fireface UFX II，40cm单声道。作为木椅轻碰撞的foley替代，并非真实椅子倒地录音。', ffmpegFilter: woodFilter, ...runtimeFields('wood', woodSource, '原木质生活物声轻降调至0.9倍、滤掉低于60Hz与高于5kHz的频率、裁去开头静默并截为1.25秒、末尾0.2秒淡出、编码前响度目标-24 LUFS/峰值目标-6 dBTP（有损编码后允许微小峰值偏移）；无额外合成冲击、爆炸或跳吓层。') },
  { id: 'paper', name: '剧本翻纸 · Book01', ...commonSfx, sourceUrl: paper.sourceUrl, originalSound: '本01（Book01）', ...runtimeFields('paper', paper.outputFile, '原样复制此前社区pack已许可并发布的纸张翻动Ogg；本轮不重编码、不改变响度。具体原始Book01变体编号未在旧pack中保留，不补造编号。') },
  { id: 'applause', name: '八个座位的掌声 · 单人手拍轻叠加', ...commonSfx, sourceUrl: 'https://otologic.jp/free/se/applause-cheer01.html', sourceDownloadUrl: 'https://otologic.jp/sounds/se/pre2/Applause01-5%28Random-Slow%29.mp3', originalSound: '拍手01-5（ランダム 遅い）', originalRecording: 'OtoLogic单人真实手拍的近距离干声录音；无欢呼与台词。八层处理表示八个虚拟听众位置，不声称录制了八名不同的人。', layers: applausePositions, ffmpegFilter: applauseFilter, ...runtimeFields('applause', applauseSource, '从单人随机慢速手拍生成8个轻度错时、速度微调与声像不同的层，等权平均而非直接放大叠加；总长5秒、0.1秒淡入、1.3秒淡出、高通100Hz/低通7kHz、响度目标-24 LUFS/峰值-4 dBTP；没有追加欢呼、合成声音或大场馆残响。') },
])
for (const id of ['workshop', 'afterglow', 'wood', 'paper', 'applause']) execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', resolve(out, `${id}.ogg`), '-f', 'null', '-'], { stdio: 'pipe' })
console.log('Packaged 2 licensed music tracks and 3 credited scene sound effects; technical checks completed, human listening not claimed.')
