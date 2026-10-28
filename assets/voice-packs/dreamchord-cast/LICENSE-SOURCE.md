# DreamChord 双语示例角色声线

基础模型：[Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice)

官方代码与调用说明：[QwenLM/Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS)

模型许可：Apache-2.0。许可文本随本目录保存。音频由本机模型按 DreamChord 自有示例台词生成，没有采集配音演员、动画角色或他人的录音。音色不是独占声线，也不代表真人配音。

| 示例角色 | 模型预置声线 | 表演方向 |
| --- | --- | --- |
| 雪 | Vivian | 清亮、倔强、生活化，避免播音腔 |
| 影 | Dylan | 克制的青年质问，保留受伤后的距离感 |
| 宫 | Serena | 温暖但有分寸，不替别人作决定 |
| 空 | Ono_Anna | 轻盈、好奇，逐渐学会表达意愿 |
| 守门人 | Uncle_Fu | 低声、有记忆感，减少机械播报 |

同一角色的中日文使用相同的模型 speaker。每条记录保存文本、语言、speaker、表演指令、采样率、时长、SHA-256 和生成耗时。基础声线为官方预置 speaker，本项目设计的是人物分配、台词与表演方向。

`scripts/generate-qwen-cast.py` 在隔离环境中生成；大模型留在 `D:/DreamChordRuntime/qwen-cast`，不进入 Git。生成音频经过有效 WAV、非静音、有限数值、时长和峰值检查。这些检查不能证明语义完全正确或听感接近真人；清单保留 `expressiveReview: pending`，方便逐句试听取舍。

示例开场与若干关键台词的双语音频随清单一起保存。`pnpm voice:cast:seed` 只给相同台词、尚无语言轨的节点添加音频；已有自定义配音与角色绑定会保留。新增台词仍可通过 DreamChord 管理的 CosyVoice 引擎，以这组参考音在编辑器中重新生成。
