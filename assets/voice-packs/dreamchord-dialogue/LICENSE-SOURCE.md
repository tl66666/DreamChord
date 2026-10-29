# 台词配音声线集：来源与授权

- 生成方式：本机 RTX 4060 使用 [Qwen3-TTS-12Hz-1.7B-CustomVoice](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice)（Apache-2.0）本地合成，未上传任何文本或音频到第三方服务。
- 声音来源：模型预置 speaker（非真人克隆，不来自任何真人的参考录音）。表演提示（direction/instruction）为本项目原创文本。
- 台词文本：为本包原创编写的示例台词（中文与日文各 3 句 × 4 声线），不是任何现有作品的台词。
- 技术处理：生成后仅做峰值保护（peak > 0.94 时线性缩小到 0.94），以 PCM_16 WAV 存储，不做响度标准化（保持对话动态）。
- 可追溯性：每个样音记录 speaker、表演指令、SHA-256、时长与采样率于 `manifest.json`；`generationSeconds` 记录生成耗时。
- 使用边界：合成音的听感与语义需试听确认，不宣称与真人录音无法区分。可用作 DreamChord 声音库的试听样音与角色绑定音色来源。
