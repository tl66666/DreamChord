param(
  [switch]$SetupOnly,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 > $null 2>&1

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerDir = Join-Path $ProjectRoot 'apps\server'
$RequiredPnpmVersion = '9.1.0'
$ServerPorts = 3001..3010
$WebPorts = 5173..5183

function Write-Step([string]$Text) { Write-Host "`n==> $Text" -ForegroundColor Cyan }
function Write-Ok([string]$Text) { Write-Host "  [OK] $Text" -ForegroundColor Green }
function Write-Warn([string]$Text) { Write-Host "  [!] $Text" -ForegroundColor Yellow }

function Invoke-Checked {
  param([scriptblock]$Command, [string]$Failure)
  & $Command
  if ($LASTEXITCODE -ne 0) { throw $Failure }
}

function Test-PortAvailable([int]$Port) {
  $listener = $null
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    $listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    if ($listener) { $listener.Stop() }
  }
}

function Find-FreePort([int[]]$Candidates, [string]$Service) {
  foreach ($port in $Candidates) {
    if (Test-PortAvailable $port) { return $port }
  }
  throw "$Service 没有可用端口，已检查: $($Candidates -join ', ')"
}

function Assert-ProjectFiles {
  $required = @(
    'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
    'apps\server\package.json', 'apps\server\prisma\schema.prisma',
    'apps\web\package.json'
  )
  foreach ($relativePath in $required) {
    if (-not (Test-Path (Join-Path $ProjectRoot $relativePath))) {
      throw "项目文件不完整: $relativePath"
    }
  }
}

function Assert-Node20 {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { throw '未找到 Node.js。请安装 Node.js 20 LTS: https://nodejs.org/' }
  $nodeVersion = node --version
  $versionNum = [int]($nodeVersion -replace '^v(\d+).*', '$1')
  if ($versionNum -lt 20) { throw "Node.js 版本过低: $nodeVersion，需要 20 或更高版本" }
  Write-Ok "Node.js $nodeVersion"
}

function Ensure-Pnpm {
  if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    $pnpmVersion = pnpm --version
    if ($pnpmVersion -eq $RequiredPnpmVersion) {
      Write-Ok "pnpm $pnpmVersion"
      return
    }
    Write-Warn "pnpm $pnpmVersion 与项目要求 $RequiredPnpmVersion 不一致，正在切换"
  }
  if (-not (Get-Command corepack -ErrorAction SilentlyContinue)) {
    throw "未找到可用的 pnpm $RequiredPnpmVersion 或 Corepack。请重新安装 Node.js 20 LTS。"
  }
  Write-Step "启用项目固定的 pnpm $RequiredPnpmVersion"
  Invoke-Checked { corepack enable } 'Corepack 启用失败'
  Invoke-Checked { corepack prepare "pnpm@$RequiredPnpmVersion" --activate } "pnpm $RequiredPnpmVersion 安装失败"
  if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { throw 'pnpm 启用后仍不可用，请重新打开终端再试' }
  $pnpmVersion = pnpm --version
  if ($pnpmVersion -ne $RequiredPnpmVersion) { throw "pnpm 版本仍为 $pnpmVersion，需要 $RequiredPnpmVersion" }
  Write-Ok "pnpm $pnpmVersion"
}

function Ensure-Environment([int]$ServerPort, [int]$WebPort) {
  $envPath = Join-Path $ServerDir '.env'
  $environmentScript = Join-Path $ProjectRoot 'scripts\ensure-environment.ps1'
  & $environmentScript -EnvPath $envPath -ServerPort $ServerPort -WebPort $WebPort
  Write-Ok '已补齐本地配置，并保留现有密钥与数据路径'
}

function Backup-LocalSqlite {
  $envPath = Join-Path $ServerDir '.env'
  $schemaPath = Join-Path $ServerDir 'prisma\schema.prisma'
  $backupScript = Join-Path $ProjectRoot 'scripts\backup-local-database.ps1'
  $backupPath = & $backupScript -EnvPath $envPath -SchemaPath $schemaPath
  if ($backupPath) { Write-Ok "升级前数据备份: $backupPath" }
}

function Wait-HttpReady([string]$Url, [string]$Name, [int]$TimeoutSeconds = 90) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        Write-Ok "$Name 已就绪: $Url"
        return
      }
    } catch { Start-Sleep -Milliseconds 750 }
  }
  throw "$Name 在 $TimeoutSeconds 秒内未就绪，请查看对应服务窗口"
}

function Start-ServiceWindow([string]$Title, [string]$Command) {
  $script = "title $Title && cd /d `"$ProjectRoot`" && $Command"
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', $script -WorkingDirectory $ProjectRoot | Out-Null
}

try {
  Write-Host "`n============================================" -ForegroundColor Magenta
  Write-Host '  DreamChord 一键启动' -ForegroundColor Magenta
  Write-Host '============================================' -ForegroundColor Magenta
  Write-Host "  项目目录: $ProjectRoot"

  Write-Step '检查项目与运行环境'
  Assert-ProjectFiles
  Assert-Node20
  Ensure-Pnpm

  $ServerPort = Find-FreePort $ServerPorts '后端'
  $WebPort = Find-FreePort $WebPorts '前端'
  Write-Ok "后端端口: $ServerPort"
  Write-Ok "前端端口: $WebPort"
  Ensure-Environment $ServerPort $WebPort

  Write-Step '安装并校验工作区依赖'
  Push-Location $ProjectRoot
  Invoke-Checked { pnpm install --frozen-lockfile } '依赖安装失败，请检查网络后重试'

  Write-Step '备份本地数据并同步数据库结构'
  Backup-LocalSqlite
  Invoke-Checked { pnpm --filter dreamchord-server prisma generate } 'Prisma Client 生成失败'
  Invoke-Checked { pnpm --filter dreamchord-server prisma db push --accept-data-loss } '数据库结构同步失败'

  # Seed uses fixed IDs and upserts, so rerunning it never overwrites user projects.
  Invoke-Checked { pnpm --filter dreamchord-server prisma db seed } '演示数据初始化失败'
  Pop-Location
  Write-Ok '本地数据已就绪（演示账号: demo / demo123）'

  if ($SetupOnly) {
    Write-Host "`n[OK] DreamChord 安装检查完成。" -ForegroundColor Green
    exit 0
  }

  Write-Step '启动后端和前端'
  Start-ServiceWindow "DreamChord Backend ($ServerPort)" "set PORT=$ServerPort&& pnpm --filter dreamchord-server dev"
  Start-ServiceWindow "DreamChord Frontend ($WebPort)" "set VITE_API_TARGET=http://127.0.0.1:$ServerPort&& pnpm --filter dreamchord-web dev --host 127.0.0.1 --port $WebPort --strictPort"

  $HomeUrl = "http://127.0.0.1:$WebPort"
  Wait-HttpReady "http://127.0.0.1:$ServerPort/api/health" '后端'
  Wait-HttpReady $HomeUrl '前端'
  if (-not $NoBrowser) { Start-Process $HomeUrl }

  Write-Host "`n============================================" -ForegroundColor Green
  Write-Host '  DreamChord 已启动' -ForegroundColor Green
  Write-Host "  前端: $HomeUrl"
  Write-Host "  后端: http://127.0.0.1:$ServerPort"
  Write-Host '  关闭两个服务窗口即可停止应用'
  Write-Host '============================================' -ForegroundColor Green
} catch {
  if ((Get-Location).Path -ne $ProjectRoot) { Pop-Location -ErrorAction SilentlyContinue }
  Write-Host "`n[FAIL] $($_.Exception.Message)" -ForegroundColor Red
  Write-Host '运行 powershell -ExecutionPolicy Bypass -File scripts\doctor.ps1 获取详细诊断。' -ForegroundColor Yellow
  exit 1
}
