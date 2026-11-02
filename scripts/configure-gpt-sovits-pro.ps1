param([string]$HomePath = '', [switch]$CPU)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envPath = Join-Path $projectRoot 'apps/server/.env'
if (-not $HomePath) {
  $line = Select-String -LiteralPath $envPath -Pattern '^GPT_SOVITS_HOME=' | Select-Object -First 1
  if (-not $line) { throw '请先运行 pnpm voice:setup，或用 -HomePath 指定已经安装好的 GPT-SoVITS。' }
  $HomePath = $line.Line.Substring('GPT_SOVITS_HOME='.Length).Trim().Trim('"').Trim("'")
}
$HomePath = (Resolve-Path -LiteralPath $HomePath).Path
$python = Join-Path $HomePath '.conda/python.exe'
foreach ($relative in @('api_v2.py', '.conda/python.exe', 'GPT_SoVITS/pretrained_models/s1v3.ckpt', 'GPT_SoVITS/pretrained_models/v2Pro/s2Gv2ProPlus.pth', 'GPT_SoVITS/pretrained_models/sv/pretrained_eres2netv2w24s4ep4.ckpt', 'GPT_SoVITS/pretrained_models/chinese-roberta-wwm-ext-large', 'GPT_SoVITS/pretrained_models/chinese-hubert-base')) {
  if (-not (Test-Path -LiteralPath (Join-Path $HomePath $relative))) { throw "Pro 模型不完整，缺少 $relative。现有配置未改动。请先按官方安装说明补齐。" }
}
$config = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'gpt-sovits-curtain.json') -Raw | ConvertFrom-Json
if ($CPU) { $config.custom.device = 'cpu'; $config.custom.is_half = $false }
else {
  & $python -c 'import torch; assert torch.cuda.is_available(), "CUDA is unavailable; rerun with -CPU"'
  if ($LASTEXITCODE -ne 0) { throw 'CUDA 不可用，现有配置未改动。CPU 模式可加 -CPU。' }
}
$configPath = Join-Path $HomePath 'GPT_SoVITS/configs/tts_infer_curtain.yaml'
# JSON is valid YAML. Only our dedicated file is written; the upstream tts_infer.yaml remains intact.
$config | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $configPath -Encoding utf8NoBOM
$helper = Join-Path $PSScriptRoot 'voice-runtime-config.mjs'
foreach ($pair in @(@('VOICE_PROVIDER','gpt-sovits'), @('GPT_SOVITS_CONFIG',$configPath), @('GPT_SOVITS_LOG_PATH',(Join-Path $HomePath 'dreamchord-logs/voice-api.log')))) {
  & node $helper upsert-env $envPath $pair[0] $pair[1]
  if ($LASTEXITCODE -ne 0) { throw '写入本机声音配置失败。' }
}
Write-Host 'GPT-SoVITS v2ProPlus 已配置。重启 DreamChord 后，在声音库查看引擎状态即可。上游默认配置保留。'
