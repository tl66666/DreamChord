import { CHARACTER_REGISTRY, resolveCharacterUrl } from '../engine/characters'

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

export const defaultCharacters: LibraryCharacter[] = Object.values(CHARACTER_REGISTRY).map((character) => {
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
})

export const defaultScenes: LibraryScene[] = [
  {
    id: 'bg-classroom',
    name: '黄昏教室',
    url: '/assets/backgrounds/bg-classroom.png',
    type: '日常场景',
    description: '放学后的教室，适合安静对话、现实确认和日常铺垫。',
    usage: '背景节点、开场日常、宫的现实锚点剧情',
    updatedAt: '2026-06-30',
  },
  {
    id: 'bg-sakura',
    name: '樱花坡道',
    url: '/assets/backgrounds/bg-sakura.png',
    type: '主线场景',
    description: '雪第一次看见节点的地点，适合开场、相遇和分支显形。',
    usage: '序章、影登场、第一次选择',
    updatedAt: '2026-06-30',
  },
  {
    id: 'bg-cafe',
    name: '咖啡店',
    url: '/assets/backgrounds/bg-cafe.png',
    type: '关系场景',
    description: '暖色调的现实空间，适合角色整理信息和缓冲悬疑节奏。',
    usage: '宫线剧情、信息复盘、角色关系推进',
    updatedAt: '2026-06-30',
  },
  {
    id: 'bg-starry',
    name: '星空节点空间',
    url: '/assets/backgrounds/bg-starry.png',
    type: '系统场景',
    description: '非现实节点空间，适合系统提示、空的登场和核心选择。',
    usage: '系统剧情、空白节点、结尾分歧',
    updatedAt: '2026-06-30',
  },
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
  return normalizeList(CHARACTER_KEY, defaultCharacters, normalizeCharacter)
}

export function loadLibraryScenes(): LibraryScene[] {
  return normalizeList(SCENE_KEY, defaultScenes, normalizeScene)
}

export function loadStoryTemplates(): StoryTemplate[] {
  return normalizeList(STORY_TEMPLATE_KEY, defaultTemplates, (item) => item)
}

function normalizeList<T extends { id: string }>(key: string, fallback: T[], normalize: (item: T) => T): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as T[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.map(normalize) : fallback
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
  return {
    ...fallback,
    ...scene,
    id: scene.id || fallback?.id || scene.url,
    url: scene.url || fallback?.url || '/assets/backgrounds/bg-classroom.png',
  }
}
