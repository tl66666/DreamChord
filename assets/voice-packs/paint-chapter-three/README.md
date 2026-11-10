# 《风从夏日手记吹来》固定角色日语配音

30句新对白，沿用序章三位画中角色的声音参考；闻砚手记与陆青资料查验均为静默叙述，未新增历史人物声线。参考原由Qwen3-TTS生成，正式对白由本机GPT-SoVITS v2ProPlus参考合成，没有训练角色专属权重，也没有借用商业声优录音。

`manifest.json`记录字幕、实际发音输入、参考SHA、种子、参数、WAV母带及运行OGG哈希。`pronunciation-overrides.json`仅指导日期、姓名与普通词汇读音，原日文字幕不变。6条旧母带保留在`alternates/`，对应ASR在`alternates-asr-review.json`。

重现步骤（先按主README启动已安装的本机声音引擎）：

```bash
pnpm --filter @dreamchord/story-domain build
node scripts/prepare-paint-chapter-three.mjs
python scripts/generate-paint-dialogue.py --pack paint-chapter-three --script .runtime/paint-chapter3-script.json
node scripts/package-paint-audio.mjs --pack paint-chapter-three --script .runtime/paint-chapter3-script.json
python scripts/review-paint-dialogue.py --pack paint-chapter-three
pnpm test:paint
```

Python须为已安装numpy/soundfile及辅助ASR的声音环境；运行依赖/模型不入Git。已有母带会依据文本和参考SHA续跑，定向重录须用`--only ... --retake --reason ...`保留旧记录。复现时无需覆盖已有参考。

`technical-review.json`记录30条运行音轨完整解码及当前ASR覆盖、既有三章195条录音与提交基线哈希一致。**尚未完成人耳听感验收**。ASR对“四月二十日、三時”仍有字形/断词混淆，不能宣称读音、情绪或自然度已达真人表演标准。
