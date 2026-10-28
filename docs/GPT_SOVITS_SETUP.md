# DreamChord 内置声音克隆（GPT-SoVITS）

DreamChord 把 GPT-SoVITS 当作由项目自己管理的本地声音引擎。它不会在浏览器里连接陌生网站，也不要求日常另外打开 GPT-SoVITS WebUI。引擎源码、Python 环境和模型默认放在空间充足的 `DreamChordRuntime` 目录（本机为 `D:\DreamChordRuntime`），不会塞进 Git 仓库。

## 你需要先知道的两件事

- 第一次安装需要下载 Python 依赖和预训练模型，文件较大，耗时取决于网络与显卡环境。
- 做第一版角色声音不需要训练。GPT-SoVITS 可直接使用约 5 秒的清晰参考音做零样本生成；有约 1 分钟干净录音并愿意进一步训练时，才需要进入微调流程。

## 一次性安装（Windows）

先确认电脑上有以下两个基础工具：

1. Git
2. PowerShell 7

不需要再单独安装 Miniconda。DreamChord 会下载经过 SHA256 校验、通过项目实机兼容性验证的固定 Miniforge 版本，并安装到自己的版本化运行时目录，不修改系统 PATH，也不接管系统 Python。

然后在 DreamChord 项目根目录执行：

```powershell
pnpm voice:setup
```

安装脚本会选择至少有 40GB 空间且剩余空间最多的本地磁盘。本机默认会使用 `D:\DreamChordRuntime`，避免挤占空间较少的 C 盘。它会自动检测 NVIDIA 显卡；检测到显卡时使用 CUDA 12.6 方案，否则使用 CPU 方案。中国大陆默认从 ModelScope 获取模型。想强制只用 CPU，可执行：

```powershell
pnpm voice:setup:cpu
```

如果确实要指定目录，可以直接运行：

```powershell
pwsh -NoProfile -File scripts/setup-gpt-sovits.ps1 -RuntimeRoot "E:\DreamChordRuntime"
```

网络中断或官方依赖下载失败时，再次运行同一个命令即可。已通过校验的 Miniforge、源码、Python 环境和模型会被复用。

安装完成后，不需要再运行 GPT-SoVITS 命令。正常执行 `pnpm dev`，DreamChord 后端会在隐藏窗口中启动本机 `api_v2.py`，只监听 `127.0.0.1:9880`；关闭 DreamChord 时会一起停止。声音库页面也提供启动与停止按钮。

## 安装三款梦弦起始音色

项目附带三款中文合成起始音色的清单：`星璃・清澈`、`雾岚・轻语`、`暮川・沉稳`。它们不是从声优、主播或其他真人身上克隆的；参考音由 Apache-2.0 的 Kokoro 模型生成，声音库里会一直显示来源模型、源 voice id、授权协议、哈希和“非真人声音克隆”标识。

完成 GPT-SoVITS 安装后执行：

```powershell
pnpm voice:starter:generate
pnpm voice:seed
```

第一条命令会在同一个项目声音环境里补装轻量生成组件，生成三段本地参考 WAV，并把时长与 SHA256 写回清单；第二条命令会校验哈希并把它们导入 demo 账号的声音库。两条命令都可以安全重复执行，不会创建重复音色。

官方示例现使用 TERNOX 的真人作曲视觉小说配乐包，从 21 首中选择 9 首，覆盖日常、抹除危机、角色主题和三个结局。来源页明确标注 CC0 和未使用生成式 AI。需要重新安装或导入时执行：

```powershell
pnpm music:official:install
pnpm music:seed
```

它们会进入“素材库 → 音乐库”，携带情绪、剧情用途、作者和 CC0 来源。来源与哈希记录在 `assets/music-packs/ternox-vn/manifest.json`；官方剧情读取经过响度统一的 OGG。旧的程序化音乐生成脚本仍可单独用于实验。

这三款属于开箱即用的零样本音色，不应被描述成“训练出来的真人音色”。以后如果加入真正的角色微调，应另建训练任务、独立模型权重和清晰的授权记录，不能覆盖这里的来源信息。

## 在 DreamChord 里的完整流程

1. 在项目编辑器的素材面板选择“声线样本”。
2. 上传 3–15 秒单人干声，选择所属角色，填写和录音逐字一致的原文及语言，并确认你拥有克隆授权。
3. 打开“素材库 → 声音库”，新建私有音色，把上传的样本登记为参考片段。
4. 选择项目和角色，点击“绑定这个音色”。
5. 输入一句台词，默认“自动适配台词情绪与节奏”会更新情绪、语速和表演提示；关闭开关可手动指定。点击“生成试听”。
6. 试听满意后点击“收入配音素材库”。不满意可修改台词、参考片段或语速重新生成。
7. 回到镜头卡的“配音”，从项目素材中选择刚确认的 `VOICE`。正式播放只读取确认过的音频，不会临时等待模型生成。

## 参考录音怎么选

- 推荐 3–15 秒，只有一个人在说话。
- 不要带 BGM、明显混响、变声效果或其他人的声音。
- 情绪和目标台词尽量接近；平静样本很难稳定生成激烈哭喊。
- 原文必须与录音一致，标点也尽量准确。
- 只使用本人声音或已获得明确、可撤销授权的声音。

## 常见状态

- “内置声音引擎尚未安装”：先执行 `pnpm voice:setup`；脚本不再要求提前安装 Conda。
- “正在加载声音模型”：正常现象，首次启动通常更久。
- “无法连接本机 GPT-SoVITS”：在声音库点“启动内置声音引擎”；仍失败时检查安装命令上方的报错。
- 显存不足：先缩短台词并关闭其他占显存程序；仍不足时重新使用 CPU 模式安装。
- 生成结果不像：优先换更清晰、更接近目标情绪的参考片段；不要立刻进入训练。

## 设计边界

DreamChord 负责授权记录、音色档案、角色绑定、串行任务、试听确认和成品素材；GPT-SoVITS 只负责本机推理。浏览器不能提交任意 Provider 地址或服务器文件路径。多个角色的任务会排队执行，避免模型全局状态互相污染。

## CosyVoice3 情感配音

CosyVoice3 可以把表演提示传给模型，适合对白情绪、停顿和节奏控制。GPT-SoVITS 继续适用于参考声音克隆，主要依靠参考片段本身的情绪表现。两者都在 DreamChord 声音库内操作。

```powershell
pnpm voice:cosy:setup
pnpm voice:cosy:smoke
# 为雪、影、宫各生成一句独立试听
node scripts/cosyvoice-smoke.mjs --all
pnpm voice:cosy:auditions
```

安装目录默认 `D:\DreamChordRuntime\cosyvoice`，包含独立 Python 环境、官方模型和中英文文本规范化资源。安装器可复制本机已安装的 CUDA Torch，复制后与 GPT-SoVITS 环境独立。安装器会真实生成一句台词，确认 CUDA 和音频有效后才切换服务端配置。首次需要已有的 DreamChord 专用 Miniforge/CUDA 环境，先运行 `pnpm voice:setup`。

桥接服务仅监听 `127.0.0.1:50000`。正常启动 DreamChord 后后台加载，声音库显示实际引擎和支持的功能，不需要打开 CosyVoice WebUI。模型加载与文本资源读取均使用本地文件。

需要回退时，把 `apps/server/.env` 中的 `VOICE_PROVIDER` 改为 `gpt-sovits` 后重启后端。不要同时启动两套模型占满显存。

技术自检报告和 WAV 在 `.runtime/voice-auditions`。它记录音频长度、生成耗时、峰值、RMS 和削波数；这些指标不能替代表演试听。三条演示候选导入后位于 demo 账号相应音色的“最近生成”，尚未自动收入正式素材。

每次生成会记录台词哈希、实际表演参数、引擎能力和参考片段。自动适配是确定性规则建议，仍可能误判上下文；作者可关闭后手动调整。它不会把输入的每个字分别拼接成语音，而是对整句台词重新合成。

官方技术参考：[CosyVoice](https://github.com/QwenAudio/CosyVoice)、[官方模型](https://huggingface.co/FunAudioLLM/Fun-CosyVoice3-0.5B-2512)、[TERNOX 配乐来源](https://ternox.itch.io/vn-music)。
