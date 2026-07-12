# DreamChord 文档体系实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立面向小白、创作者、HR、开发者和维护者的分层中文文档体系。

**Architecture:** 根 README 作为短入口，`docs/README.md` 作为文档索引，专题文档各自维护一种事实。GitHub 可识别的贡献、变更与安全文件放在仓库根目录。

**Tech Stack:** Markdown、PowerShell、Node.js 链接检查脚本、现有 pnpm 工作区。

---

### Task 1: 重构项目入口

**Files:**
- Modify: `README.md`
- Create: `docs/README.md`

- [ ] 用真实产品工作流重写 README。
- [ ] 增加按读者分类的文档导航。
- [ ] 保留一键启动、演示账号、截图和核心验证命令。

### Task 2: 补齐分众说明

**Files:**
- Create: `docs/GETTING_STARTED.md`
- Create: `docs/CREATOR_WORKFLOW.md`
- Create: `docs/PROJECT_OVERVIEW.md`
- Create: `docs/ARCHITECTURE.md`
- Create: `docs/GLOSSARY.md`

- [ ] 编写从下载到预览的新手闭环。
- [ ] 说明编辑器、素材库和 Agent 的协作关系。
- [ ] 用可验证事实总结项目价值与技术难点。
- [ ] 记录模块边界、数据流和扩展约束。
- [ ] 统一项目术语。

### Task 3: 建立维护规范

**Files:**
- Create: `CONTRIBUTING.md`
- Create: `CHANGELOG.md`
- Create: `SECURITY.md`
- Create: `docs/ROADMAP.md`
- Create: `docs/RELEASE_GUIDE.md`

- [ ] 写明环境、分支、测试和提交要求。
- [ ] 建立 Keep a Changelog 风格的版本记录。
- [ ] 区分安全边界与普通缺陷。
- [ ] 把未来功能放入路线图，不混入当前能力。
- [ ] 固化升级、数据库备份、截图和发布检查。

### Task 4: 验证文档

**Files:**
- Modify: `scripts/workspace-readiness.test.mjs`

- [ ] 添加关键文档存在性与 README 链接检查。
- [ ] 运行 `pnpm test:readiness`。
- [ ] 运行 `git diff --check`。
- [ ] 检查 UTF-8 文本、失效链接和版本号一致性。
