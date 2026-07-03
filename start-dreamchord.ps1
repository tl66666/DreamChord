# DreamChord one-click launcher.
# Double-click start-dreamchord.bat from the project folder.

$ErrorActionPreference = "Stop"

# 修复中文输出编码：强制控制台使用 UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 > $null 2>&1

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerDir = Join-Path $ProjectRoot "apps\server"
$WebDir = Join-Path $ProjectRoot "apps\web"
$ServerPort = 3001
$PreferredWebPorts = @(5173, 5174, 5175, 5176)

# ═══════════════════════════════════════════
# 工具函数
# ═══════════════════════════════════════════

function Write-Step {
  param([string]$Text)
  Write-Host ""
  Write-Host "==> $Text" -ForegroundColor Cyan
}

function Write-Ok {
  param([string]$Text)
  Write-Host "  [OK] $Text" -ForegroundColor Green
}

function Write-Warn {
  param([string]$Text)
  Write-Host "  [!] $Text" -ForegroundColor Yellow
}

function Write-Err {
  param([string]$Text)
  Write-Host "  [X] $Text" -ForegroundColor Red
}

function Test-PortListening {
  param([int]$Port)
  $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  return $null -ne $conn
}

function Stop-PortOwner {
  param([int]$Port)
  $owners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($ownerPid in $owners) {
    if (-not $ownerPid) { continue }
    try {
      $proc = Get-Process -Id $ownerPid -ErrorAction Stop
      Write-Warn "端口 $Port 被 PID $ownerPid ($($proc.ProcessName)) 占用，正在关闭..."
      Stop-Process -Id $ownerPid -Force -ErrorAction Stop
      Start-Sleep -Milliseconds 600
    } catch {
      Write-Warn "无法关闭 PID $ownerPid (端口 ${Port}): $($_.Exception.Message)"
    }
  }
}

function Resolve-WebPort {
  foreach ($port in $PreferredWebPorts) {
    if (Test-PortListening -Port $port) {
      Stop-PortOwner -Port $port
      Start-Sleep -Milliseconds 500
    }
    if (-not (Test-PortListening -Port $port)) {
      return $port
    }
  }
  throw "没有可用的前端端口，已尝试: $($PreferredWebPorts -join ', ')"
}

function Wait-HttpReady {
  param(
    [string]$Url,
    [string]$Name,
    [int]$TimeoutSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        Write-Ok "$Name 已就绪: $Url"
        return
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }
  throw "$Name 在 $TimeoutSeconds 秒内未就绪: $Url"
}

# ═══════════════════════════════════════════
# 环境检查
# ═══════════════════════════════════════════

function Check-NodeJS {
  Write-Step "检查 Node.js 环境"

  $nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
  if (-not $nodePath) {
    Write-Err "未找到 Node.js，请先安装 Node.js 20+"
    Write-Host ""
    Write-Host "  下载地址: https://nodejs.org/" -ForegroundColor Cyan
    Write-Host "  安装后重新运行此脚本" -ForegroundColor Cyan
    Write-Host ""
    pause
    exit 1
  }

  $nodeVersion = (node --version 2>$null)
  $versionNum = [int]($nodeVersion -replace 'v(\d+).*', '$1')

  if ($versionNum -lt 18) {
    Write-Err "Node.js 版本过低: $nodeVersion，需要 20+"
    Write-Host "  下载地址: https://nodejs.org/" -ForegroundColor Cyan
    pause
    exit 1
  }

  Write-Ok "Node.js $nodeVersion"

  $npmPath = (Get-Command npm -ErrorAction SilentlyContinue).Source
  if (-not $npmPath) {
    Write-Err "未找到 npm，请重新安装 Node.js"
    pause
    exit 1
  }
  $npmVersion = (npm --version 2>$null)
  Write-Ok "npm $npmVersion"

  # 检查 pnpm（可选）
  $pnpmPath = (Get-Command pnpm -ErrorAction SilentlyContinue).Source
  if ($pnpmPath) {
    $pnpmVersion = (pnpm --version 2>$null)
    Write-Ok "pnpm $pnpmVersion"
    return $true
  } else {
    Write-Warn "未安装 pnpm，将使用 npm（功能正常，但 pnpm 更快）"
    return $false
  }
}

# ═══════════════════════════════════════════
# 依赖安装
# ═══════════════════════════════════════════

function Ensure-Dependencies {
  param([bool]$UsePnpm)

  if ($UsePnpm) {
    # pnpm workspace 模式：一次安装全部
    if (-not (Test-Path (Join-Path $WebDir "node_modules")) -or -not (Test-Path (Join-Path $ServerDir "node_modules"))) {
      Write-Step "安装项目依赖 (pnpm)"
      Push-Location $ProjectRoot
      pnpm install
      if ($LASTEXITCODE -ne 0) { throw "pnpm install 失败" }
      Pop-Location
      Write-Ok "依赖安装完成"
    } else {
      Write-Ok "依赖已存在，跳过安装"
    }
  } else {
    # npm 模式：分别安装前后端
    if (-not (Test-Path (Join-Path $WebDir "node_modules"))) {
      Write-Step "安装前端依赖 (npm)"
      Push-Location $WebDir
      npm install
      if ($LASTEXITCODE -ne 0) { throw "前端 npm install 失败" }
      Pop-Location
      Write-Ok "前端依赖安装完成"
    } else {
      Write-Ok "前端依赖已存在，跳过安装"
    }

    if (-not (Test-Path (Join-Path $ServerDir "node_modules"))) {
      Write-Step "安装后端依赖 (npm)"
      Push-Location $ServerDir
      npm install
      if ($LASTEXITCODE -ne 0) { throw "后端 npm install 失败" }
      Pop-Location
      Write-Ok "后端依赖安装完成"
    } else {
      Write-Ok "后端依赖已存在，跳过安装"
    }
  }
}

# ═══════════════════════════════════════════
# 环境配置
# ═══════════════════════════════════════════

function Ensure-EnvFile {
  param([int]$WebPort)

  $envPath = Join-Path $ServerDir ".env"
  $examplePath = Join-Path $ServerDir ".env.example"

  if (-not (Test-Path $envPath)) {
    if (Test-Path $examplePath) {
      Copy-Item $examplePath $envPath
      Write-Ok "已从 .env.example 创建 apps\server\.env"
    } else {
      # 如果没有 .env.example，手动创建
      $corsPorts = $PreferredWebPorts | ForEach-Object { "http://localhost:$_" }
      $corsPorts += "http://127.0.0.1:$WebPort"
      $corsValue = $corsPorts -join ","
      $envContent = @"
DATABASE_URL="file:./dev.db"
JWT_SECRET="dreamchord-local-dev-secret"
PORT=3001
CORS_ORIGIN="$corsValue"
UPLOAD_DIR="./uploads"
"@
      Set-Content -Path $envPath -Value $envContent -Encoding UTF8
      Write-Ok "已创建 apps\server\.env"
    }
  } else {
    Write-Ok ".env 已存在"
  }

  # 更新 CORS_ORIGIN 以包含所有可能的前端端口
  $envContent = Get-Content -Raw $envPath
  $corsPorts = @()
  foreach ($port in $PreferredWebPorts) {
    $corsPorts += "http://localhost:$port"
    $corsPorts += "http://127.0.0.1:$port"
  }
  $corsPorts += "http://localhost:4173"
  $corsValue = ($corsPorts | Sort-Object -Unique) -join ","

  if ($envContent -match 'CORS_ORIGIN=.*') {
    $envContent = $envContent -replace 'CORS_ORIGIN=.*', "CORS_ORIGIN=`"$corsValue`""
    Set-Content -Path $envPath -Value $envContent -Encoding UTF8 -NoNewline
    Write-Ok "已更新 CORS_ORIGIN 以支持所有前端端口"
  }
}

# ═══════════════════════════════════════════
# 数据库初始化
# ═══════════════════════════════════════════

function Ensure-Database {
  param([bool]$UsePnpm)

  $dbPath = Join-Path $ServerDir "prisma\dev.db"
  $generatedPath = Join-Path $ServerDir "src\generated"

  $needInit = $false
  if (-not (Test-Path $dbPath)) {
    Write-Warn "数据库文件不存在 (首次运行)"
    $needInit = $true
  }
  if (-not (Test-Path $generatedPath)) {
    Write-Warn "Prisma 客户端未生成"
    $needInit = $true
  }

  if (-not $needInit) {
    Write-Ok "数据库已存在，跳过初始化"
    return
  }

  Write-Step "初始化数据库"

  Push-Location $ServerDir

  # 1. 生成 Prisma 客户端
  Write-Host "  [1/3] 生成 Prisma 客户端..." -ForegroundColor Gray
  if ($UsePnpm) {
    pnpm prisma generate 2>&1 | Out-Host
  } else {
    npx prisma generate 2>&1 | Out-Host
  }
  if ($LASTEXITCODE -ne 0) {
    Pop-Location
    throw "prisma generate 失败"
  }
  Write-Ok "Prisma 客户端已生成"

  # 2. 应用数据库迁移（deploy 模式，非交互式，直接执行已有迁移文件）
  Write-Host "  [2/3] 创建数据库表结构..." -ForegroundColor Gray
  if ($UsePnpm) {
    pnpm prisma migrate deploy 2>&1 | Out-Host
  } else {
    npx prisma migrate deploy 2>&1 | Out-Host
  }
  if ($LASTEXITCODE -ne 0) {
    # migrate deploy 可能失败（数据库状态不一致），回退到 db push
    Write-Warn "migrate deploy 失败，尝试 db push..."
    if ($UsePnpm) {
      pnpm prisma db push 2>&1 | Out-Host
    } else {
      npx prisma db push 2>&1 | Out-Host
    }
    if ($LASTEXITCODE -ne 0) {
      Pop-Location
      throw "数据库迁移失败"
    }
  }
  Write-Ok "数据库表结构已创建"

  # 3. 插入种子数据
  Write-Host "  [3/3] 插入演示数据..." -ForegroundColor Gray
  if ($UsePnpm) {
    pnpm prisma db seed 2>&1 | Out-Host
  } else {
    npx prisma db seed 2>&1 | Out-Host
  }
  if ($LASTEXITCODE -ne 0) {
    Pop-Location
    throw "prisma db seed 失败"
  }
  Write-Ok "演示数据已插入 (账号: demo / demo123)"

  Pop-Location
}

# ═══════════════════════════════════════════
# 启动服务
# ═══════════════════════════════════════════

function Start-CmdWindow {
  param(
    [string]$Title,
    [string]$WorkingDirectory,
    [string[]]$CommandParts
  )

  $script = @(
    "title $Title",
    "cd /d ""$WorkingDirectory""",
    ($CommandParts -join " ")
  ) -join " && "

  Start-Process -FilePath "cmd.exe" -ArgumentList "/k", $script -WorkingDirectory $WorkingDirectory
}

# ═══════════════════════════════════════════
# 主流程
# ═══════════════════════════════════════════

Write-Host ""
Write-Host "============================================" -ForegroundColor Magenta
Write-Host "  DreamChord 一键启动" -ForegroundColor Magenta
Write-Host "  像写小说一样创作，像玩游戏一样阅读" -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "项目路径: $ProjectRoot"

# 1. 检查项目目录
Write-Step "检查项目目录"
if (-not (Test-Path $ServerDir)) { throw "缺少目录: $ServerDir" }
if (-not (Test-Path $WebDir)) { throw "缺少目录: $WebDir" }
if (-not (Test-Path (Join-Path $ServerDir "prisma\schema.prisma"))) { throw "缺少文件: prisma\schema.prisma" }
Write-Ok "项目目录结构正常"

# 2. 检查 Node.js
$usePnpm = Check-NodeJS

# 3. 安装依赖
Write-Step "检查依赖"
Ensure-Dependencies -UsePnpm $usePnpm

# 4. 配置环境变量
Write-Step "配置环境变量"
Ensure-EnvFile -WebPort $PreferredWebPorts[0]

# 5. 初始化数据库
Write-Step "检查数据库"
Ensure-Database -UsePnpm $usePnpm

# 6. 处理端口冲突
Write-Step "检查端口"
if (Test-PortListening -Port $ServerPort) {
  Stop-PortOwner -Port $ServerPort
}
$WebPort = Resolve-WebPort
Write-Ok "后端端口: $ServerPort"
Write-Ok "前端端口: $WebPort"

# 7. 启动服务
Write-Step "启动后端和前端"

Start-CmdWindow `
  -Title "DreamChord Backend (port $ServerPort)" `
  -WorkingDirectory $ServerDir `
  -CommandParts @("set", "PORT=$ServerPort&&", "npm", "run", "dev")

Start-CmdWindow `
  -Title "DreamChord Frontend (port $WebPort)" `
  -WorkingDirectory $WebDir `
  -CommandParts @("npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "$WebPort", "--strictPort")

# 8. 等待服务就绪
Write-Step "等待服务启动"
Wait-HttpReady -Url "http://127.0.0.1:$ServerPort/api/health" -Name "后端"
Wait-HttpReady -Url "http://127.0.0.1:$WebPort" -Name "前端"

# 9. 打开浏览器
$HomeUrl = "http://127.0.0.1:$WebPort"
Write-Step "打开浏览器"
Start-Process $HomeUrl

# 10. 完成
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  DreamChord 已启动!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  前端: $HomeUrl"
Write-Host "  后端: http://127.0.0.1:$ServerPort"
Write-Host "  演示账号: demo / demo123"
Write-Host ""
Write-Host "  关闭后端和前端的命令行窗口即可停止服务" -ForegroundColor Gray
Write-Host ""
