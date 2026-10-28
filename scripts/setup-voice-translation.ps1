param([string]$RuntimeRoot = 'D:\DreamChordRuntime')
$ErrorActionPreference = 'Stop'
$translationPython = Join-Path $RuntimeRoot 'qwen-cast\.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $translationPython)) { throw '请先运行 pnpm voice:cast:setup 安装隔离运行环境。' }
$translationHome = Join-Path $RuntimeRoot 'voice-translation'
New-Item -ItemType Directory -Force -Path $translationHome | Out-Null
& $translationPython -m pip install requests
if ($LASTEXITCODE -ne 0) { throw '本机翻译依赖安装失败。' }
$llamaArchive = Join-Path $translationHome 'llama-b11946.zip'
$llamaHome = Join-Path $translationHome 'llama-b11946'
$expectedLlamaHash = '8a702bb07c873b133c56eb3acd92a48d7c5c9ad339c6435eddc5185e46e1a043'
if (-not (Test-Path -LiteralPath $llamaArchive) -or (Get-FileHash -LiteralPath $llamaArchive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedLlamaHash) {
  Invoke-WebRequest 'https://github.com/ggml-org/llama.cpp/releases/download/b11946/llama-b11946-bin-win-cpu-x64.zip' -OutFile $llamaArchive
}
if ((Get-FileHash -LiteralPath $llamaArchive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedLlamaHash) { throw '本机翻译运行器校验失败。' }
Expand-Archive -LiteralPath $llamaArchive -DestinationPath $llamaHome -Force
& $translationPython (Join-Path $PSScriptRoot 'download-voice-translation.py') (Join-Path $translationHome 'qwen3-4b') 'Qwen/Qwen3-4B-GGUF' 'Qwen3-4B-Q4_K_M.gguf'
if ($LASTEXITCODE -ne 0) { throw '本机中日翻译模型下载失败。' }
Write-Host '本机中日翻译已安装：Qwen3 4B Q4，按需在 CPU 上运行，不占配音显存。'
