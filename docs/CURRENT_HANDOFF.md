# 当前迭代交接 · 2026-10-28

本轮重点是角色声音工作流、统一页面视觉、素材发现和展示材料。旧的无 Key Agent、保存保护、舞台连续性及备份功能继续保留。历史设计和验证记录在 `docs/superpowers/`，当前使用规则以本文件与专题文档为准。

## 已实现

- 首页使用连续的写作场景、米白与浅紫过渡，完整保留人物头部与主要环境。作品有搜索、状态筛选、可访问的操作按钮；默认草稿和官方《消失的终页》使用不同封面，自定义封面保留。
- 音色库有清晰的名称、声线 / 年龄 / 用途 / 样音语言筛选、持续试听、当前角色与推荐用途。素材库和编辑器复用同一组音色卡片与试听选择器。
- 角色绑定一次，后续台词沿用音色。自动模式在停笔约 2.2 秒后处理当前章节，优先当前场景，自动翻译、合成、接受结果、关联音轨和保存；支持暂停、显式重试和手动精修。
- 中文字幕与中日配音独立。原文、翻译、声音指纹或角色绑定变化会令旧结果失效；异步返回不得覆盖新台词、手动录音和新绑定。
- 自动声音更新不消耗作者撤销台词的历史。离开编辑器停止后续提交，已经提交的服务端任务保留，下次通过项目 / 章节任务记录恢复。
- 场景按场所、时间、氛围筛选，可预览大图并显式带入目标故事；应用到目标场景可撤销，独立分支不合并。修复内置 `/assets/` 背景 URL 被误当作素材 ID 的破图问题。
- 音乐与音效独立管理，内置 13 首 TERNOX CC0 配乐；资料、用途、循环方式和授权可编辑。
- GitHub 展示页和个人作品集使用本轮实际截图，声音展示提供中日双语合成样音，移除过时视频与“尚未实现 TTS / 音乐库”的旧描述。

## 接手入口

| 任务 | 文档 / 模块 |
| --- | --- |
| 声音产品与实现规则 | [VOICE_WORKFLOW.md](VOICE_WORKFLOW.md) |
| 本机模型安装 | [GPT_SOVITS_SETUP.md](GPT_SOVITS_SETUP.md) |
| 自动后台处理 | `apps/web/src/voice/automaticVoice.ts`、`AutomaticVoiceBar.tsx` |
| 用户偏好 | `automaticVoicePreference.ts`、`characterVoicePlan.ts` |
| 手动试听与应用 | `apps/web/src/editor/ProjectVoicePanel.tsx` |
| 串行保存与历史 | `SaveCoordinator`、`editorStore.applyDerivedGraph`、`EditorHistory.replaceCurrent` |
| 声音 API / 队列 | `apps/server/src/routes/voices.ts`、`apps/server/src/voice` |
| 视觉与封面 | `index.css`、`StudioIntro.tsx`、`lib/projectCover.ts` |
| 展示源文件 | `docs/showcase.html`；根 `index.html` 重定向到这里 |
| 当前截图与音频来源 | [截图索引](screenshots/README.md)、[样音说明](assets/audio/README.md) |
| 页面插画来源 | `apps/web/public/assets/ui/PROVENANCE.md` |

## 数据与运行边界

- 不把 `.env`、数据库、上传目录、API Key、模型权重、运行时或 QA 临时文件提交进仓库。
- 自动模式与配音语言是浏览器按项目保存的偏好；角色绑定、生成任务、正式音频与保存后的音轨在服务端。
- 当前只有编辑器打开时自动安排合成；公开播放器播放已保存音轨，不做实时 TTS。没有整项目脱离编辑器的调度、多人协作、权重训练 UI 或完整多轨剪辑。
- 官方示例有五个角色的中日声线与部分预制音轨，不是完整剧情全配音。合成效果应试听判断，不能宣称等同真人演出。
- 不运行 `refreshOfficialDemo` 来刷新封面或截图：它会重建官方示例章节。封面优先通过展示兼容层或单独更新字段处理。
- 清理只针对确认没有引用的旧展示图片和本轮创建的临时测试项目，不动用户故事、录音、模型下载和其他仓库的改动。

## 验证与交接操作

```bash
pnpm lint
pnpm -r test
pnpm build
pnpm test:readiness
pnpm test:presentation
git diff --check
```

完整 `pnpm test` 会先准备共享包与 Prisma Client；Windows 后端运行时 DLL 可能被占用。没有 schema 改动、已有 Client 可用时，用 `pnpm -r test` 跑全量；需生成 Client 时先正常停止服务。不要手工删除引擎 DLL。

本轮实机验证使用独立临时故事：绑定晴音 → 自动生成中文 → 切日语自动翻译和生成 → 确认中文原文不变、两条音轨已保存；完成后通过项目 API 删除临时故事。回归覆盖任务恢复、并发保护、失败后显式重试、切章节及异步文本 / 绑定 / 录音变更，以及衍生音轨不占用撤销步骤。

每次改视觉后重截真实应用，不用生成图片伪造界面；公共展示只放演示数据。公共页面应明确区分本地应用与静态展示页，文档与样音链接必须可访问。
