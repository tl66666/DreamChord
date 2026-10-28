param([string]$RuntimeRoot = 'D:\DreamChordRuntime')
$ErrorActionPreference = 'Stop'
$castRoot = Join-Path $RuntimeRoot 'qwen-cast'
$sourcePython = Join-Path $RuntimeRoot 'cosyvoice\.conda\python.exe'
$castPython = Join-Path $castRoot '.venv\Scripts\python.exe'
function Run-Checked([string]$Command, [string[]]$Arguments) {
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { throw "声线设计环境安装失败：$Command" }
}
if (-not (Test-Path -LiteralPath $sourcePython)) { throw '请先安装本机 CosyVoice 环境。' }
New-Item -ItemType Directory -Force -Path $castRoot | Out-Null
if (-not (Test-Path -LiteralPath $castPython)) { Run-Checked $sourcePython @('-m', 'venv', (Join-Path $castRoot '.venv')) }
$sourcePackages = (& $sourcePython -c 'import site;print(site.getsitepackages()[-1])').Trim()
$castPackages = (& $castPython -c 'import site;print(site.getsitepackages()[-1])').Trim()
$packageNames = @('torch', 'torchaudio', 'functorch', 'torchgen')
$packageNames += @(Get-ChildItem -LiteralPath $sourcePackages -Directory | Where-Object { $_.Name -match '^(torch|torchaudio)-.+\.dist-info$' } | ForEach-Object { $_.Name })
foreach ($packageName in $packageNames) {
  $source = Join-Path $sourcePackages $packageName
  $destination = Join-Path $castPackages $packageName
  if ((Test-Path -LiteralPath $source) -and -not (Test-Path -LiteralPath $destination)) {
    Write-Host "复制独立 GPU 运行库：$packageName"
    Copy-Item -LiteralPath $source -Destination $destination -Recurse
  }
}
Run-Checked $castPython @('-m', 'pip', 'install', 'qwen-tts==0.1.1', 'modelscope', 'setuptools<81')
$modelPath = Join-Path $castRoot 'model'
Run-Checked $castPython @('-c', "from modelscope import snapshot_download;snapshot_download('Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice',local_dir=r'$modelPath')")
Run-Checked $castPython @('-c', 'import torch;from qwen_tts import Qwen3TTSModel;assert torch.cuda.is_available();print("QWEN_CAST_READY")')
Write-Host '声线设计环境就绪。运行脚本生成的声线可作为 DreamChord 中的原创合成参考音。'
