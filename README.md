# 梦弦 DreamChord

> 项目展示页：双击项目根目录的 [`index.html`](index.html)，或直接打开唯一维护页 [`docs/showcase.html`](docs/showcase.html)。展示页先介绍完整产品，再重点拆解 DreamChord Agent 的能力、架构和技术实现。

面向视觉小说创作者的本地故事工作台。作者可以用章节、场景和镜头卡组织故事，管理角色立绘、背景与 CG，通过分支流程图检查剧情，并让创作 Agent 读取项目上下文、调用受限工具、提出可审核的修改。

[在线项目展示](https://tl66666.github.io/DreamChord/) | [新手入门](docs/GETTING_STARTED.md) | [项目概览](docs/PROJECT_OVERVIEW.md) | [完整文档](docs/README.md)

![DreamChord 故事编辑器](docs/screenshots/editor-stage-continuity-1440.png)

## 这个项目解决什么问题

普通文本编辑器适合写正文，却不擅长维护角色出场、背景切换、选择分支和素材引用；纯节点编辑器能表达结构，但长篇写作成本高。DreamChord 把两种工作方式合在一起：

```text
章节 -> 场景 -> 镜头卡 -> 分支检查 -> 完整预览 -> 发布
                   |
                   +-> Agent 理解项目、检查问题、提出修改
                   +-> 素材库提供立绘、背景、CG 和音频
```

作者主要在镜头卡里写作，节点图用于检查结构。新镜头会继承上一镜头的背景和在场角色；只有明确设置登场、更新或退场，舞台状态才会改变。分支独立计算状态，避免另一条路线的人物或背景串入当前剧情。

## 核心能力

- **故事工作台**：章节、场景、对话、旁白、心理、回忆、系统提示、选项、跳转和分支汇合。
- **舞台连续性**：继承背景和在场角色，显示登场、保持、更新、退场的最终结果。
- **可视化检查**：剧情流程图、断路与死路检测、实时场景预览和完整试玩。
- **创作 Agent**：多对话、章节可选绑定、分层记忆、项目上下文、工具调用、提案审核、应用与撤销。
- **全局素材库**：一次上传，可在同一账号的不同故事中复用；支持重命名、替换、引用检查和删除。
- **图片准备**：检查真实图片内容，保留原图，生成白底去除、透明裁边、立绘、CG 和背景候选。
- **可靠保存**：串行自动保存、版本冲突保护、50 步撤销与重做、项目备份与恢复。
- **本地优先**：故事、数据库和上传文件默认保存在本机；基础编辑不需要模型 API Key。

## Agent 为什么是项目特色

DreamChord Agent 不是悬浮在编辑器旁的通用聊天框。它知道当前项目、故事圣经、角色、素材、章节、场景、剧情健康状态和作者确认过的记忆。

![DreamChord 创作 Agent](docs/screenshots/agent-conversation-routing-1440.png)

Agent 根据任务选择三种执行方式：

| 方式 | 适用情况 | 是否修改数据 |
|---|---|---|
| 本地即时回答 | 问候、时间、能力说明、下一步建议 | 否 |
| 只读对话 | 创作讨论、项目分析、普通知识问题 | 否 |
| 受控行动 | 明确的剧情改写或素材处理 | 先生成提案，作者确认后才修改 |

没有选择章节时也可以正常聊天和讨论整部作品。需要把修改写入故事时，再绑定具体章节。即使外部模型返回格式异常，普通文字回答仍会保留；Agent 不会因为模型误发剧情补丁而把简单问题标记为任务失败。

[查看 Agent 使用指南](docs/AGENT_GUIDE.md) | [查看 Agent 架构与安全边界](docs/ARCHITECTURE.md#创作-agent)

## Windows 一键启动

准备环境：Windows 10/11、Node.js 20 或更高版本。首次运行需要联网安装锁定版本的依赖。

1. 下载或克隆完整仓库。
2. 双击根目录的 `start-dreamchord.bat`。
3. 等待前后端健康检查通过，浏览器会自动打开。
4. 使用演示账号登录：`demo / demo123`。

启动器支持中文、空格路径和重复双击。它会保留已有 `.env`、密钥和数据路径，在数据库结构同步前创建备份，并在 DreamChord 已运行时直接复用当前服务。

环境诊断：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\doctor.ps1
```

完整安装说明和常见故障处理见 [新手入门](docs/GETTING_STARTED.md)。

## 技术栈

| 层 | 技术 |
|---|---|
| Web | React 18、TypeScript、Vite、Zustand、React Flow |
| API | Node.js、Express、TypeScript、Zod |
| 数据 | Prisma、SQLite |
| 媒体 | Sharp |
| 测试 | Vitest、Testing Library、Supertest |
| 工作区 | pnpm workspace |

## 仓库结构

```text
apps/web                 前端、故事编辑器、Agent、素材库和播放器
apps/server              API、认证、Agent 服务、素材处理和 Prisma 数据层
packages/story-domain    前后端共享的剧情图、补丁和健康检查规则
scripts                  一键启动、环境诊断、数据备份和发布就绪检查
docs                     使用、产品、架构、维护文档与真实项目截图
source-assets            官方演示使用的源素材
```

## 适合不同读者的入口

| 你是谁 | 建议先看 |
|---|---|
| 第一次使用 | [新手入门](docs/GETTING_STARTED.md) |
| 想创作完整故事 | [创作者工作流](docs/CREATOR_WORKFLOW.md) |
| HR、老师或项目评审 | [项目概览](docs/PROJECT_OVERVIEW.md) |
| 开发者或接手维护者 | [系统架构](docs/ARCHITECTURE.md) |
| 想参与开发 | [贡献指南](CONTRIBUTING.md) |
| 准备发布新版本 | [发布指南](docs/RELEASE_GUIDE.md) |
| 查看版本变化 | [变更记录](CHANGELOG.md) |
| 不理解项目术语 | [术语表](docs/GLOSSARY.md) |

全部专题文档见 [文档中心](docs/README.md)。

## 开发与验证

所有命令都从仓库根目录执行：

```bash
corepack enable
corepack prepare pnpm@9.1.0 --activate
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
pnpm test:readiness
```

当前自动化测试覆盖剧情规则、分支舞台状态、保存冲突、Agent 路由与记忆隔离、工具调用、剧情补丁、图片处理、备份恢复和核心界面流程。高风险交互还需要使用真实浏览器检查桌面与移动布局、控制台错误和失败请求。

## 当前边界

- 无 API Key 时仍可使用项目检索、对话/记忆回顾、创作知识解释、公共知识只读查询和本地结构草案；开放式长文续写、润色和可应用剧情补丁需要外部模型。
- 白底或纯色背景适合本地规则抠图，复杂真实背景仍建议先用专业分割工具处理。
- 当前是本地单用户工作台，不包含多人实时协作、完整配音制作或 BGM 时间线。
- Agent 不能访问任意 shell、文件系统或数据库，所有写入都经过业务工具、校验和作者确认。

后续方向见 [项目路线图](docs/ROADMAP.md)。

## 许可证

[MIT](LICENSE)
