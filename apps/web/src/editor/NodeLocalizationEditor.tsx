import { useEffect, useState } from 'react'
import { readLocalizationFields, voiceTextHash, type StoryLocale } from '@dreamchord/story-domain'
import { getAssetLibrary, type Asset } from '../api/client'
import DialogueVoiceGenerator from './DialogueVoiceGenerator'

export default function NodeLocalizationEditor({ nodeId, data, onUpdate }: { nodeId?: string; data: Record<string, unknown>; onUpdate: (patch: Record<string, unknown>) => void }) {
  const [open, setOpen] = useState(false)
  const [assets, setAssets] = useState<Asset[]>([])
  const [error, setError] = useState('')
  const fields = readLocalizationFields(data)
  const japanese = fields.localizations?.ja || {}
  const text = typeof data.text === 'string' ? data.text : ''
  const choices = Array.isArray(data.choices) ? data.choices.map(String) : []
  const sourceHash = voiceTextHash(text || choices.join('\n'))
  const translationStale = japanese.sourceHash && japanese.sourceHash !== sourceHash
  useEffect(() => {
    if (open) void getAssetLibrary().then((items) => setAssets(items.filter((asset) => asset.type === 'VOICE'))).catch(() => setError('配音素材暂时无法读取。'))
  }, [open])
  const updateJapanese = (patch: Record<string, unknown>) => onUpdate({ localizations: { ...fields.localizations, ja: { ...japanese, ...patch, sourceHash } } })
  const selectVoice = (locale: StoryLocale, url: string) => {
    const voiceTracks = { ...fields.voiceTracks }
    if (url) {
      const source = voiceMetadata(assets.find((asset) => asset.url === url))
      const expectedText = locale === 'zh' ? text : japanese.text || ''
      if (source.text && voiceTextHash(source.text) !== voiceTextHash(expectedText)) { setError('该配音的台词与当前语言原文不同，请重新生成或选择对应台词的录音。'); return }
      voiceTracks[locale] = { url, textHash: voiceTextHash(expectedText) }
    }
    else delete voiceTracks[locale]
    setError('')
    onUpdate({ voiceTracks })
  }
  return <div className="mt-4 space-y-3">
    {nodeId && typeof data.text === 'string' && <DialogueVoiceGenerator key={nodeId} nodeId={nodeId} data={data} onUpdate={onUpdate} />}
    <details className="rounded-xl border border-dream-100 bg-white p-3" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer text-xs font-semibold text-dream-700">高级：译文与语言音轨</summary>
    {open && <div className="mt-3 space-y-3">
      <p className="text-xs leading-5 text-slate-500">日语配音会自动翻译中文。这里可以选用已有配音，或手动修订译文；修改后需重新生成。</p>
      {translationStale && <p role="status" className="rounded-lg bg-amber-100 p-2 text-xs text-amber-900">中文原文已变化，请检查日文译文。<button className="ml-2 underline" onClick={() => updateJapanese({})}>确认译文已同步</button></p>}
      {typeof data.text === 'string' && <label className="block text-xs font-medium text-slate-700">日文台词<textarea aria-label="日文台词" lang="ja" rows={3} maxLength={20000} value={japanese.text || ''} onChange={(event) => updateJapanese({ text: event.target.value })} className={control} /></label>}
      {choices.map((_, index) => <label key={index} className="block text-xs font-medium text-slate-700">日文选项 {index + 1}<input aria-label={`日文选项 ${index + 1}`} lang="ja" value={japanese.choices?.[index] || ''} maxLength={200} onChange={(event) => { const translated = choices.map((__, choiceIndex) => japanese.choices?.[choiceIndex] || ''); translated[index] = event.target.value; updateJapanese({ choices: translated }) }} className={control} /></label>)}
      {typeof data.text === 'string' && <label className="block text-xs font-medium text-slate-700">日文显示名<input aria-label="日文显示名" value={japanese.speaker || ''} onChange={(event) => updateJapanese({ speaker: event.target.value })} className={control} /></label>}
      {typeof data.text === 'string' && <div className="grid gap-3 sm:grid-cols-2">{(['zh', 'ja'] as const).map((locale) => <label key={locale} className="text-xs font-medium text-slate-700">{locale === 'zh' ? '中文配音轨' : '日文配音轨'}<select aria-label={locale === 'zh' ? '中文配音轨' : '日文配音轨'} value={fields.voiceTracks?.[locale]?.url || ''} onChange={(event) => selectVoice(locale, event.target.value)} className={control}><option value="">{locale === 'zh' ? '使用原配音（若有）' : '无日文配音'}</option>{assets.filter((asset) => { const language = voiceMetadata(asset).language; return !language || language.split('-')[0] === locale }).map((asset) => <option key={asset.id} value={asset.url}>{asset.name}{!voiceMetadata(asset).language ? '（语言未标记）' : ''}</option>)}</select></label>)}</div>}
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
    </div>}
    </details>
  </div>
}
const control = 'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-dream-600'

function voiceMetadata(asset?: Asset): { text?: string; language?: string } {
  try {
    const value = JSON.parse(asset?.metadata || '{}').voiceGeneration
    return { ...(typeof value?.text === 'string' ? { text: value.text } : {}), ...(typeof value?.language === 'string' ? { language: value.language } : {}) }
  } catch { return {} }
}
