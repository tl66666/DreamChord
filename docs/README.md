# DreamChord 文档中心

这里按使用目的整理文档。第一次接触项目时不需要从头读完，选择与你当前任务最接近的一组即可。

## 先从这里开始

| 目标 | 文档 | 预计阅读时间 |
|---|---|---|
| 在自己的电脑上运行项目 | [新手入门](GETTING_STARTED.md) | 10 分钟 |
| 理解项目价值和完成度 | [项目概览](PROJECT_OVERVIEW.md) | 5 分钟 |
| 完成一段可玩的故事 | [创作者工作流](CREATOR_WORKFLOW.md) | 15 分钟 |
| 理解系统如何工作 | [系统架构](ARCHITECTURE.md) | 15 分钟 |
| 接手维护或开发 | [贡献指南](../CONTRIBUTING.md) | 10 分钟 |

## 使用文档

- [新手入门](GETTING_STARTED.md)：安装、启动、登录和第一次完整体验。
- [创作者工作流](CREATOR_WORKFLOW.md)：故事、舞台、素材和 Agent 如何配合。
- [创作 Agent 使用指南](AGENT_GUIDE.md)：对话、章节绑定、记忆、工具和审批。
- [长篇创作与小说导入](LONG_STORY_WORKFLOW.md)：章节、场景和长文拆分方法。
- [角色立绘规范](../SPRITE_ASSET_STANDARD.md)：上传图片和透明立绘的制作要求。
- [角色资料](../CHARACTERS.md)：官方演示角色设定。
- [素材资料](../ASSETS.md)：官方演示素材清单和用途。
- [官方演示剧情](../DEMO_STORY.md)：演示项目的剧情结构和分支说明。

## 产品与技术文档

- [项目概览](PROJECT_OVERVIEW.md)：目标用户、问题、方案、项目亮点和边界。
- [系统架构](ARCHITECTURE.md)：模块边界、核心数据流、Agent 与素材管线。
- [术语表](GLOSSARY.md)：章节、场景、镜头卡、记忆、补丁等词的统一定义。
- [场景编辑器设计](scene-editor-design.md)：场景与镜头卡编辑模型的详细设计。
- [AI 与架构交接](AI_HANDOFF.md)：给后续维护者和编码 Agent 的实现级说明。
- [交互架构图](dreamchord-architecture/dreamchord-architecture.html)：可视化系统关系。

## 维护与版本文档

- [贡献指南](../CONTRIBUTING.md)：环境、分支、测试、提交和评审要求。
- [变更记录](../CHANGELOG.md)：已经完成并进入版本的变化。
- [项目路线图](ROADMAP.md)：计划中的方向，不代表已经实现。
- [发布指南](RELEASE_GUIDE.md)：版本升级、数据、测试、截图、标签和发布检查。
- [安全说明](../SECURITY.md)：本地数据、API Key、上传文件和漏洞报告边界。
- [开发约定](../CLAUDE.md)：编码 Agent 和维护者必须遵守的工程约束。

## 文档维护规则

1. 新功能先更新对应专题文档，再在 README 增加一句摘要或入口。
2. 当前能力写入 README、专题文档和变更记录；未来能力只写入路线图。
3. 版本号以根目录 `package.json` 为准，发布时同步各工作区包。
4. 命令默认从仓库根目录执行，不在文档中写开发者电脑的绝对路径。
5. 截图必须来自真实运行的 DreamChord，桌面图优先使用 1440×900，移动图使用 390×844 或 430×932。
6. 不把 `.env`、API Key、数据库、上传文件或真实用户信息放入文档和截图。
7. 新增或改名文档后运行 `pnpm test:readiness` 和 `git diff --check`。
