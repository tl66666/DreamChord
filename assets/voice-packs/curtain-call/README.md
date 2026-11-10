# 明日列车与未完的谢幕：可追溯配音包

62 条中日音轨包括 30 句正文和 1 句创作起始对白的两种语言版本。正文由本机 GPT-SoVITS v2ProPlus 生成；六条参考录音由 Qwen3-TTS CustomVoice 预置合成声线生成，不是真人录音，也未训练角色专属权重。

- Qwen 模型：[Qwen3-TTS-12Hz-1.7B-CustomVoice](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice)，Apache-2.0；附对应许可证供来源核对。
- GPT-SoVITS：[官方仓库](https://github.com/RVC-Boss/GPT-SoVITS)。实际权重版本和种子见 manifest.json。
- `ref-*.wav`：角色中日参考，用于后续新台词的参考驱动合成。
- 其余正文 WAV：源录音；`manifest.json` 记录文本、参考、时长、种子、SHA256 与前端 Ogg 哈希。
- `comparison-*.wav`：两句相同中文文本的 Qwen 对照版本，未形成通用听感排名。
- `asr-review.json`：辅助识别检查，不能作为真人表演或绝对自然度的证明。

生成和打包脚本位于 `scripts/`，完整工作流见 [演示交接说明](../../../docs/CURTAIN_CALL_DEMO.md)。大模型权重不随包提交。播放器使用 `apps/web/public/assets/audio/curtain-call/` 的 Ogg，音乐另行记录 TERNOX CC0 来源。
