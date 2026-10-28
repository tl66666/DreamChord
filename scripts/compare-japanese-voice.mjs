import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CosyVoiceProvider } from '../apps/server/dist/voice/cosyVoiceProvider.js'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const provider = new CosyVoiceProvider({ baseUrl: 'http://127.0.0.1:50000', timeoutMs: 180000, sampleRate: 24000 })
const result = await provider.synthesize({ text: '大丈夫。一緒に、この物語の続きを書こう。', textLanguage: 'ja', promptText: 'クリップボードが空っぽ。クラウドのバックアップまで、一行ずつ白くなってる。', promptLanguage: 'ja', referencePath: path.join(root, 'assets/voice-packs/dreamchord-cast/generated/s1-d3-ja.wav'), speed: 1 })
await writeFile(path.join(root, '.runtime/voice-auditions/bilingual-ja-zero.wav'), result.bytes)
console.log(JSON.stringify({ bytes: result.bytes.length, durationSeconds: (result.bytes.length - 44) / 2 / 24000, mode: result.providerMetadata }))
