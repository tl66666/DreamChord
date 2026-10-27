[CmdletBinding()]
param(
  [string]$ArchivePath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$packRoot = Join-Path $workspaceRoot 'assets\music-packs\ternox-vn'
$manifestPath = Join-Path $packRoot 'manifest.json'
$runtimeRoot = Join-Path $packRoot 'runtime'
$publicRoot = Join-Path $workspaceRoot 'apps\web\public\assets\audio\demo'
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json

function Get-LowerSha256([string]$Path) {
  return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Test-RuntimePack {
  foreach ($track in $manifest.tracks) {
    $relativeOutput = $track.outputFile -replace '/', [IO.Path]::DirectorySeparatorChar
    $output = Join-Path $packRoot $relativeOutput
    if (-not (Test-Path -LiteralPath $output -PathType Leaf)) { return $false }
    if ((Get-LowerSha256 $output) -ne $track.sha256) { return $false }
  }
  return $true
}

function Sync-PublicAudio {
  New-Item -ItemType Directory -Force -Path $publicRoot | Out-Null
  foreach ($track in $manifest.tracks) {
    $source = Join-Path $packRoot ($track.outputFile -replace '/', [IO.Path]::DirectorySeparatorChar)
    $destination = Join-Path $publicRoot ([IO.Path]::GetFileName($track.outputFile))
    Copy-Item -LiteralPath $source -Destination $destination -Force
  }
}

if (Test-RuntimePack) {
  Sync-PublicAudio
  Write-Host "✓ 官方原声已经校验并同步到播放器：$($manifest.tracks.Count) 首。"
  exit 0
}

foreach ($command in 'ffmpeg', 'ffprobe') {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw "未找到 $command。请安装 FFmpeg，或恢复仓库中已提交的 assets/music-packs/ternox-vn/runtime 文件。"
  }
}

$systemTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$workingRoot = Join-Path $systemTemp ("DreamChord-ternox-{0}" -f [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $workingRoot | Out-Null

try {
  $resolvedArchive = $ArchivePath
  if (-not $resolvedArchive) {
    $resolvedArchive = Join-Path $workingRoot $manifest.downloadFile
    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $headers = @{
      'User-Agent' = 'DreamChord soundtrack installer/1.0'
      'Accept' = 'text/html,application/xhtml+xml,application/json'
    }
    $purchase = Invoke-WebRequest -Uri "$($manifest.sourceUrl)/purchase" -WebSession $session -Headers $headers -UseBasicParsing
    $csrfMatch = [regex]::Match($purchase.Content, '<meta name="csrf_token" value="([^"]+)"')
    if (-not $csrfMatch.Success) { throw '无法读取 itch.io 下载令牌，请稍后重试。' }
    $csrf = [Net.WebUtility]::HtmlDecode($csrfMatch.Groups[1].Value)
    $generated = Invoke-RestMethod -Uri "$($manifest.sourceUrl)/download_url" -Method Post -WebSession $session -Headers ($headers + @{ 'X-Requested-With' = 'XMLHttpRequest' }) -Body @{ csrf_token = $csrf }
    $downloadPage = Invoke-WebRequest -Uri $generated.url -WebSession $session -Headers $headers -UseBasicParsing
    $pageCsrf = [Net.WebUtility]::HtmlDecode(([regex]::Match($downloadPage.Content, '<meta name="csrf_token" value="([^"]+)"')).Groups[1].Value)
    $uploadId = ([regex]::Match($downloadPage.Content, 'data-upload_id="(\d+)"')).Groups[1].Value
    if (-not $uploadId) { throw '无法读取 itch.io 音乐包文件编号，请稍后重试。' }
    $fileEndpoint = "$($manifest.sourceUrl)/file/${uploadId}?source=game_download&after_download_lightbox=1&as_props=1"
    $signed = Invoke-RestMethod -Uri $fileEndpoint -Method Post -WebSession $session -Headers ($headers + @{ 'X-Requested-With' = 'XMLHttpRequest'; 'Referer' = $generated.url }) -Body @{ csrf_token = $pageCsrf }
    if (-not $signed.url) { throw 'itch.io 没有返回音乐包下载地址，请稍后重试。' }
    Invoke-WebRequest -Uri $signed.url -OutFile $resolvedArchive -Headers @{ 'User-Agent' = $headers['User-Agent'] } -UseBasicParsing
  }

  $resolvedArchive = (Resolve-Path -LiteralPath $resolvedArchive).Path
  if ((Get-LowerSha256 $resolvedArchive) -ne $manifest.archiveSha256) {
    throw '下载包 SHA-256 与授权清单不一致，已拒绝解压。'
  }

  $extractRoot = Join-Path $workingRoot 'extracted'
  Expand-Archive -LiteralPath $resolvedArchive -DestinationPath $extractRoot
  $sourceFiles = Get-ChildItem -LiteralPath $extractRoot -Recurse -File | Group-Object -AsHashTable -AsString -Property Name
  New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null

  foreach ($track in $manifest.tracks) {
    $inputGroup = $sourceFiles[$track.originalFile]
    if (-not $inputGroup) { throw "原曲 $($track.originalFile) 不在下载包中。" }
    $input = @($inputGroup)[0].FullName
    if ((Get-LowerSha256 $input) -ne $track.originalSha256) {
      throw "原曲 $($track.originalFile) 缺失或哈希不一致。"
    }
    $analysis = (& ffmpeg -hide_banner -nostats -i $input -af 'loudnorm=I=-18:TP=-1:LRA=11:print_format=json' -f null NUL 2>&1) -join "`n"
    $measurementMatch = [regex]::Match($analysis, '\{\s*"input_i"[\s\S]*?\}')
    if (-not $measurementMatch.Success) { throw "无法分析 $($track.originalFile) 的响度。" }
    $measurement = $measurementMatch.Value | ConvertFrom-Json
    $filter = "loudnorm=I=-18:TP=-1:LRA=11:measured_I=$($measurement.input_i):measured_LRA=$($measurement.input_lra):measured_TP=$($measurement.input_tp):measured_thresh=$($measurement.input_thresh):offset=$($measurement.target_offset):linear=true"
    $output = Join-Path $packRoot ($track.outputFile -replace '/', [IO.Path]::DirectorySeparatorChar)
    & ffmpeg -v error -y -i $input -af $filter -c:a libvorbis -q:a 5 $output
    if ($LASTEXITCODE -ne 0) { throw "FFmpeg 转码失败：$($track.originalFile)" }
    if ((Get-LowerSha256 $output) -ne $track.sha256) {
      throw "转码结果与官方清单不一致：$($track.name)。请使用仓库附带的标准 runtime 文件。"
    }
    Write-Host "✓ $($track.name)"
  }

  Sync-PublicAudio
  Write-Host "官方原声安装完成：$($manifest.tracks.Count) 首。"
}
finally {
  $resolvedWorkingRoot = [IO.Path]::GetFullPath($workingRoot)
  if ($resolvedWorkingRoot.StartsWith($systemTemp, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolvedWorkingRoot).StartsWith('DreamChord-ternox-')) {
    Remove-Item -LiteralPath $resolvedWorkingRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
