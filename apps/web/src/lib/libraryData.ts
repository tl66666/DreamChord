import { CHARACTER_REGISTRY, resolveCharacterUrl } from '../engine/characters'
import { SEVENTH_ROW_DEMO, CURTAIN_CALL_DEMO, PAINT_PROLOGUE } from '@dreamchord/story-domain'

export interface LibraryCharacter {
  id: string
  name: string
  role: string
  description: string
  biography: string
  outline: string
  usage: string
  conflicts: string[]
  color: string
  defaultExpression: string
  expressions: { id: string; label: string; url: string }[]
  updatedAt: string
}

export interface LibraryScene {
  id: string
  name: string
  url: string
  type: string
  description: string
  usage: string
  updatedAt: string
  place?: string
  timeOfDay?: string
  moods?: string[]
}

export interface StoryTemplate {
  id: string
  title: string
  summary: string
  content: string
  updatedAt: string
}

export interface ConflictTemplate {
  id: string
  title: string
  type: string
  hook: string
  structure: string
  useFor: string
}

export const CHARACTER_KEY = 'dreamchord_library_characters_v2'
export const SCENE_KEY = 'dreamchord_library_scenes_v2'
export const STORY_TEMPLATE_KEY = 'dreamchord_story_templates_v2'

const characterExtra: Record<string, Pick<LibraryCharacter, 'biography' | 'outline' | 'conflicts'>> = {
  yuki: {
    biography: '雪从小就会把人说过的话记成“台词”，把重要日子记成“章节”。她以为这只是自己的怪习惯，直到某天放学后，她第一次看见空气中漂浮的节点。',
    outline: '普通学生 -> 发现世界可编辑 -> 害怕自己伤害别人 -> 学会为每个选择承担后果。',
    conflicts: ['她想修复世界，却害怕修复意味着再次删除某个人。', '她相信影的痛苦，但宫代表的现实也正在崩塌。'],
  },
  ren: {
    biography: '影曾经是旧版本故事里的男主角。版本被覆盖后，他没有完全消失，而是被困在没人抵达的分支里，靠残留记忆维持存在。',
    outline: '复仇式守护 -> 逼雪看见真相 -> 承认自己也想被记住 -> 学会把选择权还给雪。',
    conflicts: ['他保护雪的方法像威胁，越想靠近越容易被误解。', '他恨“重写”，却必须请求雪重写他的结局。'],
  },
  miya: {
    biography: '宫是雪最稳定的日常。她看不见节点，却会在世界改写后留下奇怪的便签，像现实本身在通过她提醒雪。',
    outline: '旁观好友 -> 发现违和 -> 主动成为现实锚点 -> 在失去记忆和保护雪之间做选择。',
    conflicts: ['她不理解节点，却必须相信雪看见的东西。', '她越想维持日常，越会暴露日常已经不正常。'],
  },
  sora: {
    biography: '空不是被创造出来的完整角色，而是从空白节点里醒来的可能性。她越接触真实情感，身体和人格越稳定。',
    outline: '无名存在 -> 学习情绪 -> 渴望被写进主线 -> 证明自己不是错误数据。',
    conflicts: ['她想成为人，但系统把她判定为异常。', '她的诞生会让其他旧角色进一步消失。'],
  },
  ghost: {
    biography: '系统幽灵是 DreamChord 运行时留下的提示人格。它知道很多规则，却不能直接告诉创作者答案。',
    outline: '冷静提示 -> 暗中偏袒主角 -> 暴露系统限制 -> 成为最后的警告者。',
    conflicts: ['它必须维持系统稳定，却逐渐站到角色这一边。', '它说出的每条规则，都可能让角色更接近被删除。'],
  },
}

const cinemaCharacters: LibraryCharacter[] = SEVENTH_ROW_DEMO.characters.map(c => ({
  id: `seventh-${c.slug}`, name: c.name, role: '放映结束后的七秒 · 官方角色', description: c.description,
  biography: c.description, outline: '影院停业前夜重逢，重新听完那卷录音，并决定如何开始明天。',
  usage: '成年角色、现实题材、旧友重逢；配音库同名音色支持中日双语。',
  conflicts: [c.slug === 'chenyu' ? '擅长修复声音，却剪掉了自己不愿听见的话。' : c.slug === 'luyao' ? '替朋友保存原带多年，却始终没有说出自己要离开的计划。' : '朋友仍把她当作那个等待的人，她已经开始了自己的生活。'],
  color: c.color, defaultExpression: 'normal', expressions: ['normal', 'sad', 'smile'].map((id, i) => ({ id, label: ['平静', '难言', '释然'][i]!, url: `/assets/seventh-row/${c.slug}-${id}.png` })), updatedAt: '2026-10-29',
}))
const curtainCharacters: LibraryCharacter[] = CURTAIN_CALL_DEMO.characters.map(c => ({
  id: `curtain-${c.slug}`, name: c.name, role: '明日列车与未完的谢幕 · 官方角色', description: c.description, biography: c.description,
  outline: c.slug === 'zhi' ? '准备离校入职，在最后一次搭档主持前，问清两个人未来如何联系。' : c.slug === 'lin' ? '从客套祝福到说出自己的心意，为下一次见面作出具体行动。' : '负责晚会顺利谢幕，也给两位朋友留下一点说话的时间。',
  usage: '校园毕业、自然对话、分别与重逢；声音库同名音色可直接绑定。', conflicts: [c.slug === 'zhi' ? '想开始新生活，也不愿与熟悉的人渐渐失去联系。' : c.slug === 'lin' ? '习惯替对方考虑，却一直没有问过她的真实想法。' : '催场和关灯之外，朋友还有没来得及说完的话。'],
  color: c.color, defaultExpression: 'normal', expressions: ['normal', 'sad', 'smile'].map((id, i) => ({ id, label: ['平静', '难言', '微笑'][i]!, url: `/assets/curtain-call/${c.slug}-${id}.png` })), updatedAt: '2026-10-29',
}))
const paintCharacters: LibraryCharacter[] = PAINT_PROLOGUE.characters.map(c => ({
  id: `paint-${c.slug}`, name: c.name, role: '夏日来信与未完之画 · 官方角色', description: c.description, biography: c.description,
  outline: c.slug === 'cheng' ? '为排戏修好椅子，接受朋友留给自己的座位，然后发现修补被抹去。' : c.slug === 'xia' ? '完成一场小戏，邀请程见坐下，并约定夏天去海边。' : c.slug === 'ye' ? '为漏雨的礼堂排戏筹钱，认真听取朋友的临时改词。' : '受托整理与续作画稿，记录深色补笔与草图的差异。',
  usage: '原创文学幻想、朋友日常与小剧场；同名日语音色可试听并绑定角色。', conflicts: [c.slug === 'cheng' ? '总替别人解决问题，偶尔忘了问对方是否愿意。' : c.slug === 'xia' ? '希望自己的愿望被当作现在要做的事。' : c.slug === 'ye' ? '需要募款，也希望大家是真心喜欢他的戏。' : '草图的定稿与画面上的新痕迹并不一致。'],
  color: c.color, defaultExpression: 'normal', expressions: (c.slug === 'lu' ? ['normal'] : ['normal', 'smile', 'serious']).map(id => ({ id, label: ({ normal: '平静', smile: '微笑', serious: '认真' } as Record<string, string>)[id]!, url: `/assets/paint-prologue/${c.slug}-${id}.png` })), updatedAt: '2026-11-02',
}))
export const defaultCharacters: LibraryCharacter[] = [...paintCharacters, ...curtainCharacters, ...cinemaCharacters, ...Object.values(CHARACTER_REGISTRY).map((character) => {
  const extra = characterExtra[character.id]
  return {
    id: character.id,
    name: character.name,
    role: character.id === 'yuki' ? '主角' : character.id === 'ren' ? '关键角色' : character.id === 'miya' ? '现实锚点' : character.id === 'sora' ? '未初始化角色' : '系统角色',
    description:
      character.id === 'yuki'
        ? '能看见故事节点和分支连线的女高中生，是玩家理解 DreamChord 世界规则的入口。'
        : character.id === 'ren'
          ? '来自被删除版本世界的残影，知道旧世界的真相，也抗拒再次被重写。'
          : character.id === 'miya'
            ? '雪的好友，无法看见节点，却能记住世界被改写后的违和感。'
            : character.id === 'sora'
              ? '从空白节点中出现的角色，代表尚未被写完的可能性。'
              : '编辑器运行时的提示角色，用于提示节点、分支和素材状态。',
    biography: extra.biography,
    outline: extra.outline,
    usage: character.id === 'ghost' ? '系统提示、错误说明、教程引导' : '对话节点、角色立绘、分支剧情',
    conflicts: extra.conflicts,
    color: character.color,
    defaultExpression: character.defaultState,
    expressions: character.expressions.map((expression) => ({
      id: expression,
      label: expression,
      url: resolveCharacterUrl(character.id, expression),
    })),
    updatedAt: '2026-06-30',
  }
})]

export const defaultScenes: LibraryScene[] = [
  ...[
    { slug: 'home', name: '一张入场券 · 程见的居室', description: '门闩、冷茶、书架与下午的窗光。适合人物入场、收信和第一人称日常。', timeOfDay: '白天', moods: ['温暖', '日常'] },
    { slug: 'keepsake', name: '没写完的改编 · 书与票根', description: '旧散文诗、完整票根与铅笔痕的道具特写。适合阅读、回忆与创作停顿。', timeOfDay: '白天', moods: ['细节', '静谧'] },
    { slug: 'theatre-sea', name: '半幅海 · 小剧场', description: '家常戏的假窗、只画一半的海景布、八把观众椅与暖灯。适合舞台演出与散场后重演。', timeOfDay: '黄昏', moods: ['温暖', '演出'] },
  ].map(s => ({ ...s, id: `paint-${s.slug}`, url: `/assets/paint-prologue/${s.slug}.webp`, type: '文学幻想', place: '室内', usage: '原创《夏日来信与未完之画》序章叙事场景，与入场券、改编稿和未完海景对应。', updatedAt: '2026-11-03' })),
  ...[
    { slug: 'workshop', name: '春日下午 · 道具工房', description: '旧礼堂侧边的木工桌、茶杯与打开的窗。适合修理道具、排练与朋友拌嘴。', timeOfDay: '白天', moods: ['温暖', '日常'] },
    { slug: 'theatre', name: '八位观众 · 小剧场', description: '低矮舞台、几排木椅与暖灯。适合小规模演出、排戏与散场谈心。', timeOfDay: '黄昏', moods: ['温暖', '演出'] },
    { slug: 'night', name: '灯还亮着 · 深夜工房', description: '同一间工房入夜后的灯与蓝色窗光。适合散场道别与安静伏笔。', timeOfDay: '夜晚', moods: ['静谧', '悬疑'] },
    { slug: 'chair-repaired', name: '深色补木 · 椅子特写', description: '左后腿接上深色木料，地面留着木屑。剧情道具特写，与缺失版成对使用。', timeOfDay: '夜晚', moods: ['细节', '温暖'] },
    { slug: 'chair-erased', name: '消失的修补 · 椅子特写', description: '同机位的椅子，补木消失，旧断口露出。适合对照演出与局部异常。', timeOfDay: '夜晚', moods: ['细节', '悬疑'] },
    { slug: 'outside', name: '画布之外 · 续作工作室', description: '画架、未完的画、录音笔与台灯。适合画外视角和工作记录。', timeOfDay: '夜晚', moods: ['静谧', '悬疑'] },
  ].map(s => ({ ...s, id: `paint-${s.slug}`, url: `/assets/paint-prologue/${s.slug}.webp`, type: '文学幻想', place: '室内', usage: '原创《夏日来信与未完之画》序章；同一美术世界的场景与线索特写。', updatedAt: '2026-11-02' })),
  ...[
    { slug: 'backstage', name: '毕业晚会 · 幕后', place: '室内', timeOfDay: '黄昏', moods: ['日常', '告别'], description: '两支话筒、修改过的稿纸和敞开的侧门。适合上台前的拌嘴、排练与谈心。' },
    { slug: 'stage', name: '散场以后 · 礼堂', place: '室内', timeOfDay: '夜晚', moods: ['静谧', '余韵'], description: '灯光未熄的空礼堂，台下已无人。适合收拾舞台、说出心意和约定。' },
    { slug: 'campus', name: '夏夜校园 · 岔路', place: '校园', timeOfDay: '夜晚', moods: ['浪漫', '温暖'], description: '礼堂外的夏夜小路、长椅与自行车。适合散场同行和下一次见面的约定。' },
    { slug: 'station', name: '清晨六点 · 站台', place: '车站', timeOfDay: '清晨', moods: ['告别', '希望'], description: '晨光照进车窗，列车即将出发。适合送行、坦白与留下余韵的结尾。' },
  ].map(s => ({ ...s, id: `curtain-${s.slug}`, url: `/assets/curtain-call/${s.slug}.webp`, type: '现实', usage: '原创短篇《明日列车与未完的谢幕》；也可用于自己的校园与现实题材故事。', updatedAt: '2026-10-29' })),
  {
    id: 'bg-classroom',
    name: '黄昏教室',
    url: '/assets/backgrounds/bg-classroom.png',
    type: '校园', place: '校园', timeOfDay: '黄昏', moods: ['温暖', '日常'],
    description: '放学后的教室，适合安静对话、现实确认和日常铺垫。',
    usage: '放学后闲谈、社团活动、安静的独白或人物对质',
    updatedAt: '2026-06-30',
  },
  {
    id: 'bg-sakura',
    name: '樱花坡道',
    url: '/assets/backgrounds/bg-sakura.png',
    type: '街道', place: '街道', timeOfDay: '白天', moods: ['浪漫', '轻快'],
    description: '春日樱花盛开的坡道与街巷，适合轻快的相遇、同行和约定。',
    usage: '初次相遇、放学同行、春日约定与告白',
    updatedAt: '2026-06-30',
  },
  {
    id: 'bg-cafe',
    name: '雨夜咖啡馆',
    url: '/assets/backgrounds/bg-cafe.png',
    type: '室内', place: '室内', timeOfDay: '夜晚', moods: ['温暖', '静谧'],
    description: '暖色调的现实空间，适合角色整理信息和缓冲悬疑节奏。',
    usage: '雨夜谈心、整理线索、秘密揭示后的缓冲',
    updatedAt: '2026-06-30',
  },
  {
    id: 'bg-starry',
    name: '星海回廊',
    url: '/assets/backgrounds/bg-starry.png',
    type: '幻想', place: '幻想', timeOfDay: '夜晚', moods: ['神秘', '静谧'],
    description: '星光交织的幻想空间，适合梦境、秘密揭示与内心抉择。',
    usage: '梦境相遇、内心世界、重要选择与结局余韵',
    updatedAt: '2026-06-30',
  },
  ...[
    { slug: 'cinema-rain', name: '白帆影院 · 雨夜门廊', description: '海边旧影院的最后一个营业夜，暖灯照着被雨打湿的街道。', place: '街道', moods: ['重逢', '静谧'] },
    { slug: 'projection-room', name: '白帆影院 · 放映室', description: '旧放映机、磁带与暖台灯，适合两三人的近距离谈话。', place: '室内', moods: ['回忆', '悬念'] },
    { slug: 'auditorium', name: '白帆影院 · 第七排', description: '空银幕与深青座椅，最后一场放映开始前的观众席。', place: '室内', moods: ['告别', '释然'] },
  ].map(s => ({ id: `seventh-${s.slug}`, name: s.name, description: s.description, url: `/assets/seventh-row/${s.slug}.webp`, type: '现实', place: s.place, timeOfDay: '夜晚', moods: s.moods, usage: '原创短篇《放映结束后的七秒》；重逢、录音揭晓、告别与片尾。', updatedAt: '2026-10-29' })),
]

export const defaultTemplates: StoryTemplate[] = [
  {
    id: 'opening-thread',
    title: '第一条故事线：雪看见节点',
    summary: '开场模板，用来说明世界规则并引出雪、影、宫。',
    content: '放学后的樱花坡道上，雪听见一句本不该出现的台词。她抬头时，看见空气里浮着发光节点，每条连线都通往不同的下一秒。影站在道路尽头，像认识她很久一样说：“不是你认识的人，是你还没删掉的人。”',
    updatedAt: '2026-06-30',
  },
  {
    id: 'branch-conflict',
    title: '三分支冲突：相信影、询问宫、触碰空',
    summary: '适合短剧式强钩子，每个选择都必须进入不同后续。',
    content: '选项 A：相信影，进入旧版本街道，揭开被删除世界的残留。\n选项 B：询问宫，回到咖啡店确认现实是否被改写。\n选项 C：触碰空白节点，让空提前进入主线并触发系统警告。',
    updatedAt: '2026-06-30',
  },
]

export const conflictTemplates: ConflictTemplate[] = [
  {
    id: 'secret-return',
    title: '消失的人回来了',
    type: '悬疑反转',
    hook: '一个所有人都说不存在的人，准确叫出了主角小时候的秘密。',
    structure: '登场反常 -> 主角否认 -> 对方拿出无法解释的证据 -> 选择相信或报警/逃离。',
    useFor: '影登场、旧版本世界、被删除角色复活。',
  },
  {
    id: 'double-bind',
    title: '救一个人会伤另一个人',
    type: '两难选择',
    hook: '系统提示：保留空，就会覆盖宫关于雪的全部记忆。',
    structure: '提出代价 -> 角色各自表态 -> 主角短暂逃避 -> 倒计时逼迫选择。',
    useFor: '核心分支、结尾选择、角色弧光转折。',
  },
  {
    id: 'fake-daily',
    title: '越日常越不对劲',
    type: '日常惊悚',
    hook: '第二天所有人都正常上课，只有黑板上写着昨晚没说出口的台词。',
    structure: '平静开场 -> 一个细节错位 -> 更多证据堆叠 -> 日常场景崩裂。',
    useFor: '宫线、教室场景、现实锚点剧情。',
  },
  {
    id: 'short-drama-slap',
    title: '当众误解与反打',
    type: '短剧强冲突',
    hook: '雪被指责“为了吸引注意编造节点”，下一秒所有人的手机同时收到系统旁白。',
    structure: '公开羞辱 -> 主角沉默 -> 证据爆出 -> 对方立场反转或更极端。',
    useFor: '中段提速、校园群像、让规则公开化。',
  },
  {
    id: 'identity-price',
    title: '身份交换的代价',
    type: '身份悬念',
    hook: '空获得名字的那一刻，雪的学生证照片变成了空。',
    structure: '愿望实现 -> 异常代价 -> 身份被替换 -> 追查谁写下了这条规则。',
    useFor: '空线、系统空间、后期反转。',
  },
]

export function loadLibraryCharacters(): LibraryCharacter[] {
  return addBuiltinOnce(CHARACTER_KEY, addBuiltinOnce(CHARACTER_KEY, addBuiltinOnce(CHARACTER_KEY, normalizeList(CHARACTER_KEY, defaultCharacters, normalizeCharacter), cinemaCharacters, 'seventh-row'), curtainCharacters, 'curtain-call'), paintCharacters, 'paint-prologue')
}

export function loadLibraryScenes(): LibraryScene[] {
  const installed = addBuiltinOnce(SCENE_KEY, addBuiltinOnce(SCENE_KEY, addBuiltinOnce(SCENE_KEY, normalizeList(SCENE_KEY, defaultScenes, normalizeScene), defaultScenes.filter(s => s.id.startsWith('seventh-')), 'seventh-row'), defaultScenes.filter(s => s.id.startsWith('curtain-')), 'curtain-call'), defaultScenes.filter(s => s.id.startsWith('paint-')), 'paint-prologue')
  return addBuiltinOnce(SCENE_KEY, installed, defaultScenes.filter(s => ['paint-home', 'paint-keepsake', 'paint-theatre-sea'].includes(s.id)), 'paint-prose')
}

function addBuiltinOnce<T extends { id: string }>(key: string, items: T[], additions: T[], pack: string): T[] {
  const marker = `${key}:${pack}-installed`
  try {
    if (localStorage.getItem(marker)) return items
    if (localStorage.getItem(key) && items.length === 0) { localStorage.setItem(marker, '1'); return items }
    const result = [...additions.filter(a => !items.some(item => item.id === a.id)), ...items]
    localStorage.setItem(key, JSON.stringify(result))
    localStorage.setItem(marker, '1')
    return result
  } catch { return items }
}

export function loadStoryTemplates(): StoryTemplate[] {
  return normalizeList(STORY_TEMPLATE_KEY, defaultTemplates, (item) => item)
}

function normalizeList<T extends { id: string }>(key: string, fallback: T[], normalize: (item: T) => T): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as T[]
    return Array.isArray(parsed) ? parsed.map(normalize) : fallback
  } catch {
    return fallback
  }
}

function normalizeCharacter(character: LibraryCharacter): LibraryCharacter {
  const fallback = defaultCharacters.find((item) => item.id === character.id)
  return {
    ...fallback,
    ...character,
    biography: character.biography || fallback?.biography || '',
    outline: character.outline || fallback?.outline || '',
    conflicts: Array.isArray(character.conflicts) ? character.conflicts : fallback?.conflicts || [],
    expressions: Array.isArray(character.expressions) && character.expressions.length > 0 ? character.expressions : fallback?.expressions || [],
  }
}

function normalizeScene(scene: LibraryScene): LibraryScene {
  const fallback = defaultScenes.find((item) => item.id === scene.id)
  const oldNames: Record<string, string> = { 'bg-cafe': '咖啡店', 'bg-starry': '星空节点空间' }
  const oldTypes = ['日常场景', '主线场景', '关系场景', '系统场景']
  const oldUsages = ['背景节点、开场日常、宫的现实锚点剧情', '序章、影登场、第一次选择', '宫线剧情、信息复盘、角色关系推进', '系统剧情、空白节点、结尾分歧']
  const oldDescriptions = ['雪第一次看见节点的地点，适合开场、相遇和分支显形。', '非现实节点空间，适合系统提示、空的登场和核心选择。']
  return {
    ...fallback,
    ...scene,
    ...(fallback && scene.url === fallback.url ? { name: scene.name === oldNames[scene.id] ? fallback.name : scene.name, type: oldTypes.includes(scene.type) ? fallback.type : scene.type, usage: oldUsages.includes(scene.usage) ? fallback.usage : scene.usage, description: oldDescriptions.includes(scene.description) ? fallback.description : scene.description } : {}),
    id: scene.id || fallback?.id || scene.url,
    url: scene.url || fallback?.url || '/assets/backgrounds/bg-classroom.png',
  }
}
