# 展示页合成样音

新增《请让这幅画老去》日语试听：`paint-xia-ja.ogg` 来自 `p-seat-1-ja`，`paint-cheng-ja.ogg` 来自 `p-seat-5-ja`，均为正式运行OGG的逐字节副本。制作引擎为GPT-SoVITS v2ProPlus，参考由Qwen3-TTS生成；不是真人演员录音。源/运行SHA及实际合成参数见 `assets/voice-packs/paint-prologue/manifest.json`，尚未完成人耳听审。展示页主动播放，不自动播放。

两条音频来自 DreamChord 内置角色声线包，不是真人声音克隆，供展示页主动试听使用，不自动播放。

| 文件 | 原始片段 | SHA256 |
| --- | --- | --- |
| `yuki-zh.wav` | `s1-d3-zh` | `10bae76609e49839c9a7207a2aedd468327029764ff2706048a70cdbaf56004e` |
| `yuki-ja.wav` | `s1-d3-ja` | `d4fbf5fe98b6e0f06cb4acda42f4479c35b1968251f8b4df96ded0d7773e9fde` |

- 生成模型：[Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice)，预置 speaker `Vivian`。
- 来源模型许可证：Apache-2.0。协议与更完整说明见仓库 `assets/voice-packs/dreamchord-cast/LICENSE-SOURCE.md` 和 `LICENSE-APACHE-2.0.txt`。
- 中文台词：剪贴板是空的，云端备份也在一行行变白。
- 日语台词：クリップボードが空っぽ。クラウドのバックアップまで、一行ずつ白くなってる。
- 展示名称“晴音 · 清亮少女”是可复用声线标签；官方示例推荐给角色“雪”。
