import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

// Reuse only the already-present, hashed tracks. No network or audio processing.
const root = resolve(import.meta.dirname, '..')
const sourceManifest = 'assets/music-packs/community-vn/manifest.json'
const pack = JSON.parse(readFileSync(resolve(root, sourceManifest), 'utf8'))
if (pack.generativeAiUsed !== false) throw new Error('Source pack must declare author-composed music')
const output = resolve(root, 'apps/web/public/assets/audio/paint-book')
const storyPack = resolve(root, 'assets/story-packs/paint-book')
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const configs = [
  { id: 'tam-atelier', file: 'tam-atelier.ogg', scene: '修道具、工房日常与吃饭', instruments: '钢琴＋弦乐（作者介绍）', sourceUrl: 'https://www.tam-music.com/music/simple' },
  { id: 'tam-ame', file: 'tam-ame.ogg', scene: '河岸车次表、重演与接近', instruments: '钢琴（作者介绍）', sourceUrl: 'https://www.tam-music.com/music/simple' },
  { id: 'maou-acoustic29', file: 'maoudamashii-acoustic29.ogg', scene: '杂货铺与青年日常', instruments: '原声吉他、钢琴（作者标签）', sourceUrl: 'https://maou.audio/bgm_acoustic29/' },
  { id: 'maou-piano12', file: 'maoudamashii-piano12.ogg', scene: '抱旧布的试演、未说完的话之后', instruments: '钢琴（作者分类）', sourceUrl: 'https://maou.audio/bgm_piano12/' },
  { id: 'maou-healing15', file: 'maoudamashii-healing15.ogg', scene: '自己作出决定之后的行动与出发', instruments: '吉他＋钢琴（作者介绍）', sourceUrl: 'https://maou.audio/bgm_healing15/' },
  { id: 'ds-chaolu', file: 'dragonic-symphony-chaolu.ogg', scene: '房间票根、早晨与中国旧街', instruments: '略带中华风的钢琴独奏（作者介绍）', sourceUrl: 'https://d-symphony.com/mt_10.html' },
  { id: 'amacha-tanken', file: 'amacha-tanken.ogg', scene: '后台忙乱与轻松对词', instruments: '弦乐、木管、马林巴、打击乐（作者介绍）', sourceUrl: 'https://amachamusic.chagasi.com/music_natsuyasuminotanken.html' },
  { id: 'amacha-yume', file: 'amacha-yume.ogg', scene: '画作的吸引力、私下愿望与留白', instruments: '钢琴（作者介绍）', sourceUrl: 'https://amachamusic.chagasi.com/music_yume.html' },
]
const usageScope = '仅作为《请让这幅画老去》游戏／可玩故事的嵌入式BGM；不作为独立音乐素材库或音频合集再分发。'
const processing = '原样复制已有community-vn运行音频；本次未重编码、裁切、改变音量或曲速。源pack记录为从原MP3双遍标准化约-18 LUFS/-1 dBTP、LRA=11，Ogg Vorbis q5 / 44.1kHz；这不是本次重新测量响度的声明。'
const licenses = {
  tam: { author: '多夢（TAM Music Factory）', license: 'TAM Music Factory 素材利用规程', licenseUrl: 'https://www.tam-music.com/interface', sourceTermsUrl: 'https://www.tam-music.com/interface', creditLine: '音楽：TAM Music Factory（作曲：多夢/TAM）', licenseBasis: '作者条款允许游戏BGM使用；商业使用须在作品内表示出处，保留站名与链接；不授予素材本身二次配布许可。' },
  maou: { author: '森田交一（魔王魂）', license: 'CC-BY-4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', sourceTermsUrl: 'https://maou.audio/rule/', creditLine: '音楽：魔王魂（作曲：森田交一）', licenseBasis: '作者现行许可页提供CC BY 4.0与魔王魂自站条款的可选路线；本作品明确选择CC BY 4.0，保留作者、曲名、来源、许可链接及源pack处理说明。当前自站条款也要求著作表记；本记录仅覆盖游戏BGM嵌入，不宣称独立素材库再分发授权。' },
  ds: { author: '藤村ほわん（龍的交響楽）', license: '龍的交響楽 素材利用规程', licenseUrl: 'https://d-symphony.com/', sourceTermsUrl: 'https://d-symphony.com/', creditLine: '音楽：龍的交響楽（作曲：藤村ほわん）', licenseBasis: '作者条款允许游戏等媒体、营利与非营利用途；须表记龍的交響楽或来源URL；禁止音频单独或音频合集二次分发。' },
  amacha: { author: '甘茶（甘茶の音楽工房）', license: '甘茶の音楽工房 素材利用规约', licenseUrl: 'https://amachamusic.chagasi.com/terms.html', sourceTermsUrl: 'https://amachamusic.chagasi.com/terms.html', creditLine: '音楽：甘茶の音楽工房（作曲：甘茶）', licenseBasis: '作者条款允许商业与个人游戏BGM，允许改名、转码与音频加工；禁止音乐本身单独售卖或二次配布；本作品统一保留作者署名与链接。' },
}
mkdirSync(output, { recursive: true })
mkdirSync(storyPack, { recursive: true })
const credits = configs.map(config => {
  const track = pack.tracks.find(t => t.role === config.id)
  if (!track) throw new Error(`Missing existing track ${config.id}`)
  const sourceFile = `assets/music-packs/community-vn/${track.outputFile}`
  const source = resolve(root, sourceFile)
  if (hash(source) !== track.sha256) throw new Error(`Source SHA mismatch ${config.id}`)
  const destination = resolve(output, config.file)
  copyFileSync(source, destination)
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,sample_rate,channels', '-of', 'json', destination], { encoding: 'utf8' }))
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', destination, '-f', 'null', '-'], { stdio: 'pipe' })
  const license = licenses[config.id.split('-')[0]]
  return {
    id: config.id, name: track.name, originalName: track.name,
    ...(config.id === 'maou-healing15' ? { subtitle: '水平線の使者' } : {}),
    ...license, sourceUrl: config.sourceUrl, scene: config.scene, instruments: config.instruments,
    attribution: `${license.creditLine} — ${track.name} — ${config.sourceUrl} — ${license.licenseUrl}；源pack转码与响度处理见processing。`,
    sourceFile, sourceSha256: track.sha256, originalFile: track.originalFile, originalSha256: track.originalSha256,
    runtimeFile: `/assets/audio/paint-book/${config.file}`, runtimeSha256: hash(destination), creditsPage: '/assets/audio/paint-book/credits.html',
    durationSeconds: Number(Number(probe.format.duration).toFixed(6)), codec: probe.streams[0].codec_name,
    sampleRate: Number(probe.streams[0].sample_rate), channels: probe.streams[0].channels,
    usageScope, processingOriginalPack: sourceManifest, processingOriginalPackLicenseRecord: 'assets/music-packs/community-vn/LICENSE-SOURCE.md',
    originalPackLicenseAtCopy: track.license, processing, loop: true, seamlessLoopVerified: false,
    generativeAiUsed: false, humanListeningCompleted: false,
    selectionBasis: '作者介绍与本地元数据初选；哈希、时长和完整解码为技术验证，不代表人耳试听。',
    technicalValidation: 'source and runtime SHA-256; ffprobe duration/codec/sample-rate/channels; full ffmpeg decode', checkedAt: '2026-11-03',
  }
})
writeFileSync(resolve(output, 'music-credits.json'), `${JSON.stringify(credits, null, 2)}\n`)
writeFileSync(resolve(storyPack, 'music-map.json'), `${JSON.stringify({ schemaVersion: 1, story: '请让这幅画老去', usage: 'story-bgm-only', creditsUrl: '/assets/audio/paint-book/music-credits.json', creditsPage: '/assets/audio/paint-book/credits.html', tracks: credits.map(c => ({ id: c.id, name: c.name, url: c.runtimeFile, author: c.author, purpose: c.scene, durationSeconds: c.durationSeconds, sha256: c.runtimeSha256, creditsPage: c.creditsPage })) }, null, 2)}\n`)

const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const rows = credits.map(c => `<li><h2>${escape(c.originalName)} <small>${escape(c.author)}</small></h2>${c.subtitle ? `<p>副题：${escape(c.subtitle)}</p>` : ''}<p>${escape(c.scene)} · ${c.durationSeconds.toFixed(1)}秒 · ${escape(c.instruments)}</p><p><a href="${c.sourceUrl}">前往原作者曲目页试听与查看作品</a> · <a href="${c.licenseUrl}">${escape(c.license)}</a></p><p>${escape(c.creditLine)}</p></li>`).join('\n')
const style = '<style>body{max-width:900px;margin:40px auto;padding:0 22px;font:17px/1.7 system-ui,sans-serif;background:#f4f0e8;color:#282521}h1{font-size:28px}h2{font-size:20px}small{display:block;font-size:14px;font-weight:400}ol{padding-left:26px}li{padding:15px 0;border-bottom:1px solid #c9c0b0}a{color:#405c62}p{margin:8px 0}</style>'
writeFileSync(resolve(output, 'credits.html'), `<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>请让这幅画老去 · 音乐署名</title>${style}
<h1>《请让这幅画老去》音乐署名</h1><p>感谢以下作者提供用于作品的音乐。本页列出本故事的8首配乐、作者、许可与原作者来源；不提供音乐下载或独立音乐合集。</p><ol>${rows}</ol>
<h2>使用范围与音频处理</h2><p>${escape(usageScope)}</p><p>${escape(processing)}</p><p>魔王魂3首明确选用CC BY 4.0，保留森田交一、魔王魂、曲名、来源、许可链接和上述加工说明。其他曲目依各作者站的作品BGM条款使用，未扩大为通用素材库再分发许可。</p>
<p>源pack记录、原始与发布SHA均保留在作品随附的music-credits.json。全部音乐由作者创作/制作，使用虚拟音源不代表现场实录。选曲基于作者介绍与元数据，未完成人耳试听；格式与完整解码检查不代表艺术审听或无缝循环确认。</p></html>\n`)
writeFileSync(resolve(root, 'docs/paint-book-music-audition.html'), `<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>请让这幅画老去 · 配乐编排与作者试听入口</title>${style}
<h1>《请让这幅画老去》配乐编排</h1><p>8首作者创作音乐分别承担工房、旧街、杂货铺、后台与人物靠近等场景。此页只介绍作品配乐编排，并链接原作者曲目页供试听，不托管完整音频播放器或提供裸音频下载。</p>
<p>未完成人耳试听：选择依据是作者介绍与元数据，技术检查只证明哈希、格式和解码。请在原作者页面听取音乐，并在实际游戏场景确认音色、对白遮挡和循环接缝。疑点首次出现、人物拒绝与实物核对前停乐，冲突未解决时不提前用配乐宣布和解。</p><ol>${rows}</ol>
<h2>作品内使用</h2><p>${escape(usageScope)}</p><p>${escape(processing)}</p><p>魔王魂曲目按CC BY 4.0署名使用；TAM、龍的交響楽与甘茶曲目依各作者站条款嵌入本作品。全部入口均为原作者的HTTPS页面，在GitHub Pages和本地均不依赖仓库根路径或运行音频路径。</p></html>\n`)
console.log('Copied 8 existing story BGM tracks byte-for-byte; public readable credits, portable mapping, author audition links and full decode checks complete. Human listening not claimed.')
