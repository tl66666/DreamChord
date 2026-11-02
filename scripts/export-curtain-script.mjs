import { writeFileSync } from 'node:fs'
import { CURTAIN_CALL_DEMO, CURTAIN_STARTER_ENDING } from '../packages/story-domain/dist/index.js'
const lines = [...CURTAIN_CALL_DEMO.graph.nodes.filter(n => n.type === 'dialogue'), CURTAIN_STARTER_ENDING].map(n => ({ id: n.id, role: n.data.role, text: n.data.text, ja: n.data.localizations.ja.text }))
writeFileSync(new URL('../.runtime/curtain-script.json', import.meta.url), JSON.stringify(lines, null, 2) + '\n')
console.log(`${lines.length} spoken lines, ${lines.length * 2} bilingual takes.`)
