# Resilient Conversational Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 DreamChord Agent 能自然回答简单问题，兼容常见模型格式偏差，并在无法结构化解析时安全降级为只读对话结果。

**Architecture:** 在协议层规范化模型常见输出，在执行器层保留一次结构修复并增加自然文本降级，在本地助手层处理即时对话与项目能力问答。前端只呈现用户可理解的状态和快捷任务，工具白名单与审批流程保持不变。

**Tech Stack:** TypeScript、Zod、Vitest、React、Vite、Prisma、Express。

---

### Task 1: 模型协议兼容

**Files:**
- Modify: `apps/server/src/agent/protocol.ts`
- Modify: `apps/server/src/agent/protocol.test.ts`

- [ ] **Step 1: 写失败测试**

新增用例，断言以下输入都能解析为 `final`：

```ts
{ type: 'final', summary: '你好，我可以帮你梳理故事。', plan: null, patch: null }
```

以及：

```text
这是结果：
```json
{"type":"final","summary":"项目状态正常","plan":[]}
```
```

- [ ] **Step 2: 验证测试失败**

Run: `pnpm --filter dreamchord-server test -- src/agent/protocol.test.ts`
Expected: FAIL，错误路径包含 `patch` 或无法解析 JSON。

- [ ] **Step 3: 最小实现**

在解析前提取代码块或唯一 JSON 对象；对 `final` 响应把 `patch: null` 删除，把缺失或 `null` 的 `plan` 设为 `[]`。工具调用不做宽松字段推断。

- [ ] **Step 4: 验证通过并提交**

Run: `pnpm --filter dreamchord-server test -- src/agent/protocol.test.ts`
Expected: PASS。

Commit: `fix: tolerate common agent response formats`

### Task 2: 安全自然文本降级

**Files:**
- Modify: `apps/server/src/agent/executor.ts`
- Modify: `apps/server/src/agent/executor.test.ts`

- [ ] **Step 1: 写失败测试**

模拟模型依次返回三次普通文本：

```ts
const chat = vi.fn().mockResolvedValue('你好，我可以帮你一起完善这个故事。')
```

期望运行完成，`summary` 等于自然文本，`patch` 未定义，事件包含 `response_fallback`。另加空字符串用例，期望仍抛出格式错误。

- [ ] **Step 2: 验证测试失败**

Run: `pnpm --filter dreamchord-server test -- src/agent/executor.test.ts`
Expected: FAIL，当前实现会在两次 `format_repair` 后抛错。

- [ ] **Step 3: 最小实现**

事件类型新增 `response_fallback`。保留一次格式修复；再次失败时，仅当响应是非空、非损坏 JSON 的可读文本，返回没有补丁、记忆或产物的完成结果。限制答复长度为 10000 字。

- [ ] **Step 4: 验证通过并提交**

Run: `pnpm --filter dreamchord-server test -- src/agent/executor.test.ts`
Expected: PASS。

Commit: `feat: fall back to safe conversational replies`

### Task 3: 更自然的本地助手

**Files:**
- Modify: `apps/server/src/agent/localAssistant.ts`
- Modify: `apps/server/src/agent/localAssistant.test.ts`

- [ ] **Step 1: 写失败测试**

覆盖 `你好`、`你能做什么`、`谢谢`、`我下一步该做什么`。断言回复自然提及当前项目和可用能力，不把问候回答成机械统计。

- [ ] **Step 2: 验证测试失败**

Run: `pnpm --filter dreamchord-server test -- src/agent/localAssistant.test.ts`
Expected: FAIL，当前回退为项目概况。

- [ ] **Step 3: 最小实现**

新增即时对话意图，优先级高于写作、素材、角色和体检意图。下一步建议根据章节、角色、素材和剧情健康状态生成最多三项具体建议。

- [ ] **Step 4: 验证通过并提交**

Run: `pnpm --filter dreamchord-server test -- src/agent/localAssistant.test.ts`
Expected: PASS。

Commit: `feat: make local agent conversational`

### Task 4: Agent 工作区反馈与快捷入口

**Files:**
- Modify: `apps/web/src/agent/AgentTimeline.tsx`
- Modify: `apps/web/src/agent/AgentComposer.tsx`
- Modify: `apps/web/src/agent/ConversationTranscript.tsx`
- Modify: `apps/web/src/agent/AgentPanel.test.tsx`
- Create or Modify: `apps/web/src/agent/AgentTimeline.test.tsx`

- [ ] **Step 1: 写失败测试**

断言 `format_repair` 显示“正在适配模型返回格式”，`response_fallback` 显示“已转为安全对话答复”，失败状态显示错误原因；空对话存在“了解项目、检查剧情、梳理角色、素材建议”快捷任务。

- [ ] **Step 2: 验证测试失败**

Run: `pnpm --filter dreamchord-web test -- src/agent/AgentTimeline.test.tsx src/agent/AgentPanel.test.tsx`
Expected: FAIL，当前显示内部事件名且没有通用快捷任务。

- [ ] **Step 3: 最小实现**

建立事件中文映射；失败状态使用警告图标并展示 `errorMessage`；将主按钮改为“发送给 Agent”；新增项目级快捷任务，点击后填充提示词和作用域，不自动提交。

- [ ] **Step 4: 验证通过并提交**

Run: `pnpm --filter dreamchord-web test -- src/agent/AgentTimeline.test.tsx src/agent/AgentPanel.test.tsx`
Expected: PASS。

Commit: `feat: clarify agent capabilities and recovery`

### Task 5: 真实验收、文档与发布

**Files:**
- Modify: `README.md`
- Modify: `docs/showcase.html`
- Modify: `docs/screenshots/agent-workspace-1440.png`
- Modify: `docs/screenshots/agent-390.png`
- Add: `docs/screenshots/agent-capabilities-1440.png`

- [ ] **Step 1: 完整验证**

Run:

```powershell
pnpm lint
pnpm test
pnpm build
pnpm test:readiness
git diff --check
```

Expected: 全部退出码 0。

- [ ] **Step 2: 一键启动并浏览器验收**

使用 `start-dreamchord.ps1` 启动。真实 GLM 配置下发送“你好”，确认运行完成并出现助手回复；再测试项目概况、章节绑定、工具任务入口和 390px 布局。检查浏览器错误和 4xx/5xx 请求。

- [ ] **Step 3: 更新真实截图和中文文档**

README 与展示页明确说明自然对话、项目上下文、分层记忆、工具调用、审批、安全降级和无 Key 能力。截图必须来自本地运行实例，使用绝对保存路径。

- [ ] **Step 4: 提交、推送并复核**

Commit: `docs: highlight resilient agent workflows`

Run: `git push origin main`

Expected: `git rev-parse HEAD` 与 `git ls-remote origin refs/heads/main` 一致。
