# DreamChord Zero-Config Agent And Showcase Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让无 API Key 的 Agent 能回答项目、创作知识、记忆和常见事实问题，并在原展示页设计上用桌面真实截图重点呈现 Agent。

**Architecture:** 本地助手按项目检索、内置创作知识、白名单公共知识三层执行；`runService` 传入已经隔离的对话和记忆上下文。展示页恢复 `745a360` 基线，只增加桌面 Agent 与舞台连续性证据。

**Tech Stack:** TypeScript、Vitest、Express、原生 Fetch、Wikipedia REST API、静态 HTML/CSS、agent-browser。

---

### Task 1: 本地创作知识与项目回答

**Files:**
- Create: `apps/server/src/agent/creativeKnowledge.ts`
- Modify: `apps/server/src/agent/localAssistant.ts`
- Modify: `apps/server/src/agent/localAssistant.test.ts`

- [ ] 增加失败测试：`蒙太奇是什么` 返回定义和 DreamChord 操作建议。
- [ ] 增加失败测试：`有哪些章节` 返回章节标题和节点数量。
- [ ] 增加失败测试：无 Key 续写返回项目相关的本地结构草案，而不是纯配置提示。
- [ ] 运行 `pnpm --filter dreamchord-server test -- localAssistant.test.ts`，确认断言因能力缺失失败。
- [ ] 实现知识条目检索、章节摘要和项目相关续写方案。
- [ ] 运行聚焦测试并确认通过。

### Task 2: 对话、记忆和公共知识工具

**Files:**
- Create: `apps/server/src/agent/publicKnowledge.ts`
- Create: `apps/server/src/agent/publicKnowledge.test.ts`
- Modify: `apps/server/src/agent/localAssistant.ts`
- Modify: `apps/server/src/agent/localAssistant.test.ts`
- Modify: `apps/server/src/agent/runService.ts`

- [ ] 增加失败测试：Wikipedia 查询只访问 `zh.wikipedia.org`、返回摘要与来源、超时或失败返回 `null`。
- [ ] 增加失败测试：`你记得什么` 使用传入的 memory 来源；`刚才聊了什么` 使用 conversation 来源。
- [ ] 将本地助手改为异步，并注入可替换的公共知识查询函数。
- [ ] 从 `runService` 传入隔离后的对话与记忆来源。
- [ ] 运行 Agent 服务聚焦测试并确认通过。

### Task 3: 恢复展示页并突出桌面 Agent

**Files:**
- Modify: `docs/showcase.html`
- Modify: `scripts/workspace-readiness.test.mjs`
- Create or update: `docs/screenshots/agent-zero-config-1440.png`

- [ ] 从 `745a360` 恢复展示页结构和视觉基线。
- [ ] 替换真实桌面流程图截图。
- [ ] 更新原 Agent 模块并新增零配置 Agent 桌面模块。
- [ ] 不在主展示内容引用 `agent-390.png`、`editor-390.png` 或 `home-430.png`。
- [ ] 更新就绪检查，要求新桌面 Agent 截图并禁止移动截图进入展示页。

### Task 4: 浏览器验收与文档

**Files:**
- Modify: `README.md`
- Modify: `docs/AGENT_GUIDE.md`
- Modify: `docs/PROJECT_OVERVIEW.md`
- Modify: `CHANGELOG.md`

- [ ] 无 Key 发送创作术语、项目记忆、章节和一般事实问题。
- [ ] 验证回复写入当前对话、没有剧情补丁、没有控制台错误。
- [ ] 生成 1440×900 Agent 真实截图并放入展示页。
- [ ] 检查展示页 1440×900 与 1024×768。
- [ ] 更新能力边界，区分本地知识、公共知识查询和外部模型创作。

### Task 5: 完整验证

**Files:**
- Verify all changed files.

- [ ] 运行 `pnpm lint`。
- [ ] 运行 `pnpm test`。
- [ ] 运行 `pnpm build`。
- [ ] 运行 `pnpm test:readiness`。
- [ ] 运行 `git diff --check`。
- [ ] 冷启动并确认 API 与 Web 健康。
