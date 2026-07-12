# 参与 DreamChord 开发

感谢你准备改进 DreamChord。开始前先阅读 [项目概览](docs/PROJECT_OVERVIEW.md) 和 [系统架构](docs/ARCHITECTURE.md)，涉及故事编辑器或 Agent 时还应阅读根目录 [CLAUDE.md](CLAUDE.md) 中的工程约束。

## 开发环境

- Node.js 20 或更高版本。
- Corepack。
- pnpm 9.1.0，由根 `package.json` 固定。
- Windows 是一键启动的主要支持平台；日常前后端开发也可在兼容 Node.js 的环境中进行。

从仓库根目录执行：

```bash
corepack enable
corepack prepare pnpm@9.1.0 --activate
pnpm install --frozen-lockfile
pnpm --filter dreamchord-server prisma generate
pnpm dev
```

默认前端为 `http://localhost:5173`，API 为 `http://localhost:3001`，演示账号为 `demo / demo123`。

## 修改前先确认归属

| 修改内容 | 首选位置 |
|---|---|
| 剧情节点、边、补丁和健康规则 | `packages/story-domain` |
| 编辑器、Agent 界面、素材库和播放器 | `apps/web/src` |
| API、授权、Agent 服务和素材处理 | `apps/server/src` |
| 数据模型与演示数据 | `apps/server/prisma` |
| 启动、诊断和数据备份 | `scripts` 与根启动脚本 |
| 使用、架构和维护说明 | `docs` 与根治理文件 |

共享规则不要只写在前端。Agent、服务端和播放器应使用同一领域契约。

## 开发流程

1. 从最新 `main` 创建内容明确的分支。
2. 对行为修改先增加最小回归测试，确认测试会因缺少修复而失败。
3. 实现范围内的最小修改，不混入无关重构。
4. 先运行聚焦测试，再运行完整质量检查。
5. 涉及界面时在真实浏览器检查桌面和移动宽度。
6. 更新对应文档和 `CHANGELOG.md` 的“未发布”部分。
7. 提交前检查差异中没有密钥、数据库、上传文件和生成产物。

## 必须通过的检查

```bash
pnpm lint
pnpm test
pnpm build
pnpm test:readiness
git diff --check
```

只改文档时至少运行 `pnpm test:readiness` 和 `git diff --check`。修改启动器、数据库、构建或工作区配置时必须运行完整检查，并用一键启动器做一次冷启动和重复启动。

Windows 上如果 `prisma generate` 报 `EPERM ... query_engine-windows.dll.node`，说明运行中的 DreamChord 后端占用了 Prisma DLL。只停止属于当前项目的服务进程后再运行测试，不要删除数据库或重置仓库。

## 测试放在哪里

- 共享图规则：`packages/story-domain/src/*.test.ts`
- 服务与路由：`apps/server/src/**/*.test.ts`
- 前端逻辑和组件：`apps/web/src/**/*.test.ts(x)`
- 真实工作流：浏览器 QA 与 `docs/screenshots/` 中的真实截图

测试应验证用户可观察行为和模块契约，避免只断言内部实现细节。

## 提交与合并请求

提交信息使用简洁的 Conventional Commits 风格：

```text
feat: add branch merge diagnostics
fix: preserve stage state after character update
docs: add release workflow
test: cover conversation memory isolation
```

合并请求应说明：

- 解决的问题和用户影响；
- 主要实现选择；
- 运行过的验证命令；
- 界面变化的桌面和移动截图；
- 数据库、备份格式或 API 契约是否变化；
- 已知边界或后续工作。

不要把真实 API Key、`.env`、SQLite 数据库、`uploads/`、日志、`node_modules/`、`dist/` 或含用户信息的截图提交到 Git。

## 文档同步

- 功能用法变化：更新对应使用文档。
- 架构或边界变化：更新 `docs/ARCHITECTURE.md` 和必要的 `docs/AI_HANDOFF.md`。
- 新术语：更新 `docs/GLOSSARY.md`。
- 当前版本变化：更新 `CHANGELOG.md`。
- 未来想法：更新 `docs/ROADMAP.md`，不要写成已实现能力。
- 发布流程变化：更新 `docs/RELEASE_GUIDE.md`。

文档索引和维护规则见 [文档中心](docs/README.md)。
