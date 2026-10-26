$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$serverEnv = Join-Path $projectRoot 'apps\server\.env'

if (-not (Test-Path $serverEnv)) {
  throw '缺少 apps/server/.env，请先运行 pnpm voice:setup。'
}

$pythonLine = Get-Content -LiteralPath $serverEnv | Where-Object { $_ -match '^GPT_SOVITS_PYTHON=' } | Select-Object -Last 1
if (-not $pythonLine) { throw '没有找到 GPT_SOVITS_PYTHON，请先运行 pnpm voice:setup。' }
$python = ($pythonLine -replace '^GPT_SOVITS_PYTHON=', '').Trim().Trim('"').Replace('/', '\')
if (-not (Test-Path $python)) { throw "声音环境 Python 不存在：$python" }

& $python -c 'import kokoro, soundfile, huggingface_hub, numpy' 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host '正在为声音环境安装合成参考音所需组件…' -ForegroundColor Yellow
  & $python -m pip install 'kokoro>=0.9.4,<1' 'misaki[zh]>=0.9.4,<1' 'soundfile>=0.12,<1' 'huggingface_hub>=0.25,<1' 'numpy<3'
  if ($LASTEXITCODE -ne 0) { throw 'Kokoro 起始音色生成组件安装失败。' }
}

& $python (Join-Path $PSScriptRoot 'generate-starter-voices.py')
if ($LASTEXITCODE -ne 0) { throw '起始音色生成失败。' }
