# 官方演示：谢幕词上的那一句

这次示例围绕一个容易理解的毕业分别展开，目标是让用户读完后愿意亲手写作。许栀明早去外省入职，林澈留校读研；两人都知道彼此去向，但没有认真谈过毕业以后的联系。唐棠是催场、收拾舞台的共同朋友。

正文约 5–8 分钟，30 句角色对白、静默旁白、一个选择、两个完整结局。邀请线从散场礼堂走到校园小路，送行线在清晨车站告白。两条线都尊重许栀的工作选择。没有借用商业作品角色、台词、配乐或演员录音。

## 玩完以后，开始自己的故事

结尾的「写下你的第三种结局」会引导游客登录，再创建**当前账号自己的私有副本**。官方正文保持两个结局，个人副本追加第三个分支和一张可编辑的起始镜头卡。角色、九张表情立绘、四个场景、四首配乐和角色音色绑定一起带入，直接定位「我的第三种结局」。预览从当前镜头开始。

模板取自服务端固定的官方脚本，不能指定他人的私有项目。节点、场景、角色、音色和引用重新映射；参考录音校验 SHA256 后复制到当前作者的管理目录。相同账号与请求 ID 重试返回同一副本，避免重复点击创建多份。既有作者作品和官方示例不会被重置。

## 配音到底用了什么

- **正文和起始对白：GPT-SoVITS v2ProPlus。** 30 句正文加 1 句创作起始对白，各有中日两条音轨，共 62 条；播放器直接播放已保存录音。
- **参考音色：Qwen3-TTS CustomVoice 预置合成声线。** 许栀用 Serena、唐棠用 Vivian、林澈用 Dylan。每位角色准备中文与日语参考片段，标明合成来源和 Apache-2.0 授权。
- **不是训练好的专属角色权重，也不是真人配音。** 目前使用参考音频驱动的零样本合成。GPT-SoVITS 的少样本微调能力保留为后续可接入方向，不能把参考录音说成已经训练过模型。
- **角色只需绑定一次。** 用户继续输入中文，选择日语配音后，系统翻译并在后台补齐该角色的新对白；中文字幕保留。底层按句缓存，用户无需逐句挑音色或点击生成。改字、换音色、换语言会使相应缓存失效，正式播放不现场生成。

`assets/voice-packs/curtain-call/manifest.json` 记录模型、种子、参考片段、正文和起始对白、音频哈希、运行时编码，以及两句相同中文台词的 Qwen 对照录音。对照没有形成主观听感或通用性能排名；不同机器、参考素材和句子会影响结果。`asr-review.json` 是 CPU 识别辅助检查，不能证明表演质量或与真人无法区分。

四首配乐选自 TERNOX 的 CC0 作品，根据排练、谈心、约定、送行分配；记录原始来源与哈希，不把真人作曲音乐标成 AI 原创。见 `apps/web/public/assets/audio/curtain-call/music-credits.json`。

## 本机和新开发环境

本机已安装 ProPlus 权重，`.env` 已选择 `VOICE_PROVIDER=gpt-sovits`，使用独立的 `tts_infer_curtain.yaml`，保留上游默认配置。正常启动 DreamChord 后，引擎由服务端在后台启动，可在声音库查看、启动和停止。

```powershell
# 首次安装引擎；已经安装的机器无需重复下载
pnpm voice:setup
# 已安装 ProPlus 权重时，验证文件并生成独立配置；CPU 可加 -CPU
pnpm voice:pro:configure
# 补充新演示、官方音色和音乐，不重置既有项目
pnpm demo:curtain:seed
pnpm test:curtain
```

Pro 配置脚本会检查必需权重，缺失时保留现有配置并报出文件名。完整权重获取方法以 [GPT-SoVITS 官方说明](https://github.com/RVC-Boss/GPT-SoVITS#pretrained-models) 为准。大模型、数据库、上传文件、运行日志和本机 `.env` 不提交到 Git。若启动长期停在加载中，可检查 `GPT_SOVITS_LOG_PATH` 指向的本机日志；服务进程必须能访问安装目录和缓存。

维护入口：

| 内容 | 入口 |
| --- | --- |
| 中文正文与手工日译、剧情图 | `packages/story-domain/src/curtainCallDemo.ts` |
| 不重置的示例播种 | `apps/server/src/demo/curtainCallSeed.ts` |
| 官方音色与音乐登记 | `apps/server/prisma/seedCurtainCall.ts` |
| 创建个人副本与引用归属 | `apps/server/src/project/curtainTemplate.ts` |
| 登录续接与创建页面 | `apps/web/src/pages/TemplateStartPage.tsx` |
| 对白生成 / 音频打包 / 辅助识别 | `scripts/generate-curtain-dialogue.py`、`package-curtain-audio.mjs`、`review-curtain-dialogue.py` |
| 人物、背景及来源 | `apps/web/public/assets/curtain-call/` |

旧的 Meta 示例和影院短篇仍作为历史资源保留；首页推荐入口指向本次演示。
