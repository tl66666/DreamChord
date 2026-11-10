# 《夏日来信与未完之画》序章日语配音母带

中文对白显示与日语音轨独立。角色绑定固定音色，台词按角色及情绪参考在制作阶段批量合成；成品播放使用预先打包的 OGG，不在每次点击对白时请求模型。

声线为原创合成角色，不代表真人声优。参考由本机 Qwen3-TTS CustomVoice 生成（日语主角女声使用日语预置 Ono_Anna）；对白采用 GPT-SoVITS v2ProPlus 的参考音频推理。这里没有训练角色专属模型，也没有使用网络真人录音做克隆参考。模型代码许可证与模型来源分别保存在 manifest 中。

`manifest.json` 记录声线、参考句、参考情绪、日语台词、中文显示文字、种子、生成参数、来源和 WAV/OGG 的 SHA-256。WAV 是未做响度压缩的制作母带；运行文件位于 `apps/web/public/assets/audio/paint-prologue/`，采用 24kHz 单声道 Vorbis q5，目标 -18 LUFS / -1.5 dBTP。

## 重现与继续生成

脚本输入为仓库 `.runtime/paint-script.json`，每项字段 `{id, role, text, ja, emotion}`。role 接受程见/夏禾/许野/陆青或 cheng/xia/ye/lu。情绪会选择该角色的日常或认真参考，固定演员身份不随句子更换。

先在仓库根运行 `pnpm demo:paint:script` 从正式文本导出输入。仓库已有完整参考，普通改词无需重新生成音色，直接继续下面第2–3步；第1步只用于重新选角或制作新的参考。

1. 暂停项目托管 GPT-SoVITS 服务，释放显存；使用本机 Qwen Python 执行 `scripts/generate-paint-references.py`。支持 `--only xia-casual` 和 `--retake`。日常/认真参考各一条，避免同时加载两套大模型。
2. 退出 Qwen 进程，恢复本机 GPT-SoVITS v2ProPlus API（127.0.0.1:9880）；使用本机有 numpy/soundfile 的 Python 执行 `scripts/generate-paint-dialogue.py`。支持 `--limit 3`、`--only 节点id`、`--retake`。检查文本、情绪、参考哈希、音频哈希后一致的片段会跳过。
3. 使用 `node scripts/package-paint-audio.mjs` 校验当前全部台词后生成运行 OGG。不会删除其他音轨。FFmpeg 可通过 `FFMPEG_PATH` 指定。
4. 可选：用已安装 faster-whisper 的 Python 执行 `scripts/review-paint-dialogue.py`，CPU 检查漏字、重复及音频技术数据。ASR 不是表演质量或日语自然度的听审，不能据此宣称“真人感”。

本包用 `humanListeningCompleted` 明确标记是否进行了人工试听；数值为 false 时，技术校验不能替代导演/日语母语者的试听与返工。

`pronunciation-overrides.json` 是制作侧的假名读音字典，不修改字幕。实际送入模型的文字另存为 `synthesisText`，原台词保留在 `text` 中。重做片段可用 `--retake --seed-offset 1000 --reason 原因`，旧母带及其参数留在 `alternates/` 与 manifest 的 `alternates` 中，不会被悄悄覆盖。

正式序章保持 GPT-SoVITS 角色音色一致。`direct-qwen-*.wav` 和 `directQwenComparisons` 仅为同一预置声线的独立技术对照，没有替换正式片段；`scripts/render-paint-qwen.py` 默认只保存对照，需显式 `--publish` 才会发布。一次短 ASR 的分差不足以决定更换演员或引擎。
