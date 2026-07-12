interface CreativeKnowledgeEntry {
  terms: string[]
  title: string
  explanation: string
  application: string
}

const ENTRIES: CreativeKnowledgeEntry[] = [
  {
    terms: ['蒙太奇', 'montage'],
    title: '蒙太奇',
    explanation: '蒙太奇是把不同时间、地点或动作的短镜头并置，让观众从组合关系中理解时间流逝、因果、对比或情绪变化。它不是一种单独转场，而是一段镜头组织方法。',
    application: '在 DreamChord 中可以把训练、调查或旅程拆成数张短镜头卡：每张只保留一个画面和一句关键文字，统一音乐与节奏，最后用一个较长镜头落回当前场景。',
  },
  {
    terms: ['伏笔', '铺垫', 'foreshadow'],
    title: '伏笔',
    explanation: '伏笔是在前文放入当下合理、后文会获得新意义的信息。有效伏笔应当可见但不过度强调，并在回收时改变玩家对人物或事件的理解。',
    application: '可以在早期镜头卡放入重复道具、异常台词或背景细节，在故事圣经记录预期回收章节，再用剧情体检检查相关分支是否都能看到回收。',
  },
  {
    terms: ['悬念', '悬疑', 'suspense'],
    title: '悬念',
    explanation: '悬念来自玩家知道一个重要问题尚未解决，并担心答案或后果。它需要明确的问题、持续增加的代价，以及阶段性线索。',
    application: '每个场景至少推进“问题、线索、代价”中的一项。用分支提供不同线索，而不是让所有选项只改变一句无关台词。',
  },
  {
    terms: ['人物弧光', '角色弧光', '成长弧', 'character arc'],
    title: '人物弧光',
    explanation: '人物弧光是角色的信念、选择或关系在冲突中发生可追踪变化。变化通常由错误认知、压力测试、关键选择和结果组成。',
    application: '在角色资料中写清初始信念、害怕失去什么和最终选择。把关键变化放在不同章节，并让选项真的影响角色承担的代价。',
  },
  {
    terms: ['节奏', '叙事节奏', 'pacing'],
    title: '叙事节奏',
    explanation: '节奏是信息、冲突和情绪变化的密度。连续高压会让高潮失去差异，连续说明则会让玩家缺少推进感。',
    application: '在镜头卡中交替使用短对话、动作变化和较长停顿；重要选择前减少信息噪声，选择后用一个明确结果镜头回应玩家。',
  },
  {
    terms: ['冲突', '戏剧冲突', 'conflict'],
    title: '戏剧冲突',
    explanation: '冲突不是争吵本身，而是两个不能同时满足的目标、价值或需求。场景有冲突时，人物必须做出选择或付出代价。',
    application: '新建场景前写一句“谁想要什么，谁或什么阻止他”。如果场景结束时局面没有变化，可以压缩或与相邻场景合并。',
  },
  {
    terms: ['分支叙事', '分支剧情', 'branching narrative'],
    title: '分支叙事',
    explanation: '分支叙事让玩家选择改变信息、关系、资源或结局。好的分支不一定永久分开，但应该在汇合前产生可感知差异。',
    application: '先确定每个选项改变的状态，再创建目标场景。汇合时检查背景和在场人物，状态不一致就在汇合后的第一张卡显式重置。',
  },
  {
    terms: ['选项设计', '选择设计', 'choice design'],
    title: '选择设计',
    explanation: '有效选择让玩家理解选项意图，却不能完全预知代价。不同选项应表达立场、策略或风险，而不只是同义句。',
    application: '让选项分别代表调查、对抗、回避或信任等策略，并在后续一到三张镜头卡内给出第一次反馈。',
  },
  {
    terms: ['转场', '场景转换', 'transition'],
    title: '转场',
    explanation: '转场负责让玩家理解时间、地点或叙事视角发生变化。清晰转场优先保证信息连续，再考虑视觉效果。',
    application: '切换地点时在新场景第一张卡重设背景，并处理不应继续在场的人物；跨时间可以用旁白、画面淡出或重复意象建立联系。',
  },
  {
    terms: ['视角', '第一人称', '第三人称', 'pov'],
    title: '叙事视角',
    explanation: '叙事视角决定玩家能接触谁的感受和信息。稳定视角有助于悬念和角色代入，切换视角则需要明确标记。',
    application: '用章节或场景边界切换主要视角，并在故事圣经记录每条路线允许透露的信息，避免旁白提前泄露其他角色的秘密。',
  },
]

export function answerCreativeKnowledge(prompt: string): string | null {
  const normalized = prompt.trim().toLowerCase()
  const entry = ENTRIES.find((candidate) => candidate.terms.some((term) => normalized.includes(term.toLowerCase())))
  if (!entry) return null
  return `${entry.title}：${entry.explanation}\n\n在 DreamChord 中：${entry.application}`
}
