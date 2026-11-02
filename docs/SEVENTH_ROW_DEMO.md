# 历史示例短篇《第七排，空座》

保留入口 `/play/dreamchord-seventh-row`。首页当前推荐为 [《谢幕词上的那一句》](CURTAIN_CALL_DEMO.md)，本篇作为历史资源保留。约 6–8 分钟，一次分歧、两个结局；三位成年角色、三个原创场景、九张透明表情立绘、35 句对白的完整中文和日语录音。默认中文字幕、日语配音，可独立切换。旁白静默阅读。更早的示例 `/play/dreamchord-first-thread` 与用户作品也保留。

## 故事与演出

白帆影院停业前夜，声音修复师陈屿、放映员陆遥、歌手程夏重听八年前的演出。导出光盘时，一段朋友之间的交谈被陈屿换成七秒空白；他把这个版本误当成了对方一直等待自己的证据。纸套日期、快递寄出地、程夏的蓝本、第七排坏掉的弹簧在揭晓前出现。程夏回来拿回原带，陆遥也已订好离开的车票。分歧围绕今晚如何放映展开，两条线均不替角色宣布感情归属。

- 原声放映：程夏同意播放原录音并亲自介绍；陈屿留下错误音符，约定次日帮忙修椅。
- 今晚的片尾：原带归还，征询两人后录下今天；陆遥说出自己的车票与计划。末尾音乐淡出，让告别停在日常声音的想象中。

创作参考来自用户指定作品的官方介绍：[WHITE ALBUM2](https://aquaplus.jp/wa2sp/)、[樱之诗](https://www.makura-soft.com/sakuranouta/story/story.html)、[海猫鸣泣之时](https://www.entergram.co.jp/umineko/outline.html)、[素晴日开发者](https://www.keroq.co.jp/main.html)。取关系张力、生活细节、信息次序与不同解释的思路，角色、台词、场景和情节均为本项目新作，不使用这些作品的美术或 OST。

## 美术与声音来源

`apps/web/public/assets/seventh-row/`：内置 image_gen 生成的原创雨夜影院、放映室、观众席，以及三位角色的三表情。提示设计使用琥珀、深青、旧酒红的统一配色。陆遥：黑发低马尾、米色开衫、深青长裙；程夏：栗色短发、梅紫大衣、红围巾；陈屿：短黑发、眼镜、灰大衣与随身录音机。角色画面保留全身与真实透明通道，舞台显示半身。生成后按列提取、裁掉透明边界、统一到 1024×1536；背景为 1920×1080。生成文件名与哈希记录在 `provenance.json`。不得把人物缩小后放在画布底部，否则舞台会误判头顶位置。

`assets/voice-packs/seventh-row/manifest.json`：每条录音记录模型、speaker、语言、文本、指令、哈希、时长与运行时 Ogg 哈希。本轮使用 [Qwen3-TTS CustomVoice](https://github.com/QwenLM/Qwen3-TTS) 预置合成声线，非真人克隆，也没有宣称重新训练了专属权重。陆遥使用 Serena，程夏使用 Ono_Anna，陈屿使用 Dylan。原始 WAV 保留，运行时 Ogg 统一响度。异常长输出重试；个别台词重录并记录剪去非剧本前导语气声的处理。`asr-review.json` 为 CPU Whisper 辅助核对记录，含繁简字、数字与同音识别误差，不能代表专业表演试听结论。

五条配乐均来自 [TERNOX 的真人作曲视觉小说音乐包](https://ternox.itch.io/vn-music)，来源页标明 CC0，未使用生成式 AI。既有原始曲目不改变，本短篇重新选择慢速曲目、安排淡入淡出与对白间的静默。`apps/web/public/assets/audio/seventh-row/music-credits.json` 逐曲关联原包哈希、来源与用途；库中使用“第七排 · 放映室的灯”等用途明确的名称。

## 配音为什么仍要生成

音色档案决定“谁在说话”，合成任务决定“这次说什么”。角色绑定一次，后续台词自动沿用该角色音色。新文字需要模型计算，重复点击不应重复计算，作者不用逐句选择声音或逐句操作生成。此次内置短篇两种语言全部预先制作，因此切换直接读取现成音轨。

本机动态中文沿用 CosyVoice3；日语仍通过 [GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS) 的参考音频合成通道。没有弃用 GPT-SoVITS。新角色档案各提供 3.5–9.5 秒的中日参考。新增中文对白选择日语时，系统保存中文原稿，另存日语译文和日语音轨；字幕选择不被配音语言覆盖。

首页保存封面/语言会启动整部作品检查，各章节逐步补齐，已有有效音轨直接复用。作品卡片显示进度、未绑定数量、暂停与重试。新生成的任务和结果持久保存在数据库；调度进度位于服务进程中，重启后点击“准备/继续”重新扫描并复用已有任务。不是无限后台守护服务。

进入编辑器会先暂停首页批处理并等待正在进行的数据库写入完成，再读取项目；已提交给模型的计算可以继续，结果留待复用。编辑器使用原有自动配音与 SaveCoordinator；后台写入只在原台词、绑定、参考与章节版本仍匹配时成功，遇到修改停止并提示，避免覆盖作者工作。

## 安装、复现与接手

正常安装已包含公开音轨和图片。新数据库的基础 seed 新增短篇；以下独立命令补充三位音色、双语参考与五条音乐到 demo 账号库中，重复执行不重置章节、封面、语言或自定义绑定：

```powershell
pnpm --filter @dreamchord/story-domain build
pnpm --filter dreamchord-server exec tsx prisma/seedSeventhRow.ts
node --test scripts/seventh-row-pack.test.mjs
```

需要重新生成时，先从领域定义导出对白到 `.runtime/seventh-row-script.json`（字段 id、role、text、ja），使用独立 Qwen Python 执行 `scripts/generate-seventh-row.py`；支持 `--retake 节点-语言 --seed-offset 数字`。然后执行 `node scripts/package-seventh-row.mjs` 并重新核对 manifest。权重留在外部运行时，不提交仓库。生成成本与参考选型不应出现在普通用户创作界面中。

本轮没有数据库结构迁移，也不运行会重置旧示例章节的 `refreshOfficialDemo`。领域定义在 `packages/story-domain/src/seventhRowDemo.ts`，后台调度分别在 `projectVoicePreparation.ts` 和 `prismaVoicePreparation.ts`，入口为 `/api/projects/:id/voice-preparation`，GET 状态、POST 开始/继续、DELETE 暂停；均校验项目所有权。
