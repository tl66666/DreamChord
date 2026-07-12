# DreamChord 发布指南

这份清单用于发布新版本。所有命令从仓库根目录执行，发布者需要具备仓库写入和 GitHub Release 权限。

## 1. 确定版本范围

发布前先确认本次只包含已经完成、测试和文档化的功能。未完成内容留在 `docs/ROADMAP.md`，不要写入当前能力。

版本号建议：

- PATCH：兼容的缺陷修复，例如 `0.2.0 -> 0.2.1`。
- MINOR：兼容的新能力，例如 `0.2.0 -> 0.3.0`。
- MAJOR：破坏性数据、API 或备份格式变化。

## 2. 同步版本与变更记录

同步以下包的 `version`：

- `package.json`
- `apps/web/package.json`
- `apps/server/package.json`
- `packages/story-domain/package.json`

把 `CHANGELOG.md` 的“未发布”内容移动到新版本标题下，并填写发布日期。检查比较链接和 Release 链接。

更新涉及版本事实的文档，至少检查：

- `README.md`
- `docs/PROJECT_OVERVIEW.md`
- `docs/ARCHITECTURE.md`
- `docs/AI_HANDOFF.md`
- `SECURITY.md`

## 3. 检查数据兼容性

如果 Prisma schema、种子数据或备份格式变化：

1. 使用现有非空 SQLite 数据库创建备份。
2. 从旧版本运行一键启动升级。
3. 确认旧项目、章节、角色、素材、记忆和对话仍可读取。
4. 导出项目并重新导入，确认 ID 与素材引用重映射。
5. 记录不兼容变化和用户操作，不使用静默数据丢失方案。

数据库同步前可手动运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-local-database.ps1 -EnvPath .\apps\server\.env -SchemaPath .\apps\server\prisma\schema.prisma
```

## 4. 运行自动化质量门

先关闭正在占用当前项目 Prisma DLL 的旧后端，再执行：

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
pnpm test:readiness
git diff --check
```

任何一步失败都停止发布。不要只根据局部测试推断完整构建可用。

## 5. 执行真实浏览器验收

至少检查：

- 登录、项目列表、新建和删除测试项目；
- 编辑器加载、添加镜头、舞台继承、撤销、重做、自动保存和刷新持久化；
- 分支流程图、剧情健康和完整预览；
- Agent 新建/重命名/置顶/删除对话，普通问答，章节绑定，提案应用与撤销；
- 记忆创建、启用、置顶和遗忘；
- 素材上传、检查、处理、接受、引用和删除；
- 项目导出、导入与导入项目清理；
- 1440×900、1024×768、430×932、390×844 布局；
- 控制台错误和失败网络请求。

展示页截图必须来自当前版本真实界面，不使用设计稿冒充运行结果。更新截图后检查 README、`docs/showcase.html` 和就绪测试中的文件名。

## 6. 验证一键启动

在干净或接近普通用户的目录中运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-dreamchord.ps1 -NoBrowser
```

确认首次启动完成依赖、配置、数据库和健康检查；立即运行第二次，确认复用现有服务。检查：

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/health
Invoke-WebRequest http://127.0.0.1:5173 -UseBasicParsing
```

端口可能因占用而变化，应以启动器输出为准。

## 7. 提交、标签与发布

1. 确认 `git status` 干净，提交版本和文档修改。
2. 推送目标分支并确认远端提交哈希与本地一致。
3. 在最终提交创建带注释标签，例如 `v0.2.1`。
4. 推送标签。
5. 创建 GitHub Release，摘要来自 `CHANGELOG.md`，不要重新写一套不一致的变化列表。
6. 打开 GitHub Pages 展示页，检查截图和内部链接。

示例：

```bash
git tag -a v0.2.1 -m "DreamChord 0.2.1"
git push origin main
git push origin v0.2.1
```

## 8. 发布后检查

- 从 Release 下载或克隆仓库，再走一次新手启动流程。
- 确认演示账号、演示项目和真实截图可用。
- 确认 `CHANGELOG.md` 已重新保留空的“未发布”部分。
- 记录发布中发现的问题，并为需要修复的内容创建明确任务。
- 不删除用于数据迁移验证的备份，直到确认新版本稳定且已有独立备份。
