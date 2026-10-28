import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { GptSovitsProvider } from '../apps/server/dist/voice/gptSovitsProvider.js'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const provider = new GptSovitsProvider({ baseUrl: 'http://127.0.0.1:9880', timeoutMs: 180000 })
const result = await provider.synthesize({ text: '大丈夫。一緒に、この物語の続きを書こう。', textLanguage: 'ja', promptText: 'クリップボードが空っぽ。クラウドのバックアップまで、一行ずつ白くなってる。', promptLanguage: 'ja', referencePath: path.join(root, 'assets/voice-packs/dreamchord-cast/generated/s1-d3-ja.wav'), speed: 1, seed: 241028 })
await writeFile(path.join(root, '.runtime/voice-auditions/bilingual-ja-gpt.wav'), result.bytes)
console.log(JSON.stringify({ bytes: result.bytes.length, mode: result.providerMetadata }))
