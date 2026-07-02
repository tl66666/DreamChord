# 梦弦 DreamChord

> 像写小说一样创作，像玩游戏一样阅读。

DreamChord 是一个运行在浏览器里的**视觉小说创作平台**。它用"章节 → 场景 → 镜头卡"的方式组织剧情：你可以像写分镜脚本一样编辑背景、角色、台词和选项，把一个故事搭成可以播放、保存和分享的视觉小说。

项目内置了一套官方演示世界观：雪、影、宫、空和系统幽灵会组成一段 Meta 引导短剧，用来展示背景切换、角色登场、表情变化、分支选择和节点叙事。

![DreamChord Hero](./apps/web/public/assets/hero.png)

---

## 为什么做这个项目

### 用户的痛点

视觉小说（Visual Novel）是一种以文字叙事为主、配合立绘、背景和音乐的互动故事形式。但现有的创作工具存在明显门槛：

| 痛点 | 具体表现 | DreamChord 的解决方式 |
|---|---|---|
| **节点图太难** | Ren'Py、TyranoBuilder 等工具需要学习脚本语言或复杂的节点连线，非技术用户望而却步 | 提供"镜头卡"写作界面，用户只需像写小说一样填背景、选角色、写台词，系统自动转换为节点图 |
| **没有可视化预览** | 传统脚本工具写完代码后要编译运行才能看到效果 | 编辑器右栏实时预览，每改一个字、换一个背景立刻看到播放效果 |
| **分支管理混乱** | 多线叙事的故事越写越长，分支去哪了、在哪汇合了全靠记忆 | 自动检测分支去向，流程图可视化所有场景和分支连线，汇合点用紫色高亮 |
| **素材管理割裂** | 写故事时要切换到文件管理器整理立绘和背景，打断创作流 | 内置素材库面板，直接在编辑器里选用背景和角色，支持上传自定义素材 |
| **AI 辅助缺失** | 写到瓶颈时只能自己硬想，没有工具帮助润色或续写 | 编辑器内置 AI 助手，支持润色、续写、生成选项、分支回应、生成剧情图 |
| **无法即时分享** | 写完的作品要打包、上传、配置服务器才能让别人玩 | 一键发布到作品广场，分享链接即可在浏览器中播放 |
| **长篇组织困难** | 几十个场景挤在一个画布里，找不到内容、改不动结构 | 章节 → 场景 → 镜头卡三级结构，每章独立画布，顶部标签切换 |

### 这个项目为谁而做

- **视觉小说爱好者**：想创作自己的 galgame / 视觉小说，但不会编程
- **轻小说 / 同人作者**：想把文字作品转化为可交互的视觉体验
- **二次元创作者**：有角色立绘和场景素材，需要一个平台把它们串联成故事
- **叙事设计学习者**：想研究分支叙事结构、非线性剧情组织方式

### 它解决了什么问题

DreamChord 的核心价值是**把节点图的复杂性隐藏在镜头卡背后**：

```
用户的写作方式：          系统自动转换的底层结构：

[场景 1-1 开场]           background → character → dialogue
  ├ 旁白：新场景开始       → background → subtitle
  ├ 雪：你好               → character → dialogue
  └ 选项：A雪 / B宫        → background → choice
                                        ├ choice-0 → [场景 1-2A]
                                        └ choice-1 → [场景 1-2B]
```

用户只需要写"谁说了什么"，系统负责把它变成播放器能执行的节点和连线。

---

## 技术栈

### 整体架构

```
┌─────────────────────────────────────────────┐
│                   浏览器                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  首页     │  │  编辑器   │  │  播放器   │  │
│  │  广场     │  │ FlowEditor│  │ Player   │  │
│  │  设置     │  │           │  │          │  │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  │
│        │             │             │        │
│        └─────────┬───┴─────────────┘        │
│                  │ axios (REST API)          │
└──────────────────┼──────────────────────────┘
                   │
┌──────────────────┼──────────────────────────┐
│            Express 后端                      │
│  ┌───────┬───────┬───────┬───────┬───────┐ │
│  │ auth  │project│chapter│ asset │  ai   │ │
│  └───┬───┴───┬───┴───┬───┴───┬───┴───┬───┘ │
│      │       │       │       │       │      │
│  ┌───┴───┐ ┌─┴───────┴───────┴───┐ ┌─┴───┐ │
│  │ JWT   │ │   Prisma + SQLite    │ │LLM  │ │
│  │认证   │ │   (项目/章节/用户)    │ │代理  │ │
│  └───────┘ └──────────────────────┘ └─────┘ │
└─────────────────────────────────────────────┘
```

### 前端技术栈

| 技术 | 版本 | 用途 |
|---|---|---|
| **React** | 18.3 | UI 框架，函数组件 + Hooks |
| **TypeScript** | 5.4 | 类型安全，strict 模式全开 |
| **Vite** | 5.2 | 构建工具 + 开发服务器，manualChunks 拆分 vendor |
| **Tailwind CSS** | 3.4 | 原子化 CSS，dream 色系自定义主题 |
| **@xyflow/react** | 12.0 | 节点图引擎，用于节点存储和转换（非主编辑界面） |
| **Zustand** | 4.5 | 全局状态管理，编辑器单一数据源 |
| **framer-motion** | 11.2 | 动画引擎，播放器场景切换、角色登场动画 |
| **react-router-dom** | 6.23 | 路由管理 |
| **axios** | 1.7 | HTTP 客户端，30s 超时 |
| **lucide-react** | 0.383 | 图标库 |

### 后端技术栈

| 技术 | 版本 | 用途 |
|---|---|---|
| **Express** | 4.19 | Web 框架，ESM 模式 |
| **Prisma** | 5.14 | ORM，SQLite 数据库 |
| **JWT** | 9.0 | 认证令牌，bcryptjs 加密 |
| **multer** | 1.4 | 文件上传，PNG/JPG/GIF/WebP |
| **zod** | 3.23 | 请求校验（已安装，待启用） |
| **express-validator** | 7.1 | 请求校验（已安装，待启用） |
| **tsx** | 4.11 | TypeScript 执行器，开发热重载 |

### AI 集成

DreamChord 支持 OpenAI 兼容接口的多种 LLM 供应商：

| 供应商 | 状态 | 说明 |
|---|---|---|
| 智谱 GLM | 已适配 | 国内推荐，延迟低 |
| DeepSeek | 已适配 | 性价比高 |
| Kimi (月之暗面) | 已适配 | 长上下文优势 |
| OpenAI | 兼容 | 需代理访问 |

AI 功能通过 `BaseOpenAICompatibleProvider` 基类统一接口，新增供应商只需继承并实现 `apiKey` 和 `baseUrl`。

### 工程化

- **Monorepo**：pnpm workspace 管理前后端
- **构建优化**：Vite manualChunks 拆分 4 个 vendor 包（react / flow / icon / util），独立缓存
- **类型安全**：全项目 strict TypeScript，禁止 `any`，使用 `unknown` + 类型收窄
- **用户反馈**：全局 `FeedbackProvider` 提供 Toast 通知和 Confirm 对话框，禁止原生 `alert`/`confirm`
- **节点数据访问**：`sceneGraph.ts` 提供 12+ 类型安全访问器函数，禁止 `as Record<string, unknown>` 断言

---

## 项目组成

| 目录 | 说明 |
|---|---|
| `apps/web` | React + Vite 前端，包含首页、作品广场、编辑器、播放器、设置页 |
| `apps/server` | Express + Prisma 后端，包含登录、项目保存、章节管理、发布、素材、AI 接口 |
| `apps/web/public/assets` | 前端静态素材：背景、角色、插画、封面、Logo |
| `source-assets/white-bg-originals` | 角色立绘白底原图母版，用于重新抠图或备份 |
| `source-assets/generated-transparent-sprites` | 已抠图的透明 PNG 立绘导出 |
| `CLAUDE.md` | AI 辅助开发指南，包含架构、规范、技术债务清单 |
| `README.md` | 本文件，项目总览 |
| `DEMO_STORY.md` | 官方演示剧情脚本和分镜说明 |
| `ASSETS.md` | 素材生成、命名、尺寸和提示词规范 |
| `CHARACTERS.md` | 角色设定、状态、台词风格和资源映射 |
| `SPRITE_ASSET_STANDARD.md` | 立绘交付规范，说明白底、透明 PNG、格子预览的区别 |
| `docs/AI_HANDOFF.md` | 给后续 AI / 开发者的接手说明，包含当前架构、验证清单和下一步迭代建议 |
| `docs/LONG_STORY_WORKFLOW.md` | 长篇创作与小说导入工作流 |
| `docs/scene-editor-design.md` | 场景编辑器设计说明 |
| `docs/dreamchord-architecture/dreamchord-architecture.html` | 项目架构交接文档（HTML 可视化） |

---

## 编辑器架构

### 三栏布局

编辑器采用三栏布局，所有面板在同一行内，不浮动叠加：

| 栏位 | 宽度 | 组件 | 功能 |
|---|---|---|---|
| 左栏 | w-56 | `SceneTree` | 章节/场景树，支持新增/删除/重命名章节和场景 |
| 中栏 | flex-1 | `ShotCardEditor` | 镜头卡列表，每张卡片可编辑背景、角色、台词、选项，内置 AI 按钮 |
| 右栏 | w-80 | `MiniPreview` / `AssetPanel` / `AIAssistantPanel` | 默认显示实时预览，点击工具栏按钮切换为素材库或 AI 助手 |

### 视图模式

- **场景编辑**（默认）：三栏布局，镜头卡写作
- **剧情流程图**：galgame 风格的全局流程图，按章节分行展示场景卡片和分支连线，支持缩放和拖拽

### 核心文件

| 文件 | 行数 | 职责 |
|---|---|---|
| `FlowEditor.tsx` | ~790 | 编辑器主壳：章节切换、保存/预览、三栏布局、状态管理 |
| `SceneTree.tsx` | - | 左栏：章节/场景树 |
| `ShotCardEditor.tsx` | ~965 | 中栏：镜头卡编辑，含卡片增删改、长文导入、快速续接 |
| `ShotCardItem.tsx` | - | 镜头卡展示组件，折叠/展开视图 |
| `CardEditor.tsx` | - | 镜头卡编辑表单，背景/角色/台词/选项 |
| `MiniPreview.tsx` | - | 右栏默认：实时预览 |
| `AssetPanel.tsx` | - | 右栏切换：素材库（内置 + 上传） |
| `AIAssistantPanel.tsx` | - | 右栏切换：AI 助手（关联当前卡片） |
| `StoryFlowchart.tsx` | - | 流程图视图，含汇合点可视化 |
| `sceneGraph.ts` | - | 场景/卡片/节点转换算法、类型安全访问器、章节编号 |

### 运行时引擎

播放器通过三步将编辑器数据转换为可播放的视觉小说：

```
编辑器节点图 (nodes + edges)
        ↓ converter.ts (DFS 遍历)
RuntimeStory (scenes 数组)
        ↓ runtime.ts (状态机)
播放器 (sceneIndex 推进 + choose 分支)
```

| 文件 | 职责 |
|---|---|
| `engine/types.ts` | RuntimeStory / RuntimeScene / WorldState 类型定义 |
| `engine/converter.ts` | 节点图 → RuntimeStory 转换器，DFS 遍历、角色追踪、分支解析 |
| `engine/runtime.ts` | 运行时状态机，支持 next() 推进、choose() 分支、事件触发 |
| `engine/characters.ts` | 角色注册表，立绘路径解析 |
| `engine/demo.ts` | 官方演示剧情的 RuntimeStory 数据 |
| `player/VisualNovelPlayer.tsx` | 视觉小说播放器，打字机效果、角色立绘、选项渲染 |

### 状态管理

编辑器使用 Zustand 作为**单一数据源**：

```
useEditorStore (Zustand)
  ├── nodes: Node[]      ← 所有编辑器节点
  ├── edges: Edge[]      ← 所有编辑器边
  ├── project: ProjectData
  ├── chapterId: string
  └── selectedNodeId: string | null

FlowEditor 直接读取 store.nodes / store.edges
所有更新通过 store.setNodes() / store.setEdges() 统一操作
```

> 设计决策：移除了早期 `useNodesState` / `useEdgesState` 的本地副本，消除双状态源竞态问题。

---

## 立绘规则

生成阶段使用白底：AI 生成角色时使用 `flat white studio background`，白底只为方便后续抠图。

项目使用阶段使用透明 PNG：放进 `apps/web/public/assets/characters/` 的角色立绘应当是已经抠掉白底的透明 PNG。

灰白格子不是背景，只是图片软件表示"透明"的预览方式。

> 详细规范参见 `SPRITE_ASSET_STANDARD.md` 和 `ASSETS.md`。

---

## 环境要求

- Node.js 20+
- npm 10+
- pnpm 9（可选，推荐）

## 安装依赖

```bash
cd C:\Users\唐乐\Desktop\实训2\项目
pnpm install
```

如果 pnpm 安装失败，可以分别进入前后端目录使用 npm：

```bash
cd C:\Users\唐乐\Desktop\实训2\项目\apps\web
npm install

cd C:\Users\唐乐\Desktop\实训2\项目\apps\server
npm install
```

## 配置后端环境

```bash
cd C:\Users\唐乐\Desktop\实训2\项目\apps\server
copy .env.example .env
```

`.env` 内容：

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="dreamchord-local-dev-secret"
PORT=3001
CORS_ORIGIN="http://localhost:5173"
UPLOAD_DIR="./uploads"
```

AI Key 是可选项，不影响基础测试。在设置页配置供应商 API Key 后启用 AI 功能。

## 初始化数据库

```bash
cd C:\Users\唐乐\Desktop\实训2\项目\apps\server
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

默认测试账号：`demo / demo123`

## 启动项目

### 一键启动（推荐）

双击 `start-dreamchord.bat`，自动完成：
- 检测端口冲突
- 同时启动前后端
- 自动打开浏览器

### 手动启动

前端：

```bash
cd C:\Users\唐乐\Desktop\实训2\项目\apps\web
npm run dev -- --host 127.0.0.1 --port 5173
```

后端：

```bash
cd C:\Users\唐乐\Desktop\实训2\项目\apps\server
npm run dev
```

---

## 编辑器功能

### 章节管理

- 顶部章节标签切换（第一章、第二章...，中文数字编号）
- 点击"新章节"创建新章节
- 每个章节标签旁有删除按钮（至少保留一章）
- 左栏场景树的章节标题旁也有重命名、新建场景、删除按钮

### 场景管理

- 左栏场景树按章节折叠显示
- 新建场景时自动携带前一场景的角色退场（hide 动作）
- 新场景背景默认为空，显示"请选择背景"占位符
- 支持场景重命名、删除

### 镜头卡编辑

每张镜头卡包含：
- 背景选择（下拉框，"请选择背景..."为默认空选项）
- 角色列表（可添加/删除角色，设置表情和站位）
- 镜头类型：角色对话、旁白、心理描写、回忆镜头、系统提示
- 发言人和台词
- 选项卡：选项列表与分支去向

**镜头类型说明**：

| 类型 | 用途 | 编译为节点 |
|---|---|---|
| dialogue | 角色对话 | dialogue 节点 |
| narration | 旁白文字 | subtitle 节点 |
| thought | 心理描写 | dialogue 节点（role 保持角色） |
| memory | 回忆镜头 | subtitle 节点 |
| system | 系统提示 | subtitle 节点（role=ghost） |
| choice | 选项分支 | choice 节点（带 choice-N 出边） |

**分支去向管理**：

- 选项无去向时，编辑器和折叠视图均显示琥珀色警告标识
- 可选择"跳转到已有场景"或"写这条分支"（自动创建新场景）
- 已设置去向的选项显示绿色目标场景标签，可断开或前往编辑
- 选项列表顶部显示汇总提示，告知用户有几个选项尚未设置去向

镜头卡内置 AI 按钮：
- 对话卡：AI 润色、AI 续写
- 选项卡：AI 生成选项、AI 分支回应

### 长文导入

点击"导入长文"按钮，粘贴小说正文：
- `角色：台词` 识别为角色对话
- 普通段落识别为旁白
- 包含"回忆、想起、曾经"等词标记为回忆镜头
- 包含"心想、心里、暗想"等词标记为心理描写
- 包含"系统、提示、警告"等词标记为系统提示
- 超长段落按中文标点拆成多张镜头卡

### 素材库

点击右上角"素材库"按钮，右栏切换为素材面板：
- 内置背景素材区（可直接点击选用）
- 内置角色素材区（显示角色立绘和表情数量）
- 项目上传素材区
- 点击关闭按钮回到实时预览

### AI 助手

点击右上角"AI助手"按钮，右栏切换为 AI 面板：
- 显示当前选中卡片信息
- 五种模式：润色当前、续写剧情、生成选项、分支回应、生成节点图
- 空文本时显示提示
- 未配置 AI 时使用本地规则生成基础内容

### 剧情流程图

切换到"剧情流程图"视图：
- 按章节分行排列场景卡片
- 普通连接用实线箭头
- 选项分支用虚线箭头并标注选项文本
- 汇合场景用紫色高亮标记
- 支持缩放（滚轮）和拖拽平移
- 点击场景卡片可跳转编辑
- 支持拖拽场景卡片调整位置
- 支持拖拽创建场景间连接

### 项目体检

`FlowEditor.tsx` 内置 `ProjectHealthPanel`，检查：
- 是否有节点
- 是否使用场景 / 镜头卡结构
- 无效连线
- 多起点
- 断开的选项出口
- 空文本
- 缺少背景
- 缺少角色
- 孤立节点
- 不可达场景
- 缺少结尾
- 是否发布

---

## 播放器功能

### 视觉效果

- 全屏背景图，framer-motion 场景切换动画（淡入缩放）
- 角色立绘分层渲染（左/中/右站位），带轻微投影和底部渐变遮罩
- 底部全宽文本框，打字机逐字效果
- 选项按钮底部弹出，点击触发分支跳转
- 系统事件 UI 标签浮动显示（SAVE REALITY / BRANCH CREATED 等）

### 播放器快捷键

| 按键 | 作用 |
|---|---|
| `Enter` / `Space` | 推进下一句 |
| `1` / `2` / `3` | 选择当前选项 |
| `H` | 打开或关闭历史 |
| `S` | 跳过 |
| `A` | 自动播放 |

### 音效系统

播放器内置 Web Audio API 音效（无需音频文件）：
- tap：推进下一句时的轻触音
- choice：选择选项时的清脆音
- scene：场景切换时的低沉音

音量可在设置中调节，支持静音。

---

## 构建检查

```bash
# 前端
cd C:\Users\唐乐\Desktop\实训2\项目\apps\web
npx tsc --noEmit
npm run build

# 后端
cd C:\Users\唐乐\Desktop\实训2\项目\apps\server
npx tsc --noEmit
```

## 测试清单

1. 打开 `http://localhost:5173`，检查首页
2. 打开 `http://localhost:5173/play/dreamchord-first-thread`，检查演示播放
3. 登录 `demo / demo123`
4. 打开编辑器，创建场景，编辑背景/角色/台词
5. 添加选项卡，为选项创建分支场景，验证跳转
6. 切换素材库和 AI 助手面板，确认无遮挡
7. 切换到剧情流程图视图
8. 创建/删除章节，确认中文数字编号
9. 保存并预览
10. 点击项目体检，检查报告

---

## 常见问题

### 前端打不开

确认 Vite 实际启动的端口，5173 被占用时会变成 5174 等。

### 登录失败

重新执行 `npx prisma db seed`，再用 `demo / demo123` 登录。

### 角色出现白底

运行目录里放进了白底图。白底母版只在 `source-assets/white-bg-originals`，运行图必须是透明 PNG。

### AI 功能不能用

基础项目不依赖 AI。需要在设置页配置供应商 API Key。

### 选项不出现 / 分支不跳转

检查选项卡是否有未设置去向的警告标识。每个选项需要通过"写这条分支"或"跳转到已有场景"设置目标场景。

### 新建场景后无法编辑背景/角色/台词

这通常是场景起始节点定位错误。系统通过"没有来自同场景入边的节点"来定位起始节点，确保使用 `findSceneStartNode()` 而非数组顺序查找。

---

## 开发建议

### 接手前先读

```text
CLAUDE.md          — AI 辅助开发指南（架构、规范、技术债务）
docs/AI_HANDOFF.md — 实践交接说明（当前状态、验证清单、迭代建议）
```

### 常见修改入口

| 需求 | 修改文件 |
|---|---|
| 修改演示剧情 | `apps/web/src/engine/demo.ts` |
| 修改角色资源映射 | `apps/web/src/engine/characters.ts` |
| 修改页面和编辑器功能 | `apps/web/src/pages/`、`apps/web/src/editor/` |
| 修改播放器 | `apps/web/src/player/VisualNovelPlayer.tsx` |
| 修改节点转换逻辑 | `apps/web/src/engine/converter.ts` |
| 修改运行时状态机 | `apps/web/src/engine/runtime.ts` |
| 修改场景/卡片算法 | `apps/web/src/editor/sceneGraph.ts` |
| 修改数据库结构 | `apps/server/prisma/schema.prisma` |
| 修改后端 API | `apps/server/src/routes/` |
| 修改 AI 供应商 | `apps/server/src/llm/providers.ts` |

### 代码规范要点

- TypeScript strict 模式，禁止 `any`（使用 `unknown` + 类型收窄）
- 节点数据访问必须使用 `sceneGraph.ts` 的类型安全访问器
- 用户反馈使用 `useToast()` / `useConfirm()`，禁止原生 `alert()` / `confirm()`
- JSON.parse 必须使用 `safeJsonParse<T>(str, fallback)` 包装
- 列表渲染 key 使用唯一 ID，禁止 `key={index}`
- 后端路由必须有 try-catch 或依赖全局错误中间件
- 文件上传仅允许 PNG/JPG/GIF/WebP
- JWT_SECRET 环境变量缺失时服务拒绝启动

---

## 许可证

MIT License
