import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Image as ImageIcon, Loader2, RotateCcw, ScanLine, Trash2, X } from 'lucide-react'
import {
  acceptAssetVariant,
  inspectAsset,
  processAsset,
  rejectAssetVariant,
  type AcceptedAssetVariant,
  type Asset,
  type AssetVariant,
  type ImageAnalysis,
} from '../api/client'
import { useToast } from '../components/FeedbackProvider'

type Purpose = 'sprite' | 'cg' | 'background'
const PURPOSE_LABEL: Record<Purpose, string> = { sprite: '角色立绘', cg: '剧情 CG', background: '场景背景' }
const CHECKER = 'bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e2e8f0_75%),linear-gradient(-45deg,transparent_75%,#e2e8f0_75%)] bg-[length:20px_20px]'

export default function AssetProcessingSheet({ asset, onClose, onAccepted }: { asset: Asset; onClose: () => void; onAccepted: (accepted: AcceptedAssetVariant) => void }) {
  const toast = useToast()
  const [purpose, setPurpose] = useState<Purpose>('sprite')
  const [removeWhite, setRemoveWhite] = useState(true)
  const [trim, setTrim] = useState(true)
  const [threshold, setThreshold] = useState(245)
  const [feather, setFeather] = useState(8)
  const [analysis, setAnalysis] = useState<ImageAnalysis | null>(null)
  const [analysisError, setAnalysisError] = useState(false)
  const [variant, setVariant] = useState<AssetVariant | null>(() => asset.variants?.find((item) => item.status === 'proposed') ?? null)
  const [characterName, setCharacterName] = useState('')
  const [expressionName, setExpressionName] = useState('normal')
  const [busy, setBusy] = useState(false)
  const sourceMeta = useMemo(() => [asset.width && asset.height ? `${asset.width}×${asset.height}` : null, asset.mimeType].filter(Boolean).join(' · '), [asset])

  useEffect(() => {
    let active = true
    inspectAsset(asset.id).then(({ analysis: result }) => {
      if (!active) return
      setAnalysis(result)
      setPurpose(result.recommendedPurpose)
      setRemoveWhite(result.recommendedRecipe.removeWhite)
      setTrim(result.recommendedRecipe.trim)
      setThreshold(result.recommendedRecipe.whiteThreshold)
      setFeather(result.recommendedRecipe.feather)
      setVariant(null)
    }).catch(() => active && setAnalysisError(true))
    return () => { active = false }
  }, [asset.id])

  const changeRecipe = (change: () => void) => { change(); setVariant(null) }
  const generatePreview = async () => {
    setBusy(true)
    try {
      setVariant(await processAsset(asset.id, { purpose, removeWhite: purpose === 'sprite' ? removeWhite : false, whiteThreshold: threshold, feather, trim }))
      toast.success('预览已生成')
    } catch { toast.error('处理失败，请检查图片后重试') } finally { setBusy(false) }
  }
  const accept = async () => {
    if (!variant) return
    if (purpose === 'sprite' && !characterName.trim()) { toast.info('请填写角色名称'); return }
    setBusy(true)
    try {
      const accepted = await acceptAssetVariant(variant.id, { purpose, ...(purpose === 'sprite' ? { characterName: characterName.trim(), expressionName: expressionName.trim() || 'default' } : {}) })
      toast.success(purpose === 'sprite' ? '立绘已绑定角色' : '素材已加入项目')
      onAccepted(accepted); onClose()
    } catch { toast.error('接受素材失败') } finally { setBusy(false) }
  }
  const reject = async () => {
    if (!variant) return
    setBusy(true)
    try { await rejectAssetVariant(variant.id); setVariant(null); toast.info('已拒绝衍生图，原图仍保留') }
    catch { toast.error('拒绝失败') } finally { setBusy(false) }
  }

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm md:p-5">
    <section aria-label="素材处理工作室" className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-md bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div><h2 className="text-base font-semibold text-slate-950">素材处理工作室</h2><p className="mt-1 text-xs text-slate-500">{asset.name} {sourceMeta && `· ${sourceMeta}`}</p></div>
        <button type="button" aria-label="关闭处理工作室" title="关闭" onClick={onClose} className="grid h-8 w-8 place-items-center text-slate-500 hover:bg-slate-100 hover:text-slate-950"><X className="h-4 w-4" /></button>
      </header>

      <div className={`border-b px-5 py-3 ${analysis?.warnings.length ? 'border-amber-200 bg-amber-50' : 'border-cyan-100 bg-cyan-50/70'}`}>
        {analysis ? <div className="flex items-start gap-3">
          {analysis.warnings.length ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /> : <ScanLine className="mt-0.5 h-4 w-4 shrink-0 text-cyan-800" />}
          <div className="min-w-0 text-xs leading-5"><div className="font-semibold text-slate-900">推荐：{PURPOSE_LABEL[analysis.recommendedPurpose]} <span className="ml-2 font-normal text-slate-500">置信度 {Math.round(analysis.confidence * 100)}%</span></div>
            {analysis.reasons.map((reason) => <p key={reason} className="text-slate-600">{reason}</p>)}
            {analysis.warnings.map((warning) => <p key={warning} className="font-medium text-amber-800">{warning}</p>)}
          </div>
        </div> : <div className="flex items-center gap-2 text-xs text-slate-600">{analysisError ? <><AlertTriangle className="h-4 w-4" />无法自动分析，可继续手动处理</> : <><Loader2 className="h-4 w-4 animate-spin" />正在分析图片构图与背景</>}</div>}
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[292px_1fr]">
        <div className="overflow-y-auto border-r border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-700">用途</p>
          <div className="mt-2 grid grid-cols-3 border border-slate-200 p-1">{([['sprite', '立绘'], ['cg', 'CG'], ['background', '背景']] as const).map(([value, label]) => <button key={value} type="button" aria-label={label} onClick={() => changeRecipe(() => setPurpose(value))} className={`h-8 text-xs ${purpose === value ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>)}</div>
          {purpose === 'sprite' && <label className="mt-4 flex items-center gap-2 text-xs text-slate-700"><input aria-label="去除白色背景" type="checkbox" checked={removeWhite} onChange={(event) => changeRecipe(() => setRemoveWhite(event.target.checked))} />去除白色背景</label>}
          <label className="mt-3 flex items-center gap-2 text-xs text-slate-700"><input aria-label="裁掉透明边缘" type="checkbox" checked={trim} onChange={(event) => changeRecipe(() => setTrim(event.target.checked))} />裁掉透明边缘</label>
          {purpose === 'sprite' && <><label className="mt-4 block text-xs text-slate-600">白底阈值 <span className="float-right font-mono">{threshold}</span><input aria-label="白底阈值" type="range" min="180" max="255" value={threshold} onChange={(event) => changeRecipe(() => setThreshold(Number(event.target.value)))} className="mt-2 w-full" /></label><label className="mt-4 block text-xs text-slate-600">边缘羽化 <span className="float-right font-mono">{feather}</span><input aria-label="边缘羽化" type="range" min="0" max="40" value={feather} onChange={(event) => changeRecipe(() => setFeather(Number(event.target.value)))} className="mt-2 w-full" /></label></>}
          <button type="button" aria-label="生成预览" disabled={busy} onClick={() => void generatePreview()} className="mt-5 flex h-10 w-full items-center justify-center gap-2 bg-cyan-700 text-sm font-medium text-white hover:bg-cyan-800 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}生成预览</button>
          {purpose === 'sprite' && variant && <div className="mt-5 space-y-3 border-t border-slate-200 pt-4"><label className="block text-xs text-slate-600">角色名称<input aria-label="角色名称" value={characterName} onChange={(event) => setCharacterName(event.target.value)} className="mt-1 h-9 w-full border border-slate-200 px-2 text-sm" /></label><label className="block text-xs text-slate-600">表情名称<input aria-label="表情名称" value={expressionName} onChange={(event) => setExpressionName(event.target.value)} className="mt-1 h-9 w-full border border-slate-200 px-2 text-sm" /></label></div>}
        </div>

        <div className="grid min-h-[420px] grid-cols-1 gap-px bg-slate-200 md:grid-cols-2">
          <Preview title="原图"><img src={asset.url} alt="原始图片" className="max-h-full max-w-full object-contain" /></Preview>
          <Preview title={variant ? `处理结果 · ${variant.width}×${variant.height}` : '处理结果'}>{variant ? <img src={variant.url} alt="处理结果" className="max-h-full max-w-full object-contain" /> : <div className="text-center text-slate-500"><ImageIcon className="mx-auto mb-2 h-5 w-5" /><p className="text-xs">确认参数后生成预览</p></div>}</Preview>
        </div>
      </div>

      <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">{variant && <button type="button" aria-label="拒绝衍生图" disabled={busy} onClick={() => void reject()} className="flex h-9 items-center gap-1.5 border border-red-200 px-3 text-sm text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" />拒绝</button>}<button type="button" aria-label="接受并绑定" disabled={!variant || busy} onClick={() => void accept()} className="flex h-9 items-center gap-1.5 bg-slate-950 px-4 text-sm font-medium text-white disabled:opacity-40"><Check className="h-4 w-4" />{purpose === 'sprite' ? '接受并绑定' : '接受为项目素材'}</button></footer>
    </section>
  </div>
}

function Preview({ title, children }: { title: string; children: React.ReactNode }) {
  return <figure className="flex min-h-0 flex-col bg-slate-50 p-4"><figcaption className="mb-3 text-xs font-semibold text-slate-700">{title}</figcaption><div className={`flex min-h-0 flex-1 items-center justify-center overflow-hidden ${CHECKER}`}>{children}</div></figure>
}
