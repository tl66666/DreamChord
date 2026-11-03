# 第一章日语声音包

68 句对白使用同一组既有演员声线，正式合成引擎为 GPT-SoVITS v2ProPlus。八份参考从 `paint-prologue` 逐字节复用，原始来源是 Qwen3-TTS 生成的原创合成参考；没有真人声优克隆和角色专用训练权重。

`manifest.json` 保留输入日文、中文显示文本、角色、参考 SHA、推理参数/种子、WAV 与运行 OGG 哈希。`alternates/` 保存被替换的 take，不在游戏播放。三处 `pronunciation-overrides.json` 只为很短的台词给假名读音，不篡改字幕。

```sh
pnpm --filter @dreamchord/story-domain build
node scripts/export-paint-chapter-one.mjs
# 在已安装 numpy、soundfile 的声音环境，启动本机 GPT-SoVITS 后：
python scripts/generate-paint-dialogue.py --pack paint-chapter-one --script .runtime/paint-chapter1-script.json
node scripts/package-paint-audio.mjs --pack paint-chapter-one --script .runtime/paint-chapter1-script.json
# faster-whisper 为可选辅助检查，不参与合成：
python scripts/review-paint-dialogue.py --pack paint-chapter-one
pnpm test:paint
```

运行编码为单声道 24kHz Ogg Vorbis q5、-18 LUFS、-1.5dBTP。对白母带约 359.7 秒。68 句、八份参考均有当前哈希对应的辅助 ASR 记录，源样本检查未发现削波。

**尚未完成人耳表演验收。** `pc1-sea-6`、`pc1-dinner-9`、`pc1-river-5` 三句很短，ASR 字形/读音结果仍需复听；后两句已保留换种子与假名引导版本，但不把换 take 或识别分数当作听感通过。合成配音能直接播放，不承诺真人级情绪和自然度。

模型软件与来源：GPT-SoVITS [MIT](https://github.com/RVC-Boss/GPT-SoVITS)，Qwen3-TTS [Apache-2.0](https://github.com/QwenLM/Qwen3-TTS)。模型权重与运行环境不入 Git；本目录保存的是角色参考和原创台词成品、来源及制作记录。
