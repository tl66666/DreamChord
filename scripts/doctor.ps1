param([string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot))

$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 > $null 2>&1

$failed = $false
function Pass([string]$Message) { Write-Host "[PASS] $Message" -ForegroundColor Green }
function Warn([string]$Message) { Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Fail([string]$Message) { $script:failed = $true; Write-Host "[FAIL] $Message" -ForegroundColor Red }

Write-Host "DreamChord 环境诊断`n项目目录: $ProjectRoot"

foreach ($relativePath in @('package.json', 'pnpm-lock.yaml', 'apps\web\package.json', 'apps\server\package.json', 'apps\server\prisma\schema.prisma')) {
  if (Test-Path (Join-Path $ProjectRoot $relativePath)) { Pass "项目文件完整: $relativePath" }
  else { Fail "缺少项目文件: $relativePath" }
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Fail '未安装 Node.js，需要 Node.js 20 或更高版本' }
else {
  $version = node --version
  $major = [int]($version -replace '^v(\d+).*', '$1')
  if ($major -ge 20) { Pass "Node.js 版本可用: $version" } else { Fail "Node.js 版本过低: $version，需要 20 或更高版本" }
}

if (Get-Command pnpm -ErrorAction SilentlyContinue) { Pass "pnpm 可用: $(pnpm --version)" }
elseif (Get-Command corepack -ErrorAction SilentlyContinue) { Warn 'pnpm 尚未启用；一键启动器会通过 Corepack 启用 pnpm 9.1.0' }
else { Fail 'pnpm 和 Corepack 均不可用，请重新安装 Node.js 20 LTS' }

$envPath = Join-Path $ProjectRoot 'apps\server\.env'
if (Test-Path $envPath) {
  $envText = Get-Content -Raw -LiteralPath $envPath -Encoding UTF8
  if ($envText -match '(?m)^JWT_SECRET="?(.{16,})"?$') { Pass 'JWT_SECRET 已配置' }
  else { Fail 'JWT_SECRET 缺失或少于 16 个字符' }
} else { Warn '尚无 apps\server\.env；一键启动器会在首次运行时创建' }

$dreamChordPorts = @()
foreach ($port in 3001..3010) {
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 1
    if ($health.service -eq 'dreamchord-server') { $dreamChordPorts += $port }
  } catch { }
}

if ($dreamChordPorts.Count -gt 0) {
  Warn "检测到 DreamChord 正在运行，后端端口: $($dreamChordPorts -join ', ')。普通启动会复用它；安装检查前请先关闭旧服务窗口。"
} else {
  Pass '未检测到正在运行的 DreamChord 后端，可以执行首次安装或升级'
}

foreach ($port in @(3001, 5173)) {
  $connection = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($connection) { Warn "端口 $port 已被占用，启动器会识别 DreamChord 或选择其他可用端口" }
  else { Pass "端口 $port 可用" }
}

if ($failed) {
  Write-Host "`n诊断发现必须修复的问题，请按上方 [FAIL] 提示处理。" -ForegroundColor Red
  exit 1
}
Write-Host "`n诊断完成：环境没有发现阻止启动的硬错误。" -ForegroundColor Green
exit 0
