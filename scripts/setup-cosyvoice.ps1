param(
  [string]$RuntimeRoot = 'D:\DreamChordRuntime',
  [ValidateSet('ModelScope', 'HuggingFace')]
  [string]$Source = 'ModelScope'
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runtimeConfigScript = Join-Path $PSScriptRoot 'cosyvoice-runtime-config.mjs'
$envHelper = Join-Path $PSScriptRoot 'voice-runtime-config.mjs'
$serverEnv = Join-Path $projectRoot 'apps\server\.env'
$RuntimeRoot = [System.IO.Path]::GetFullPath($RuntimeRoot)
$config = (& node $runtimeConfigScript config-json $RuntimeRoot) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw '无法读取 CosyVoice 运行时配置。' }

function Invoke-CheckedCommand {
  param([string]$Command, [string[]]$Arguments, [string]$FailureMessage)
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { throw $FailureMessage }
}

function Test-PythonImport {
  param([string]$Python, [string]$Statement)
  if (-not (Test-Path -LiteralPath $Python)) { return $false }
  & $Python -c $Statement 2>$null
  return $LASTEXITCODE -eq 0
}

foreach ($command in @('git', 'node', 'pwsh')) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw "缺少 $command，暂时无法安装 CosyVoice。"
  }
}

$runtimeDrive = [System.IO.Path]::GetPathRoot($RuntimeRoot)
$driveInfo = Get-PSDrive -Name $runtimeDrive.Substring(0, 1)
if (-not (Test-Path -LiteralPath $config.home) -and $driveInfo.Free -lt 25GB) {
  throw "目标磁盘可用空间不足 25GB：$runtimeDrive"
}

$condaCandidates = @(Get-ChildItem -LiteralPath $RuntimeRoot -Directory -Filter 'miniforge3-*' -ErrorAction SilentlyContinue |
  ForEach-Object { Join-Path $_.FullName 'Scripts\conda.exe' } |
  Where-Object { Test-Path -LiteralPath $_ })
if ($condaCandidates.Count -eq 0) {
  throw '未找到 DreamChord 专用 Miniforge。请先运行 pnpm voice:setup，再运行 pnpm voice:cosy:setup。'
}
$condaExe = $condaCandidates | Sort-Object -Descending | Select-Object -First 1
$environmentPython = Join-Path $config.environment 'python.exe'
$sharedTorchPython = Join-Path $RuntimeRoot 'gpt-sovits\.conda\python.exe'
$repository = $config.repository
$requirements = Join-Path $repository 'requirements.txt'
$filteredRequirements = Join-Path $config.home 'dreamchord-requirements.txt'
$modelDirectory = $config.modelDirectory
$nativeBuildTemp = Join-Path $RuntimeRoot 'tmp'
New-Item -ItemType Directory -Force -Path $config.home, $nativeBuildTemp | Out-Null
$env:TEMP = $nativeBuildTemp
$env:TMP = $nativeBuildTemp
$env:TMPDIR = $nativeBuildTemp

Write-Host 'DreamChord CosyVoice 情感配音安装向导' -ForegroundColor Cyan
Write-Host "运行时目录：$($config.home)"
Write-Host '安装完成后仍从 DreamChord 的声音库使用，不需要打开外部 WebUI。'

if (-not (Test-Path -LiteralPath $requirements)) {
  Write-Host '正在下载 CosyVoice 官方源码与子模块…' -ForegroundColor Yellow
  Invoke-CheckedCommand git @('clone', '--depth', '1', '--recursive', 'https://github.com/QwenAudio/CosyVoice.git', $repository) 'CosyVoice 官方源码下载失败。再次运行本命令可以继续。'
} else {
  Write-Host '检测到 CosyVoice 官方源码，跳过重复下载。'
  Push-Location $repository
  try { Invoke-CheckedCommand git @('submodule', 'update', '--init', '--recursive', '--depth', '1') 'CosyVoice 子模块补全失败。' }
  finally { Pop-Location }
}

if (-not (Test-Path -LiteralPath $environmentPython)) {
  Write-Host '正在创建隔离的 Python 3.10 环境…' -ForegroundColor Yellow
  Invoke-CheckedCommand $condaExe @('create', '-y', '-p', $config.environment, 'python=3.10', 'pip') 'CosyVoice Python 环境创建失败。'
}

# Copy the existing Python 3.10 Torch distribution into this environment.
# Never expose the other environment's site-packages to pip, and never leave
# writable junctions that a future upgrade could follow into GPT-SoVITS.
$sharedTorchReady = Test-PythonImport $sharedTorchPython "import torch;assert torch.cuda.is_available()"
if ($sharedTorchReady) {
  $sharedSitePackages = (& $sharedTorchPython -c 'import site;print(site.getsitepackages()[-1])').Trim()
  $cosySitePackages = (& $environmentPython -c 'import site;print(site.getsitepackages()[-1])').Trim()
  $packageNames = @('torch', 'torchaudio', 'functorch', 'torchgen')
  $packageNames += @(Get-ChildItem -LiteralPath $sharedSitePackages -Directory |
    Where-Object { $_.Name -match '^(torch|torchaudio)-.+\.dist-info$' } |
    ForEach-Object { $_.Name })
  foreach ($packageName in $packageNames) {
    $sourcePath = Join-Path $sharedSitePackages $packageName
    $targetPath = Join-Path $cosySitePackages $packageName
    if (-not (Test-Path -LiteralPath $sourcePath)) { continue }
    if (Test-Path -LiteralPath $targetPath) {
      $existing = Get-Item -LiteralPath $targetPath
      if ($existing.LinkType -ne 'Junction') { continue }
      if (-not $existing.FullName.StartsWith($cosySitePackages + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Torch 迁移目标越界。' }
      $backupRoot = Join-Path $config.home ('legacy-torch-links-' + [guid]::NewGuid().ToString('N'))
      New-Item -ItemType Directory -Path $backupRoot | Out-Null
      Move-Item -LiteralPath $targetPath -Destination (Join-Path $backupRoot $packageName)
    }
    Write-Host "正在复制本机 CUDA 运行库：$packageName"
    Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Recurse
  }
} elseif (-not (Test-PythonImport $environmentPython 'import torch')) {
  throw '没有找到可复用的 CUDA Torch。请先完成 pnpm voice:setup。'
}

Get-Content -LiteralPath $requirements |
  Where-Object { $_ -notmatch '^(torch|torchaudio)==' } |
  Set-Content -LiteralPath $filteredRequirements -Encoding utf8

$importsReady = Test-PythonImport $environmentPython "import sys;sys.path.insert(0,r'$($repository.Replace("'", "''"))');import torch,fastapi,modelscope;from cosyvoice.cli.cosyvoice import AutoModel"
if (-not $importsReady) {
  Write-Host '正在安装 CosyVoice 推理依赖…' -ForegroundColor Yellow
  # openai-whisper 20231117 still imports pkg_resources while preparing its
  # wheel. Setuptools 81+ removed that module, so prepare this one legacy
  # build in the isolated runtime before resolving the official requirements.
  Invoke-CheckedCommand $environmentPython @('-m', 'pip', 'install', 'setuptools<81') '安装 Whisper 兼容构建工具失败。'
  Invoke-CheckedCommand $environmentPython @(
    '-m', 'pip', 'install', 'openai-whisper==20231117', '--no-build-isolation', '--no-deps',
    '-i', 'https://mirrors.aliyun.com/pypi/simple/', '--trusted-host=mirrors.aliyun.com',
    '--extra-index-url', 'https://download.pytorch.org/whl/cu121'
  ) '安装 CosyVoice 的 Whisper 依赖失败。'
  Invoke-CheckedCommand $environmentPython @('-m', 'pip', 'install', '-r', $filteredRequirements, '-i', 'https://mirrors.aliyun.com/pypi/simple/', '--trusted-host=mirrors.aliyun.com') 'CosyVoice 依赖安装失败。再次运行本命令可断点继续。'
}

$requiredModelFiles = @('cosyvoice3.yaml', 'llm.pt', 'flow.pt', 'hift.pt', 'campplus.onnx', 'speech_tokenizer_v3.onnx', 'CosyVoice-BlankEN\model.safetensors')
$modelReady = @($requiredModelFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $modelDirectory $_)) }).Count -eq 0
if (-not $modelReady) {
  New-Item -ItemType Directory -Force -Path $modelDirectory | Out-Null
  Write-Host '正在下载 Fun-CosyVoice3-0.5B-2512 官方模型…' -ForegroundColor Yellow
  if ($Source -eq 'ModelScope') {
    $downloadCode = "from modelscope import snapshot_download;snapshot_download('$($config.modelId)',local_dir=r'$($modelDirectory.Replace("'", "''"))')"
  } else {
    Invoke-CheckedCommand $environmentPython @('-m', 'pip', 'install', 'huggingface_hub') 'Hugging Face 下载组件安装失败。'
    $downloadCode = "from huggingface_hub import snapshot_download;snapshot_download(repo_id='$($config.modelId)',local_dir=r'$($modelDirectory.Replace("'", "''"))')"
  }
  Invoke-CheckedCommand $environmentPython @('-c', $downloadCode) 'CosyVoice 官方模型下载失败。再次运行本命令可以继续。'
} else {
  Write-Host '检测到 CosyVoice3 官方模型，跳过重复下载。'
}

Invoke-CheckedCommand node @($runtimeConfigScript, 'write-bridge', $config.bridge, $modelDirectory, [string]$config.port) '生成 DreamChord CosyVoice 本地桥接失败。'

$normalizerDirectory = Join-Path $config.home 'text-frontend'
$normalizerCode = "from modelscope import snapshot_download;snapshot_download('pengzhendong/wetext',local_dir=r'$($normalizerDirectory.Replace("'", "''"))',allow_file_pattern=['zh/tn/tagger.fst','zh/tn/verbalizer.fst','en/tn/tagger.fst','en/tn/verbalizer.fst'])"
Invoke-CheckedCommand $environmentPython @('-c', $normalizerCode) '下载中英文文本规范化资源失败，可再次运行继续。'

foreach ($requiredPath in @($environmentPython, $requirements, $modelDirectory, $config.bridge)) {
  if (-not (Test-Path -LiteralPath $requiredPath)) { throw "CosyVoice 运行时不完整，缺少：$requiredPath" }
}
if (-not (Test-PythonImport $environmentPython "import sys;sys.path.insert(0,r'$($repository.Replace("'", "''"))');from cosyvoice.cli.cosyvoice import AutoModel")) {
  throw 'CosyVoice 安装后自检失败：无法导入官方 AutoModel。'
}

if (-not (Test-PythonImport $environmentPython 'import torch;assert torch.cuda.is_available()')) {
  throw 'CosyVoice CUDA 自检失败，保留原声音引擎配置。'
}
Push-Location $projectRoot
try {
  Invoke-CheckedCommand pnpm @('--filter', '@dreamchord/story-domain', 'build') '构建配音共享规则失败。'
  Invoke-CheckedCommand pnpm @('--filter', 'dreamchord-server', 'build') '构建配音适配器失败。'
  Invoke-CheckedCommand node @((Join-Path $PSScriptRoot 'cosyvoice-smoke.mjs'), '--runtime-root', $RuntimeRoot) 'CosyVoice 真实台词自检失败，保留原声音引擎配置。'
} finally { Pop-Location }

foreach ($pair in @(
  @('VOICE_PROVIDER', 'cosyvoice'),
  @('COSYVOICE_HOME', $config.home),
  @('COSYVOICE_PYTHON', $environmentPython),
  @('COSYVOICE_BRIDGE', $config.bridge),
  @('COSYVOICE_MODEL_HOME', $modelDirectory),
  @('COSYVOICE_BASE_URL', "http://$($config.host):$($config.port)"),
  @('COSYVOICE_PORT', [string]$config.port),
  @('COSYVOICE_AUTO_START', 'true')
)) {
  & node $envHelper upsert-env $serverEnv $pair[0] $pair[1]
  if ($LASTEXITCODE -ne 0) { throw "写入本地声音配置失败：$($pair[0])" }
}

Write-Host ''
Write-Host 'CosyVoice 安装完成。重启 DreamChord 后会在后台使用情感配音引擎。' -ForegroundColor Green
Write-Host '声音样本与生成结果仍只在「素材库 → 声音库」中管理。'
