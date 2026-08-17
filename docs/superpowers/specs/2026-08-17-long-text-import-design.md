# 长篇导入任务设计

## 目标

让大篇幅正文导入具备可恢复的章节切分、块级检查点、暂停/继续、取消、失败重试和真实进度展示。导入任务只负责可靠保存和规范化正文，完成后仍沿用现有稿件解析、SceneBlueprint、StoryPatch 和作者确认流程。

## 数据与状态

- `LongTextImport` 保存原始正文、文件名、块大小、总数、完成数、失败数和任务状态。
- `LongTextImportChunk` 保存章节标题、原文区间、正文、状态、尝试次数和规范化结果。
- 任务状态：`queued -> running -> completed`，也可以进入 `paused`、`failed` 或 `cancelled`。
- 服务重启时 `running` 任务和 `processing` 块恢复为 `queued`，已完成块不会重复处理。

## 执行边界

当前采用 SQLite/Prisma 持久任务账本 + 单进程领取器，不引入 Redis 或额外服务。数据库状态是队列事实来源；未来部署到多实例时，可将领取逻辑替换为 Cloudflare Queues、Postgres advisory lock 或其他持久队列，API 和状态模型保持不变。

任务处理阶段只做换行规范化和检查点写入，不直接创建章节、镜头或素材。用户确认任务完成后，前端把合并正文送入现有场景导入器；复杂语义仍由 SceneBlueprint 和作者审批保障。

## API

- `POST /api/projects/:projectId/import-jobs` 创建任务。
- `GET /api/projects/:projectId/import-jobs` 获取项目任务列表。
- `GET /api/projects/:projectId/import-jobs/:importId` 获取任务和块进度。
- `POST .../:importId/pause|resume|cancel|retry` 管理任务。
- `GET .../:importId/result` 获取已完成的规范化正文。

## 前端流程

1. 用户在稿件预览中检查章节、场景和台词数量。
2. 长篇项目点击“开始长篇导入”，创建持久任务。
3. 弹窗轮询任务状态，显示完成块/总块、百分比和失败块数量。
4. 任务完成后自动取回合并正文，再进入原有场景导入和作者撤销链路。

## 后续演进

- 为每个块增加 SceneBlueprint 预览和“只重新导入选中章节”。
- 将领取器替换为多实例安全的持久队列，并增加 SSE 推送。
- 对超大原文转为对象存储引用，数据库只保存哈希和区间，避免 SQLite 行过大。
