import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Archive, BookOpen, Edit3, Image as ImageIcon, Loader2, Mic2, Music2, Plus, RotateCcw, Save, SlidersHorizontal, Trash2, Upload, Users, X } from 'lucide-react'
import { deleteAsset, getAssetLibrary, renameAsset, updateAssetDetails, uploadAsset, type Asset, type AudioLibraryMetadata } from '../api/client'
import {
  CHARACTER_KEY,
  SCENE_KEY,
  STORY_TEMPLATE_KEY,
  conflictTemplates,
  defaultCharacters,
  defaultScenes,
  defaultTemplates,
  loadLibraryCharacters,
  loadLibraryScenes,
  loadStoryTemplates,
  type LibraryCharacter,
  type LibraryScene,
  type StoryTemplate,
} from '../lib/libraryData'
import { useAuthStore } from '../stores/authStore'
import { useToast, useConfirm } from '../components/FeedbackProvider'
import AssetProcessingSheet from '../assets/AssetProcessingSheet'
import VoiceLibrary from '../voice/VoiceLibrary'
import CharacterGallery from '../library/CharacterGallery'
import MusicLibrary from '../library/MusicLibrary'
import AppHeader from '../components/AppHeader'
import SceneCatalog from '../library/SceneCatalog'

function getApiError(err: unknown, fallback = '操作失败'): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response
    return response?.data?.error || fallback
  }
  return err instanceof Error ? err.message || fallback : fallback
}

type LibraryTab = 'characters' | 'scenes' | 'stories' | 'voices' | 'music' | 'projectAssets'
const AUDIO_ASSET_TYPES = ['BGM', 'SFX', 'VOICE', 'VOICE_SAMPLE']
const assetTypeLabel = (type: string) => ({ CG: '插画与立绘', BACKGROUND: '背景图片', BGM: '背景音乐', SFX: '环境与剧情音效', VOICE: '对白配音成品', VOICE_SAMPLE: '声线参考录音', OTHER: '其他文件' })[type] || '其他文件'

const tabs: { id: LibraryTab; label: string; icon: ReactNode }[] = [
  { id: 'characters', label: '角色立绘', icon: <Users className="h-4 w-4" /> },
  { id: 'scenes', label: '背景场景', icon: <ImageIcon className="h-4 w-4" /> },
  { id: 'stories', label: '剧情模板', icon: <BookOpen className="h-4 w-4" /> },
  { id: 'voices', label: '角色音色', icon: <Mic2 className="h-4 w-4" /> },
  { id: 'music', label: '音乐与音效', icon: <Music2 className="h-4 w-4" /> },
  { id: 'projectAssets', label: '我的文件', icon: <Archive className="h-4 w-4" /> },
]

export default function LibraryPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const toast = useToast()
  const confirm = useConfirm()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab') as LibraryTab | null
  const activeTab: LibraryTab = tabs.some((tab) => tab.id === requestedTab) ? requestedTab! : 'characters'
  const setActiveTab = (tab: LibraryTab) => setSearchParams((current) => { const next = new URLSearchParams(current); next.set('tab', tab); return next }, { replace: true })
  const [characters, setCharacters] = useStoredState(CHARACTER_KEY, defaultCharacters, loadLibraryCharacters)
  const [scenes, setScenes] = useStoredState(SCENE_KEY, defaultScenes, loadLibraryScenes)
  const [templates, setTemplates] = useStoredState(STORY_TEMPLATE_KEY, defaultTemplates, loadStoryTemplates)
  const [editingCharacter, setEditingCharacter] = useState<LibraryCharacter | null>(null)
  const [editingScene, setEditingScene] = useState<LibraryScene | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<StoryTemplate | null>(null)
  const [selectedExpression, setSelectedExpression] = useState<Record<string, string>>({})
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetType, setAssetType] = useState('CG')
  const [assetLoading, setAssetLoading] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [processingAsset, setProcessingAsset] = useState<Asset | null>(null)

  useEffect(() => {
    if (!user) return
    setAssetLoading(true)
    getAssetLibrary()
      .then(setAssets)
      .catch(console.error)
      .finally(() => setAssetLoading(false))
  }, [user])

  const saveCharacter = () => {
    if (!editingCharacter) return
    setCharacters((prev) => upsertById(prev, stamp({ ...editingCharacter, name: editingCharacter.name.trim() || '未命名角色' })))
    setEditingCharacter(null)
  }

  const saveScene = () => {
    if (!editingScene) return
    setScenes((prev) => upsertById(prev, stamp({ ...editingScene, name: editingScene.name.trim() || '未命名场景' })))
    setEditingScene(null)
  }

  const saveTemplate = () => {
    if (!editingTemplate) return
    setTemplates((prev) => upsertById(prev, stamp({ ...editingTemplate, title: editingTemplate.title.trim() || '未命名剧情素材' })))
    setEditingTemplate(null)
  }

  const useConflictTemplate = (title: string, content: string) => {
    setEditingTemplate({
      id: `template-${Date.now()}`,
      title,
      summary: '由戏剧冲突模板套入，可继续改写成项目剧情素材。',
      content,
      updatedAt: today(),
    })
  }

  const handleUpload = async (file: File | undefined, overrideType?: string) => {
    if (!file) return
    setAssetLoading(true)
    try {
      const uploaded = await uploadAsset(file, overrideType || assetType)
      setAssets((prev) => [uploaded, ...prev])
    } catch (err: unknown) {
      toast.error(getApiError(err, '上传失败，请确认已经登录并检查文件格式'))
    } finally {
      setAssetLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const confirmRename = async (asset: Asset) => {
    const name = renameValue.trim()
    if (!name) return
    const updated = await renameAsset(asset.id, name)
    setAssets((prev) => prev.map((item) => (item.id === asset.id ? updated : item)))
    setRenamingId(null)
  }

  const removeAsset = async (asset: Asset) => {
    if (!await confirm({ message: `确定删除素材"${asset.name}"吗？`, danger: true })) return false
    await deleteAsset(asset.id)
    setAssets((prev) => prev.filter((item) => item.id !== asset.id))
    return true
  }

  const updateAudioAsset = async (assetId: string, details: { name?: string; audioLibrary?: AudioLibraryMetadata }) => {
    const updated = await updateAssetDetails(assetId, details)
    setAssets((current) => current.map((asset) => asset.id === updated.id ? updated : asset))
    return updated
  }

  return (<>
    <main className="dc-page">
      <div className="sticky top-0 z-40"><AppHeader title="素材库" wide actions={searchParams.get('project') ? <button onClick={() => navigate(`/editor/${searchParams.get('project')}`)} className="dc-secondary">返回编辑器</button> : undefined} /></div>

      <div data-testid="library-shell" className="mx-auto grid max-w-[1760px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-8 lg:py-8">
        <aside data-testid="library-navigation" className="grid h-fit grid-cols-3 gap-1 overflow-x-auto rounded-2xl border border-slate-200/90 bg-white p-2 shadow-sm lg:sticky lg:top-24 lg:block">
          {tabs.map((tab, index) => (
            <div key={tab.id} className="shrink-0">{[0, 3, 5].includes(index) && <p className="mb-2 mt-3 hidden px-3 text-[10px] font-semibold tracking-widest text-slate-400 lg:block">{index === 0 ? '视觉与剧情' : index === 3 ? '声音素材' : '文件管理'}</p>}<button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-2 text-left text-xs font-medium sm:text-sm lg:justify-start lg:gap-2 lg:px-3 transition lg:mb-1 lg:w-full ${activeTab === tab.id ? 'bg-dream-50 text-dream-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}>
              {tab.icon}
              {tab.label}
            </button></div>
          ))}
        </aside>

        <section data-testid="library-content" className={`min-h-[680px] min-w-0 ${['characters', 'voices', 'music', 'scenes'].includes(activeTab) ? '' : 'rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm'}`}>
          {activeTab === 'characters' && (
            <CharacterGallery
              characters={characters}
              selectedExpression={selectedExpression}
              onSelectExpression={(characterId, expressionId) => setSelectedExpression((prev) => ({ ...prev, [characterId]: expressionId }))}
              onCreate={() => setEditingCharacter(newCharacter())}
              onEdit={(character) => setEditingCharacter(structuredClone(character))}
              onDelete={(id) => setCharacters((prev) => prev.filter((item) => item.id !== id))}
              onReset={async () => { if (await confirm({ message: '确定恢复默认角色库吗？', danger: true })) setCharacters(defaultCharacters) }}
              editor={editingCharacter ? <CharacterEditor character={editingCharacter} onChange={setEditingCharacter} onSave={saveCharacter} onCancel={() => setEditingCharacter(null)} /> : null}
            />
          )}
          {activeTab === 'scenes' && (
            <SceneLibrary
              scenes={scenes}
              editingScene={editingScene}
              onCreate={() => setEditingScene(newScene())}
              onEdit={(scene) => setEditingScene({ ...scene })}
              onChange={setEditingScene}
              onSave={saveScene}
              onCancel={() => setEditingScene(null)}
              onDelete={async (id) => { if (await confirm({ message: '从背景库移除这个背景？原始图片文件不会删除。', danger: true })) setScenes((prev) => prev.filter((item) => item.id !== id)) }}
              onUploaded={(asset) => setAssets((items) => [asset, ...items])}
              onUse={(scene, projectId) => navigate(`/editor/${projectId}?libraryBackground=${encodeURIComponent(scene.id)}`)}
              initialProjectId={searchParams.get('project') || ''}
              onReset={async () => { if (await confirm({ message: '确定恢复默认场景库吗？', danger: true })) setScenes(defaultScenes) }}
            />
          )}
          {activeTab === 'stories' && (
            <StoryLibrary
              templates={templates}
              editingTemplate={editingTemplate}
              onCreate={() => setEditingTemplate(newTemplate())}
              onEdit={(template) => setEditingTemplate({ ...template })}
              onChange={setEditingTemplate}
              onSave={saveTemplate}
              onCancel={() => setEditingTemplate(null)}
              onDelete={(id) => setTemplates((prev) => prev.filter((item) => item.id !== id))}
              onUseConflict={useConflictTemplate}
            />
          )}
          {activeTab === 'voices' && (user ? <VoiceLibrary projectId={searchParams.get('project') || ''} onOpenProject={(id) => navigate(id ? `/editor/${id}?panel=voices` : '/')} /> : <div><SectionTitle title="声音库" desc="登录后管理私有音色、授权参考片段和角色绑定。" /><Link to="/login" className="mt-4 inline-flex rounded-lg bg-dream-600 px-4 py-2 text-sm font-medium text-white">登录后使用</Link></div>)}
          {activeTab === 'music' && (user ? <MusicLibrary assets={assets} loading={assetLoading} onUpload={(file, type) => handleUpload(file, type)} onUpdate={updateAudioAsset} onDelete={removeAsset} /> : <div><SectionTitle title="音乐库" desc="登录后管理 BGM 与音效素材。" /><Link to="/login" className="mt-4 inline-flex rounded-lg bg-dream-600 px-4 py-2 text-sm font-medium text-white">登录后使用</Link></div>)}
          {activeTab === 'projectAssets' && (
            <ProjectAssetLibrary
              user={user}
              assets={assets}
              assetType={assetType}
              assetLoading={assetLoading}
              renamingId={renamingId}
              renameValue={renameValue}
              fileInputRef={fileInputRef}
              onAssetTypeChange={setAssetType}
              onUpload={handleUpload}
              onStartRename={(asset) => { setRenamingId(asset.id); setRenameValue(asset.name) }}
              onRenameValueChange={setRenameValue}
              onConfirmRename={confirmRename}
              onCancelRename={() => setRenamingId(null)}
              onDelete={removeAsset}
              onRegisterScene={(asset) => {
                setScenes((prev) => upsertById(prev, stamp({
                  id: slugifyAssetName(asset.name, 'scene'),
                  name: stripAssetExtension(asset.name) || '新场景',
                  url: asset.url,
                  type: '用户上传',
                  description: '用户上传的背景场景，可在编辑器镜头卡里直接选择。',
                  usage: '可用于任意故事项目的场景背景。',
                  updatedAt: today(),
                })))
                setActiveTab('scenes')
              }}
              onRegisterCharacter={(asset) => {
                const characterId = slugifyAssetName(asset.name, 'character')
                setCharacters((prev) => upsertById(prev, stamp({
                  id: characterId,
                  name: stripAssetExtension(asset.name) || '新角色',
                  role: '用户角色',
                  description: '用户上传并登记的角色，可继续补充设定、小传和剧情冲突。',
                  biography: '',
                  outline: '',
                  usage: '对话节点、角色立绘、分支剧情',
                  conflicts: [],
                  color: '#8b5cf6',
                  defaultExpression: 'normal',
                  expressions: [{ id: 'normal', label: 'normal', url: asset.url }],
                  updatedAt: today(),
                })))
                setActiveTab('characters')
              }}
              onProcess={setProcessingAsset}
            />
          )}
        </section>
      </div>
    </main>
    {processingAsset && <AssetProcessingSheet asset={processingAsset} onClose={() => setProcessingAsset(null)} onAccepted={() => void getAssetLibrary().then(setAssets)} />}
  </>)
}

function CharacterEditor({ character, onChange, onSave, onCancel }: { character: LibraryCharacter; onChange: (character: LibraryCharacter) => void; onSave: () => void; onCancel: () => void }) {
  return (
    <EditorShell title="编辑角色" onSave={onSave} onCancel={onCancel}>
      <FormGrid>
        <TextField label="角色 ID" value={character.id} onChange={(value) => onChange({ ...character, id: value })} />
        <TextField label="名称" value={character.name} onChange={(value) => onChange({ ...character, name: value })} />
        <TextField label="定位" value={character.role} onChange={(value) => onChange({ ...character, role: value })} />
        <TextField label="颜色" value={character.color} onChange={(value) => onChange({ ...character, color: value })} />
      </FormGrid>
      <TextArea label="角色设定" value={character.description} onChange={(value) => onChange({ ...character, description: value })} />
      <TextArea label="人物小传" value={character.biography} onChange={(value) => onChange({ ...character, biography: value })} />
      <TextArea label="故事大纲" value={character.outline} onChange={(value) => onChange({ ...character, outline: value })} />
      <TextArea label="戏剧冲突（一行一个）" value={character.conflicts.join('\n')} onChange={(value) => onChange({ ...character, conflicts: value.split('\n').filter(Boolean) })} />
      <TextArea label="项目用途" value={character.usage} onChange={(value) => onChange({ ...character, usage: value })} />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">立绘状态</p>
          <button type="button" onClick={() => onChange({ ...character, expressions: [...character.expressions, { id: 'new', label: 'new', url: '/assets/characters/default-avatar.png' }] })} className="text-xs font-medium text-dream-700">添加立绘</button>
        </div>
        {character.expressions.map((expression, index) => (
          <div key={`${expression.id}-${index}`} className="grid gap-2 rounded-md border border-slate-200 p-2 md:grid-cols-[120px_140px_1fr_auto]">
            <input value={expression.id} onChange={(event) => updateExpression(character, onChange, index, { id: event.target.value })} className="rounded-md border border-slate-200 px-2 py-1 text-sm" />
            <input value={expression.label} onChange={(event) => updateExpression(character, onChange, index, { label: event.target.value })} className="rounded-md border border-slate-200 px-2 py-1 text-sm" />
            <input value={expression.url} onChange={(event) => updateExpression(character, onChange, index, { url: event.target.value })} className="rounded-md border border-slate-200 px-2 py-1 text-sm" />
            <button type="button" onClick={() => onChange({ ...character, expressions: character.expressions.filter((_, itemIndex) => itemIndex !== index) })} className="rounded-md p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </EditorShell>
  )
}

function SceneLibrary(props: { scenes: LibraryScene[]; editingScene: LibraryScene | null; onCreate: () => void; onEdit: (scene: LibraryScene) => void; onChange: (scene: LibraryScene) => void; onSave: () => void; onCancel: () => void; onDelete: (id: string) => void; onReset: () => void; onUse: (scene: LibraryScene, projectId: string) => void; initialProjectId?: string; onUploaded: (asset: Asset) => void }) {
  const { scenes, editingScene, onCreate, onEdit, onChange, onSave, onCancel, onDelete, onReset, onUse, initialProjectId } = props
  const [moodDraft, setMoodDraft] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  useEffect(() => { setMoodDraft(null); setUploadError('') }, [editingScene?.id])
  const latestScene = useRef(editingScene)
  latestScene.current = editingScene
  const replaceImage = async (file?: File) => {
    if (!file || !editingScene) return
    const id = editingScene.id
    setUploading(true); setUploadError('')
    try { const asset = await uploadAsset(file, 'BACKGROUND'); props.onUploaded(asset); if (latestScene.current?.id === id) onChange({ ...latestScene.current, url: asset.url }) }
    catch { setUploadError('背景图片上传失败，请检查图片后重试。') }
    finally { setUploading(false) }
  }
  return <SceneCatalog scenes={scenes} onCreate={onCreate} onEdit={onEdit} onDelete={onDelete} onReset={onReset} onUse={onUse} initialProjectId={initialProjectId} editor={editingScene && <EditorShell title="编辑背景" onSave={onSave} onCancel={onCancel} busy={uploading}>
    <div className="flex flex-wrap items-center gap-4"><img src={editingScene.url} alt="背景构图预览" className="h-24 w-40 rounded-lg object-cover" /><label className="dc-secondary cursor-pointer">{uploading ? '正在上传…' : '上传或替换背景图'}<input aria-label="上传背景图片" type="file" accept="image/*" disabled={uploading} className="hidden" onChange={(event) => { void replaceImage(event.target.files?.[0]); event.target.value = '' }} /></label></div>
    {uploadError && <p role="alert" className="text-sm text-rose-700">{uploadError}</p>}
    <FormGrid>
      <TextField label="背景名称" value={editingScene.name} onChange={(value) => onChange({ ...editingScene, name: value })} />
      <TextField label="场所分类" value={editingScene.place || editingScene.type} onChange={(value) => onChange({ ...editingScene, place: value, type: value })} />
      <TextField label="画面时间" value={editingScene.timeOfDay || ''} onChange={(value) => onChange({ ...editingScene, timeOfDay: value })} />
      <TextField label="氛围标签（逗号分隔）" value={moodDraft ?? editingScene.moods?.join('，') ?? ''} onChange={(value) => { setMoodDraft(value); onChange({ ...editingScene, moods: value.split(/[,，]/).map((item) => item.trim()).filter(Boolean) }) }} />
    </FormGrid>
    <TextArea label="画面说明" value={editingScene.description} onChange={(value) => onChange({ ...editingScene, description: value })} />
    <TextArea label="适合的剧情用途" value={editingScene.usage} onChange={(value) => onChange({ ...editingScene, usage: value })} />
    <details className="mt-4 rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-xs text-slate-500">高级素材信息</summary><div className="mt-3"><label className="block text-xs text-slate-500">素材标识（自动保存，保持故事引用稳定）<input readOnly value={editingScene.id} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3" /></label><TextField label="背景图片地址" value={editingScene.url} onChange={(value) => onChange({ ...editingScene, url: value })} /></div></details>
  </EditorShell>} />
}

function StoryLibrary(props: { templates: StoryTemplate[]; editingTemplate: StoryTemplate | null; onCreate: () => void; onEdit: (template: StoryTemplate) => void; onChange: (template: StoryTemplate) => void; onSave: () => void; onCancel: () => void; onDelete: (id: string) => void; onUseConflict: (title: string, content: string) => void }) {
  const { templates, editingTemplate, onCreate, onEdit, onChange, onSave, onCancel, onDelete, onUseConflict } = props
  return (
    <div>
      <ToolbarTitle title="剧情素材与冲突模板" desc="管理可复用桥段，也可以把短剧式冲突模板直接套入，再改写成自己的剧情。" createLabel="新增剧情素材" onCreate={onCreate} />
      {editingTemplate && (
        <EditorShell title="编辑剧情素材" onSave={onSave} onCancel={onCancel}>
          <TextField label="标题" value={editingTemplate.title} onChange={(value) => onChange({ ...editingTemplate, title: value })} />
          <TextField label="摘要" value={editingTemplate.summary} onChange={(value) => onChange({ ...editingTemplate, summary: value })} />
          <TextArea label="正文" value={editingTemplate.content} onChange={(value) => onChange({ ...editingTemplate, content: value })} rows={7} />
        </EditorShell>
      )}
      <div className="mb-6 grid gap-3 lg:grid-cols-2">
        {conflictTemplates.map((template) => (
          <article key={template.id} className="rounded-lg border border-rose-100 bg-rose-50/50 p-4">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-950">{template.title}</h3>
                <p className="text-xs text-rose-600">{template.type} · {template.useFor}</p>
              </div>
              <button onClick={() => onUseConflict(template.title, `钩子：${template.hook}\n\n结构：${template.structure}\n\n适用：${template.useFor}`)} className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white">套入</button>
            </div>
            <p className="text-sm leading-6 text-slate-700">{template.hook}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{template.structure}</p>
          </article>
        ))}
      </div>
      <div className="grid gap-3">
        {templates.map((template) => (
          <article key={template.id} className="rounded-lg border border-slate-200 p-4">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-950">{template.title}</h3>
                <p className="text-xs text-slate-500">更新于 {template.updatedAt}</p>
              </div>
              <RowActions onEdit={() => onEdit(template)} onDelete={() => onDelete(template.id)} />
            </div>
            <p className="mb-3 text-sm text-slate-600">{template.summary}</p>
            <p className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">{template.content}</p>
          </article>
        ))}
      </div>
    </div>
  )
}

function ProjectAssetLibrary(props: { user: unknown; assets: Asset[]; assetType: string; assetLoading: boolean; renamingId: string | null; renameValue: string; fileInputRef: React.RefObject<HTMLInputElement>; onAssetTypeChange: (type: string) => void; onUpload: (file: File | undefined) => void; onStartRename: (asset: Asset) => void; onRenameValueChange: (value: string) => void; onConfirmRename: (asset: Asset) => void; onCancelRename: () => void; onDelete: (asset: Asset) => void; onRegisterScene: (asset: Asset) => void; onRegisterCharacter: (asset: Asset) => void; onProcess: (asset: Asset) => void }) {
  const { user, assets, assetType, assetLoading, renamingId, renameValue, fileInputRef, onAssetTypeChange, onUpload, onStartRename, onRenameValueChange, onConfirmRename, onCancelRename, onDelete, onRegisterScene, onRegisterCharacter, onProcess } = props
  if (!user) {
    return (
      <div>
        <SectionTitle title="我的素材文件" desc="登录后上传的素材归属于你的账号，可在所有故事项目中复用。" />
        <Link to="/login" className="inline-flex rounded-lg bg-dream-600 px-4 py-2 text-sm font-medium text-white hover:bg-dream-700">登录后管理素材</Link>
      </div>
    )
  }
  return (
    <div>
      <SectionTitle title="我的素材文件" desc="上传一次即可在所有故事项目和章节中使用。可在这里重命名、处理或安全删除素材。" />
      <div className="mb-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto]">
        <select value={assetType} onChange={(event) => onAssetTypeChange(event.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="CG">插画与角色立绘</option>
          <option value="BACKGROUND">背景图</option>
          <option value="BGM">音乐</option>
          <option value="SFX">音效</option>
          <option value="VOICE">对白配音成品</option>
          <option value="VOICE_SAMPLE">声线参考录音</option>
          <option value="OTHER">其他文件</option>
        </select>
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-dream-600 px-4 py-2 text-sm font-medium text-white hover:bg-dream-700">
          {assetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          上传素材
          <input ref={fileInputRef} aria-label="上传素材文件" type="file" className="hidden" onChange={(event) => onUpload(event.target.files?.[0])} />
        </label>
      </div>
      <p className="mb-3 text-sm text-slate-500">账号素材库 · 所有故事项目均可读取</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {assets.map((asset) => (
          <article key={asset.id} className="overflow-hidden rounded-lg border border-slate-200">
            {AUDIO_ASSET_TYPES.includes(asset.type) ? (
              <div className="flex h-40 flex-col items-center justify-center gap-3 bg-slate-100 px-3 text-sm text-slate-500">
                <span>{assetTypeLabel(asset.type)}</span>
                <audio controls preload="metadata" className="max-w-full" src={asset.url}>你的浏览器不支持音频预览。</audio>
              </div>
            ) : <img src={asset.url} alt={asset.name} className="h-40 w-full object-contain bg-slate-100" />}
            <div className="p-3">
              {renamingId === asset.id ? (
                <div className="flex gap-2">
                  <input value={renameValue} onChange={(event) => onRenameValueChange(event.target.value)} className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm" />
                  <button onClick={() => onConfirmRename(asset)} className="rounded-md bg-dream-600 px-2 text-xs text-white">保存</button>
                  <button onClick={onCancelRename} className="rounded-md border border-slate-200 px-2 text-xs">取消</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-slate-900">{asset.name}</h3>
                      <p className="text-xs text-slate-500">{asset.type === 'VOICE_SAMPLE' ? '声线参考录音 · 用于克隆和音色设计' : `${assetTypeLabel(asset.type)} · ${new Date(asset.createdAt).toLocaleDateString()}`}</p>
                    </div>
                    <RowActions onEdit={() => onStartRename(asset)} onDelete={() => onDelete(asset)} />
                  </div>
                  {!AUDIO_ASSET_TYPES.includes(asset.type) && (
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => onProcess(asset)} className="inline-flex items-center gap-1 rounded-md bg-cyan-700 px-2 py-1 text-xs font-medium text-white hover:bg-cyan-800"><SlidersHorizontal className="h-3 w-3" />处理图片</button>
                      <button onClick={() => onRegisterCharacter(asset)} className="rounded-md border border-dream-200 bg-dream-50 px-2 py-1 text-xs font-medium text-dream-700 hover:bg-dream-100">
                        登记为角色
                      </button>
                      <button onClick={() => onRegisterScene(asset)} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                        登记为场景
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      {!assetLoading && assets.length === 0 && <EmptyState text="素材库还是空的，上传图片或音频后即可在任意故事中使用。" />}
    </div>
  )
}

function ToolbarTitle({ title, desc, createLabel, onCreate, onReset }: { title: string; desc: string; createLabel: string; onCreate: () => void; onReset?: () => void }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <SectionTitle title={title} desc={desc} />
      <div className="flex shrink-0 gap-2">
        {onReset && <button onClick={onReset} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><RotateCcw className="h-4 w-4" />恢复默认</button>}
        <button onClick={onCreate} className="inline-flex items-center gap-2 rounded-lg bg-dream-600 px-4 py-2 text-sm font-medium text-white hover:bg-dream-700"><Plus className="h-4 w-4" />{createLabel}</button>
      </div>
    </div>
  )
}

function EditorShell({ title, children, onSave, onCancel, busy = false }: { title: string; children: ReactNode; onSave: () => void; onCancel: () => void; busy?: boolean }) {
  return (
    <div className="mb-5 rounded-lg border border-dream-200 bg-dream-50/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-slate-950">{title}</h3>
        <div className="flex gap-2">
          <button onClick={onCancel} className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><X className="h-4 w-4" />取消</button>
          <button disabled={busy} onClick={onSave} className="inline-flex items-center gap-2 rounded-md bg-dream-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"><Save className="h-4 w-4" />保存</button>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <div className="flex shrink-0 gap-1"><button onClick={onEdit} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" title="编辑"><Edit3 className="h-4 w-4" /></button><button onClick={onDelete} className="rounded-md p-2 text-red-500 hover:bg-red-50" title="删除"><Trash2 className="h-4 w-4" /></button></div>
}

function SectionTitle({ title, desc }: { title: string; desc: string }) {
  return <div><h2 className="text-2xl font-bold text-slate-950">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{desc}</p></div>
}

function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" /></label>
}

function TextArea({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm leading-6" /></label>
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{text}</div>
}

function useStoredState<T>(key: string, fallback: T, loader?: () => T) {
  const [value, setValue] = useState<T>(() => {
    if (loader) return loader()
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  })
  useEffect(() => localStorage.setItem(key, JSON.stringify(value)), [key, value])
  return [value, setValue] as const
}

function upsertById<T extends { id: string }>(items: T[], next: T) {
  return items.some((item) => item.id === next.id) ? items.map((item) => (item.id === next.id ? next : item)) : [next, ...items]
}

function stamp<T extends { updatedAt: string }>(item: T): T {
  return { ...item, updatedAt: today() }
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function newCharacter(): LibraryCharacter {
  return { id: `character-${Date.now()}`, name: '', role: '', description: '', biography: '', outline: '', usage: '', conflicts: [], color: '#8b5cf6', defaultExpression: 'normal', expressions: [{ id: 'normal', label: 'normal', url: '/assets/characters/default-avatar.png' }], updatedAt: today() }
}

function newScene(): LibraryScene {
  return { id: `scene-${Date.now()}`, name: '', url: '/assets/backgrounds/bg-classroom.png', type: '', description: '', usage: '', updatedAt: today() }
}

function newTemplate(): StoryTemplate {
  return { id: `story-${Date.now()}`, title: '', summary: '', content: '', updatedAt: today() }
}

function stripAssetExtension(name: string) {
  return name.replace(/\.[^.]+$/, '').trim()
}

function slugifyAssetName(name: string, prefix: string) {
  const base = stripAssetExtension(name)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${prefix}-${base || Date.now()}`
}

function updateExpression(character: LibraryCharacter, onChange: (character: LibraryCharacter) => void, index: number, patch: Partial<LibraryCharacter['expressions'][number]>) {
  onChange({ ...character, expressions: character.expressions.map((expression, itemIndex) => (itemIndex === index ? { ...expression, ...patch } : expression)) })
}
