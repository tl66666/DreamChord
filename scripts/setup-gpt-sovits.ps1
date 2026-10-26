param(
  [ValidateSet('AUTO', 'CU126', 'CU128', 'CPU')]
  [string]$Device = 'AUTO',
  [ValidateSet('HF', 'HF-Mirror', 'ModelScope')]
  [string]$Source = 'ModelScope'
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runtimeRoot = Join-Path $projectRoot '.runtime\gpt-sovits'
$environmentRoot = Join-Path $runtimeRoot '.conda'

Write-Host 'DreamChord 内置声音引擎安装向导' -ForegroundColor Cyan
Write-Host "安装目录：$runtimeRoot"

if ($Device -eq 'AUTO') {
  $Device = if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) { 'CU126' } else { 'CPU' }
  Write-Host "自动选择运行模式：$Device"
}

foreach ($command in @('git', 'conda', 'pwsh')) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw "缺少 $command。请先安装 Git、Miniconda 和 PowerShell 7，再重新运行 pnpm voice:setup。"
  }
}

if (-not (Test-Path (Join-Path $runtimeRoot 'api_v2.py'))) {
  New-Item -ItemType Directory -Force -Path (Split-Path $runtimeRoot -Parent) | Out-Null
  Write-Host '正在下载 GPT-SoVITS 官方源码…' -ForegroundColor Yellow
  & git clone --depth 1 https://github.com/RVC-Boss/GPT-SoVITS.git $runtimeRoot
  if ($LASTEXITCODE -ne 0) { throw 'GPT-SoVITS 下载失败。' }
} else {
  Write-Host '检测到已有引擎源码，跳过重复下载。'
}

if (-not (Test-Path (Join-Path $environmentRoot 'python.exe'))) {
  Write-Host '正在创建独立 Python 3.10 环境…' -ForegroundColor Yellow
  & conda create -y -p $environmentRoot python=3.10
  if ($LASTEXITCODE -ne 0) { throw 'Python 环境创建失败。' }
}

Write-Host '正在安装依赖和预训练模型，首次执行会下载较大文件，请保持网络连接…' -ForegroundColor Yellow
& conda run --no-capture-output -p $environmentRoot pwsh -NoProfile -File (Join-Path $runtimeRoot 'install.ps1') --Device $Device --Source $Source
if ($LASTEXITCODE -ne 0) { throw 'GPT-SoVITS 官方安装脚本执行失败。' }

if (-not (Test-Path (Join-Path $runtimeRoot 'GPT_SoVITS\configs\tts_infer.yaml'))) {
  throw '安装未生成推理配置，请查看上方错误信息。'
}

Write-Host ''
Write-Host '安装完成。以后只需正常启动 DreamChord，声音引擎会在后台自动加载。' -ForegroundColor Green
Write-Host '进入「素材库 → 声音库」即可创建音色、绑定角色并生成试听。'
