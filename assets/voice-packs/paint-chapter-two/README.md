# 第二章日语声音包

68 句对白沿用序章和第一章的原创合成演员声线，由项目已托管的 GPT-SoVITS v2ProPlus 合成。八份 normal/casual 与 serious 参考逐字节复制自第一章，并与序章 SHA 一致；保留程见、夏禾、许野、陆青四名演员身份，本章只有前三名发言。没有下载真人参考、重新生成 Qwen 参考、替换演员或训练角色专属权重。

`manifest.json` 保存中文显示文本、作者日文、实际读音输入、角色、参考 SHA、推理参数、种子、WAV 母带与运行 OGG 的 SHA。`pronunciation-overrides.json` 仅指导短句、姓名/标题和「女優」读音，日文字幕仍以作者文本为准。`alternates/`、manifest 的 `alternates` 和 `alternates-asr-review.json` 一起保留替补前的母带、参数和对应 ASR 证据，不在游戏播放。

```sh
# 根目录构建并导出当前第二章后，可断点续跑：
python scripts/generate-paint-dialogue.py --pack paint-chapter-two --script .runtime/paint-chapter2-script.json
node scripts/package-paint-audio.mjs --pack paint-chapter-two --script .runtime/paint-chapter2-script.json
# 可选 CPU 辅助检查，需要已缓存的 faster-whisper base：
python scripts/review-paint-dialogue.py --pack paint-chapter-two
```

运行文件位于 `/assets/audio/paint-chapter-two/pc2-…-ja.ogg`，编码为单声道 24 kHz Ogg Vorbis q5，目标 -18 LUFS、-1.5 dBTP。最新技术验证与时长见 `technical-review.json`；验证包含八份参考身份、68 句文本/角色/母带/运行哈希、68 个 OGG 解码、源样本削波检查、76 份当前哈希对应的参考及对白 ASR。序章和第一章共 127 句对白及 5 句试听、所有既有母带和制作记录均保留。

**尚未完成人耳表演验收。** ASR 会混淆短句、假名/汉字和外来姓名；替换种子、识别分数和解码成功均不代表发音、情绪或自然度已通过。当前具体待复听项保存在技术报告的 `auxiliaryAsrFlags`。尤其《海鸥》相关两句仍需结合语境确认节奏和「女優」读音。

文学引文「私はカモメ……いいえ、違う。私は女優なの。」是契诃夫公版《海鸥》妮娜独白的本项目自译节选，周围对白为原创。

原始参考来源为 Qwen3-TTS 原创合成，见 [Qwen3-TTS / Apache-2.0](https://github.com/QwenLM/Qwen3-TTS)。合成引擎见 [GPT-SoVITS / MIT](https://github.com/RVC-Boss/GPT-SoVITS)。权重与运行环境不纳入仓库。
