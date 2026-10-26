param(
  [ValidateSet('AUTO', 'CU126', 'CU128', 'CPU')]
  [string]$Device = 'AUTO',
  [ValidateSet('HF', 'HF-Mirror', 'ModelScope')]
  [string]$Source = 'ModelScope',
  [string]$RuntimeRoot = ''
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$configScript = Join-Path $PSScriptRoot 'voice-runtime-config.mjs'
$serverEnv = Join-Path $projectRoot 'apps\server\.env'
$release = (& node $configScript release-json) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw '无法读取 Miniforge 固定版本配置。' }

function Invoke-CheckedCommand {
  param([string]$Command, [string[]]$Arguments, [string]$FailureMessage)
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { throw $FailureMessage }
}

function Get-PreferredRuntimeRoot {
  $drives = Get-PSDrive -PSProvider FileSystem |
    Where-Object { $_.Root -match '^[A-Za-z]:\\$' } |
    ForEach-Object { [pscustomobject]@{ root = $_.Root; freeGiB = [math]::Floor($_.Free / 1GB) } }
  $driveJson = ConvertTo-Json @($drives) -Compress
  $selected = & node $configScript choose-runtime $driveJson
  if ($LASTEXITCODE -ne 0 -or -not $selected) { throw '无法选择声音运行时安装磁盘。' }
  return $selected
}

foreach ($command in @('git', 'node', 'pwsh')) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw "缺少 $command。请先安装该基础工具，再重新运行 pnpm voice:setup。"
  }
}

if (-not $RuntimeRoot) { $RuntimeRoot = Get-PreferredRuntimeRoot }
$RuntimeRoot = [System.IO.Path]::GetFullPath($RuntimeRoot)
$runtimeDrive = [System.IO.Path]::GetPathRoot($RuntimeRoot)
$driveInfo = Get-PSDrive -Name $runtimeDrive.Substring(0, 1)
if (-not (Test-Path $RuntimeRoot) -and $driveInfo.Free -lt 40GB) {
  throw "目标磁盘可用空间不足 40GB：$runtimeDrive"
}

$miniforgeRoot = Join-Path $RuntimeRoot "miniforge3-$($release.tag)"
$condaExe = Join-Path $miniforgeRoot 'Scripts\conda.exe'
$gptRoot = Join-Path $RuntimeRoot 'gpt-sovits'
$environmentRoot = Join-Path $gptRoot '.conda'
$environmentPython = Join-Path $environmentRoot 'python.exe'
$downloadsRoot = Join-Path $RuntimeRoot 'downloads'

Write-Host 'DreamChord 内置声音引擎安装向导' -ForegroundColor Cyan
Write-Host "运行时目录：$RuntimeRoot"
Write-Host ("目标磁盘剩余：{0:N1} GB" -f ($driveInfo.Free / 1GB))

if ($Device -eq 'AUTO') {
  $Device = if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) { 'CU126' } else { 'CPU' }
  Write-Host "自动选择运行模式：$Device"
}

if (-not (Test-Path $condaExe)) {
  New-Item -ItemType Directory -Force -Path $downloadsRoot | Out-Null
  $installerPath = Join-Path $downloadsRoot $release.installer
  $checksumPath = Join-Path $downloadsRoot $release.checksum
  $installerUrl = "$($release.baseUrl)/$($release.installer)"
  $checksumUrl = "$($release.baseUrl)/$($release.checksum)"

  Write-Host '正在下载 DreamChord 专用 Miniforge…' -ForegroundColor Yellow
  if (-not (Test-Path $installerPath)) { Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath }
  Invoke-WebRequest -Uri $checksumUrl -OutFile $checksumPath
  $expectedHash = & node $configScript parse-sha (Get-Content -Raw -LiteralPath $checksumPath)
  if ($LASTEXITCODE -ne 0) { throw 'Miniforge 官方校验文件无效。' }
  $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $installerPath).Hash.ToLowerInvariant()
  if ($actualHash -ne $expectedHash) {
    Remove-Item -LiteralPath $installerPath -Force
    throw 'Miniforge 安装包 SHA256 校验失败，已删除不可信文件。'
  }

  Write-Host '正在静默安装项目专用 Miniforge（不会修改系统 PATH）…' -ForegroundColor Yellow
  $installer = Start-Process -FilePath $installerPath -ArgumentList @('/S', '/InstallationType=JustMe', '/RegisterPython=0', '/AddToPath=0', "/D=$miniforgeRoot") -Wait -PassThru
  if ($installer.ExitCode -ne 0 -or -not (Test-Path $condaExe)) { throw "Miniforge 安装失败（代码 $($installer.ExitCode)）。" }
} else {
  Write-Host '检测到 DreamChord 专用 Miniforge，跳过重复安装。'
}

if (-not (Test-Path (Join-Path $gptRoot 'api_v2.py'))) {
  New-Item -ItemType Directory -Force -Path $RuntimeRoot | Out-Null
  Write-Host '正在下载 GPT-SoVITS 官方源码…' -ForegroundColor Yellow
  Invoke-CheckedCommand git @('clone', '--depth', '1', 'https://github.com/RVC-Boss/GPT-SoVITS.git', $gptRoot) 'GPT-SoVITS 下载失败。'
} else {
  Write-Host '检测到已有 GPT-SoVITS 源码，跳过重复下载。'
}

if (-not (Test-Path $environmentPython)) {
  Write-Host '正在创建独立 Python 3.10 环境…' -ForegroundColor Yellow
  Invoke-CheckedCommand $condaExe @('create', '-y', '-p', $environmentRoot, 'python=3.10') 'Python 环境创建失败。'
}

$inferenceConfig = Join-Path $gptRoot 'GPT_SoVITS\configs\tts_infer.yaml'
$pretrainedRoot = Join-Path $gptRoot 'GPT_SoVITS\pretrained_models'
if (-not (Test-Path $pretrainedRoot) -or -not (Get-ChildItem $pretrainedRoot -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1)) {
  Write-Host '正在安装依赖和预训练模型，首次执行会下载较大文件，请保持网络连接…' -ForegroundColor Yellow
  Invoke-CheckedCommand $condaExe @(
    'run', '--no-capture-output', '-p', $environmentRoot,
    'pwsh', '-NoProfile', '-File', (Join-Path $gptRoot 'install.ps1'),
    '-Device', $Device, '-Source', $Source
  ) 'GPT-SoVITS 官方安装脚本执行失败。再次运行本命令可以继续。'
} else {
  Write-Host '检测到预训练模型，跳过重复安装。'
}

foreach ($requiredPath in @((Join-Path $gptRoot 'api_v2.py'), $inferenceConfig, $environmentPython, $pretrainedRoot)) {
  if (-not (Test-Path $requiredPath)) { throw "声音运行时不完整，缺少：$requiredPath" }
}

& node $configScript upsert-env $serverEnv 'VOICE_PROVIDER' 'gpt-sovits'
& node $configScript upsert-env $serverEnv 'GPT_SOVITS_HOME' $gptRoot
& node $configScript upsert-env $serverEnv 'GPT_SOVITS_PYTHON' $environmentPython
& node $configScript upsert-env $serverEnv 'GPT_SOVITS_AUTO_START' 'true'
if ($LASTEXITCODE -ne 0) { throw '写入 DreamChord 本地声音配置失败。' }

Write-Host ''
Write-Host '安装完成。以后正常启动 DreamChord 即可，声音引擎会在后台加载。' -ForegroundColor Green
Write-Host '进入「素材库 → 声音库」即可创建音色、绑定角色并生成试听。'
