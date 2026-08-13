# DreamChord 维护与迭代手册

这份文档给第一次接手 DreamChord 的开发者使用。目标是让你在不破坏用户故事、素材和 Agent 审批链路的前提下，完成一次可验证的迭代。

## 先确认当前状态

从仓库根目录执行：

```bash
git status -sb
git log --oneline -5
git ls-remote origin refs/heads/main
pnpm test:readiness
```

本地 `HEAD` 与 `origin/main` 显示同一提交时，代码已经上传。GitHub Actions 页面会保留历史失败记录，判断当前版本时应只看最新提交对应的运行：CI 与 `pages-build-deployment` 都为绿色才表示当前提交通过。

本轮 CI 修复提交 `d4f17ca` 后，工作流采用以下固定流程：

- CI：构建共享剧情包、生成 Prisma Client、在隔离 SQLite 数据库执行迁移和演示数据种子、运行 lint、测试与构建。
- GitHub Pages：部署项目展示页面；它和应用后端不是同一个服务。

## 首次运行与验收

普通 Windows 用户双击根目录 `start-dreamchord.bat`。开发者可使用：

```powershell
powershell -ExecutionPolicy Bypass -File .\start-dreamchord.ps1 -NoBrowser
```

启动后使用 `demo / demo123` 登录，并按下面的最小闭环验收：

1. 打开官方演示，进入故事编辑器，确认场景与镜头卡可编辑并自动保存。
2. 新建一个场景，设置背景、角色、台词和选项，打开完整预览确认可播放。
3. 在素材库上传一张图片，接受候选素材后将其绑定为角色表情或场景背景，再次预览。
4. 在 Agent 中先进行不绑定章节的项目对话；再绑定章节生成提案，检查预览、应用和撤销。
5. 上传或选择 BGM、SFX 和 VOICE 素材，在一个镜头卡完成三种音频绑定后预览，检查通道音量和重开播放器后的清理行为。

不要删除 `.env`、`apps/server/prisma/dev.db`、`apps/server/uploads` 来处理启动问题。先运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\doctor.ps1
```

## 修改时的边界

| 需求 | 首选位置 | 必须保持的约束 |
|---|---|---|
| 剧情图、补丁与健康规则 | `packages/story-domain` | 前端、服务端、Agent 与播放器使用同一规则 |
| 工作台和播放器 | `apps/web/src/editor`、`apps/web/src/player` | 任意项目与用户素材可用，不能只服务官方示例 |
| API、授权与 Agent | `apps/server/src` | 所有写入经授权、校验、提案和审批 |
| 素材处理 | `apps/server/src/assets` | 保留原图，衍生图先进入候选状态 |
| 数据结构 | `apps/server/prisma` | 新迁移必须可从空库执行，不能依赖本机 `dev.db` |
| 启动与运维 | `start-dreamchord.*`、`scripts` | 不覆盖用户配置、数据库或上传素材 |

## Agent 迭代规则

Agent 可以读取项目、章节、角色、素材、故事圣经、记忆和剧情健康报告，但不具备任意 Shell、SQL、文件系统或 HTTP 写入权限。

新增 Agent 能力时，至少同时完成：

1. 在 `apps/server/src/agent` 定义意图路由、输入/输出 Zod Schema 和受限工具。
2. 写入工具授权与资源范围校验，不能跨用户或跨项目读取数据。
3. 对故事修改生成 `StoryPatch`，经过 `@dreamchord/story-domain` 校验、预览与作者确认。
4. 为无 API Key 情况提供明确的本地回答或降级说明，不能只报“任务失败”。
5. 添加回归测试，覆盖成功、拒绝/撤销和错误降级。

## 提交前检查

行为、数据库、启动器、Agent 或播放链路变更必须执行：

```bash
pnpm lint
pnpm test
pnpm -r build
pnpm test:readiness
git diff --check
```

随后检查暂存范围：

```bash
git status --short
git diff --cached --stat
```

绝不能提交 `.env`、`*.db`、`apps/server/uploads`、日志、`node_modules` 或构建产物。提交后推送并打开 Actions，确认最新提交的 CI 成功；若失败，读取该次运行的失败日志，不要根据历史红叉猜测原因。

## 文档更新规则

- 面向用户的功能：更新 `README.md` 和对应使用指南。
- 面向创作者的工作流：更新 `docs/CREATOR_WORKFLOW.md` 或 `docs/AGENT_GUIDE.md`。
- 架构、数据流、安全边界：更新 `docs/ARCHITECTURE.md` 或 `docs/AI_HANDOFF.md`。
- 已完成变化：更新 `CHANGELOG.md`；未来想法只更新 `docs/ROADMAP.md`。
- 每次较大迭代：更新 `docs/CURRENT_HANDOFF.md`，说明完成内容、验证结果、已知边界和下一步。

真实界面截图放在 `docs/screenshots/`，仅使用可运行的桌面界面截图，不使用概念图代替实际功能。
