# CLAUDE.md — DreamChord 项目指南

> 本文件供 AI 辅助开发参考，包含项目架构、开发规范和关键约束。

## 项目概述

**DreamChord（梦弦）** 是一个节点式视觉小说创作平台，支持可视化编辑器、剧情流程图、AI 辅助写作和实时预览播放。

## 技术栈

- **Monorepo**: pnpm workspace
- **前端**: React 18 + TypeScript + Vite 5 + Tailwind CSS 3
- **状态管理**: Zustand 4
- **节点图**: @xyflow/react 12
- **动画**: framer-motion 11
- **后端**: Express 4 + Prisma 5 (SQLite)
- **认证**: JWT + bcryptjs
- **AI**: 智谱GLM / DeepSeek / Kimi（OpenAI 兼容接口）

## 目录结构

```
项目/
├── apps/
│   ├── server/              # Express 后端
│   │   ├── src/
│   │   │   ├── index.ts     # 入口（环境校验 + CORS + 错误中间件 + graceful shutdown）
│   │   │   ├── routes/      # auth, projects, assets, storyBible, health, agent, ai(兼容)
│   │   │   ├── agent/       # 有界上下文、固定工具、执行器、队列、运行服务
│   │   │   ├── story/       # 补丁事务应用与撤销
│   │   │   ├── middleware/  # authenticateToken
│   │   │   ├── lib/         # prisma 单例
│   │   │   └── llm/         # LLM Provider 抽象
│   │   └── prisma/          # schema.prisma + seed.ts
│   └── web/                 # React 前端
│       └── src/
│           ├── editor/      # 编辑器核心（最大模块）
│           │   ├── FlowEditor.tsx       # 主容器
│           │   ├── WorkbenchPanel.tsx   # 38行标签壳
│           │   ├── workbench/           # 故事/角色/场景与纯图动作模块
│           │   ├── flowEditorUtils.ts   # 服务端节点转换 + 旧版兼容
│           │   ├── ProjectHealthPanel.tsx # 项目体检面板
│           │   ├── ShotCardEditor.tsx   # 镜头卡编辑主组件（965行）
│           │   ├── ShotCardItem.tsx     # 镜头卡展示组件
│           │   ├── CardEditor.tsx       # 镜头卡编辑表单
│           │   ├── manuscriptUtils.tsx  # 长文导入 + 模板工具
│           │   ├── StoryFlowchart.tsx   # 故事流程图
│           │   ├── sceneGraph.ts        # 场景图核心逻辑 + 类型安全访问器
│           │   ├── storyFlowchart/      # 流程图子模块
│           │   └── nodes/               # 节点组件
│           ├── engine/      # 运行时引擎
│           │   ├── types.ts             # RuntimeStory 类型
│           │   ├── converter.ts         # 节点图→RuntimeStory 转换
│           │   └── runtime.ts           # 状态机执行器
│           ├── player/      # 可视小说播放器
│           ├── stores/      # Zustand stores (auth, editor)
│           ├── api/         # axios 客户端
│           ├── lib/         # 工具函数 (safeJsonParse, aiConfig, libraryData)
│           ├── components/  # 通用组件 (ErrorBoundary, FeedbackProvider)
│           ├── agent/       # 共享 Agent 面板、轮询 Hook、时间线、差异与审批
│           └── pages/       # 路由页面
├── packages/story-domain/   # 共享故事图、体检、补丁 schema/应用/差异/校验
├── docs/                    # 文档
└── docker-compose.yml       # 生产部署编排
```

## 开发命令

```bash
# 安装依赖
pnpm install

# 开发（前后端同时启动）
pnpm dev

# 仅前端
cd apps/web && pnpm dev

# 仅后端
cd apps/server && pnpm dev

# 构建
cd apps/web && pnpm build    # tsc + vite build
cd apps/server && pnpm build # tsc

# 类型检查
cd apps/web && npx tsc --noEmit
cd apps/server && npx tsc --noEmit

# 数据库
cd apps/server && npx prisma migrate dev
cd apps/server && npx prisma db seed
```

## 关键约束

### 硬性规则
- 视觉小说角色立绘必须保持原始文件清晰度，不加滤镜
- 立绘生成必须采用"白底生成+后处理抠图"流程，禁止 transparent background 提示词
- 剧情文本框必须位于底部并铺满屏幕宽度
- 节点系统区分"演出控制"（background/character/dialogue/subtitle/transition/delay）和"流程控制"（choice/jump/condition/setVariable）
- Agent 模型响应必须通过严格结构化协议；任何图变更必须先成为 `StoryPatch` 并通过共享校验
- API Key 只能存在于浏览器配置和服务端队列内存，不得持久化或写日志
- 删除操作必须同时删除本地和云端数据
- 导航栏 logo 使用实心渐变 SVG

### 代码规范
- TypeScript strict 模式全开，禁止 `any` 类型（使用 `unknown` + 类型收窄）
- 列表渲染 key 使用唯一 ID，禁止 `key={index}`
- JSON.parse 必须使用 `safeJsonParse<T>(str, fallback)` 包装
- 节点数据访问必须使用 `sceneGraph.ts` 中的类型安全访问器（`getNodeData`, `getNodeSceneGroupId`, `getNodeText` 等），禁止 `node.data as Record<string, unknown>`
- 用户反馈使用 `useToast()` / `useConfirm()`（FeedbackProvider），禁止原生 `alert()` / `confirm()`
- 后端路由必须有 try-catch 或依赖全局错误中间件
- 文件上传仅允许 PNG/JPG/GIF/WebP
- JWT_SECRET 环境变量缺失时服务拒绝启动
- CORS 必须配置白名单
- API 客户端必须设置 timeout（当前 30s）
- 节点 ID 生成使用 `crypto.randomUUID()`

### 编辑器架构
- `sceneGraph.ts` 是场景图核心逻辑的唯一来源，同时导出类型安全访问器（getNodeData, getNodeSceneGroupId, getNodeSceneCode, getNodeText, getNodeCharacterId, getNodeBackgroundId, getNodeRole, getNodeExpression, getNodeChoices, getNodeFlowPosition, getNodeField）
- `flowEditorUtils.ts` 包含服务端数据转换（convertServerNodes/Edges）、旧版兼容逻辑和汇合场景检测
- `FeedbackProvider` 提供全局 Toast 通知和 Confirm 对话框（替代原生 alert/confirm）
- `storyFlowchart/` 子模块：types, constants, layout, connections, sceneInfo, bgUrl, usePanZoom, useKeyboardNav
- 流程图布局支持手动覆盖（positionOverrides）和自动布局混合
- 汇合场景（convergence）通过 `findConvergenceScenes` 检测，紫色可视化
- 镜头卡编辑器拆分为 ShotCardEditor（主组件）→ ShotCardItem（展示）→ CardEditor（编辑表单），manuscriptUtils 提供长文导入
- 构建优化：Vite manualChunks 拆分 react-vendor / flow-vendor / icon-vendor / util-vendor 独立缓存

### 创作 Agent
- 单 Agent 最多 8 步，只能调用固定工具，不允许模型直接访问数据库
- 结构补丁必须经过 `@dreamchord/story-domain` 校验、差异预览和用户批准
- 应用/撤销必须走 `patchService.ts` 的 Prisma 事务和章节版本检查
- 故事圣经是项目级最高优先级上下文；角色秘密只在选中范围引用该角色时加入上下文
- `/api/ai/*` 是弃用兼容面，新的项目感知能力只加到 Agent 路由

### 状态管理
- Zustand store（`useEditorStore`）是编辑器的**单一数据源**，直接读取 `store.nodes` / `store.edges`
- 所有更新通过 `store.setNodes()` / `store.setEdges()` 统一操作
- 异步函数中读取最新状态使用 `useEditorStore.getState()`
- 已移除 `useNodesState` / `useEdgesState` 本地副本，消除双状态源竞态

### 选项/分支系统
- 选项节点通过 `choiceEdge`（`sourceHandle: "choice-N"`）连接到分支场景
- `addCard` / `quickAppendDialogue` 在场景尾节点已有出边时，采用**插入模式**：断开旧出边 → 连接新节点 → 重新连接到原目标
- `converter.ts` 的 DFS 遍历跟随所有出边（含 choice 边），通过 `visited` Set 防止循环
- `choiceTargets` 类型为 `(string | undefined)[]`，未设置目标的选项返回 `undefined`
- `runtime.ts` 的 `choose()` 在目标无效时回退到下一场景，而非结束故事
- 选项无去向时，CardEditor 和 ShotCardItem 均显示琥珀色警告标识

## 已知技术债务

参见 [项目体检报告](../project-health-check/project-health-check.html) 获取完整列表。主要项：

- ~~FlowEditor (1030行) 和 ShotCardEditor (1806行) 需拆分~~ → 已拆分（FlowEditor 788行，ShotCardEditor 965行 + 3个独立文件）
- ~~`groupSceneNodesToCards` 在 3 处重复定义~~ → 已统一为 `groupNodesToCards`
- ~~`getBgUrl` 在 4 处重复定义~~ → 已统一为 `resolveBgUrl`
- ~~`normalizeChapterTitle` 在 3 处重复定义~~ → 已统一到 sceneGraph.ts
- ~~`catch(err: any)` 14 处~~ → 已全部改为 `catch(err: unknown)` + `getApiError` 辅助函数
- ~~`key={index}` 11 处~~ → 已全部改为唯一 ID
- ~~原生 `alert()` / `confirm()` 34 处~~ → 已全部替换为 FeedbackProvider
- ~~`as Record<string, unknown>` 30+ 处~~ → 已全部替换为类型安全访问器
- ~~Prisma schema 缺少外键索引~~ → 已添加所有外键 @@index
- ~~LLM Provider 代码重复~~ → 已提取 BaseOpenAICompatibleProvider 基类
- ~~双状态源竞态：useNodesState + useEditorStore 并行（尚未修复）~~ → 已修复，Zustand store 作为单一数据源，移除冗余的 useNodesState/useEdgesState
- ~~前端无测试框架~~ → 已引入 Vitest + Testing Library，覆盖 Agent、故事圣经、工作台和轮询状态
- Tailwind darkMode 配置但未实现切换
- Zod 已用于 Agent、故事圣经、章节保存和旧 AI 兼容接口；`express-validator` 仅保留旧路由兼容

## 环境变量

### 后端 (apps/server/.env)
```
DATABASE_URL="file:./dev.db"
JWT_SECRET="<至少16字符的随机密钥>"
PORT=3001
CORS_ORIGIN="http://localhost:5173"
UPLOAD_DIR="./uploads"
```

### 前端 (apps/web/.env.local)
```
VITE_API_BASE_URL=/api
```

## 依赖说明

- 已移除未使用依赖：gsap, clsx, tailwind-merge
- Zod 是新接口和结构化域数据的默认校验器
- Vite 构建使用 manualChunks 拆分 vendor 包（react-vendor, flow-vendor, icon-vendor, util-vendor）
- LLM Provider 通过 BaseOpenAICompatibleProvider 基类共享 chat 方法，消除重复代码
