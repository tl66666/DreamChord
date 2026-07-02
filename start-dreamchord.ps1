# DreamChord one-click launcher.
# Double-click start-dreamchord.bat from the project folder.

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerDir = Join-Path $ProjectRoot "apps\server"
$WebDir = Join-Path $ProjectRoot "apps\web"
$ServerPort = 3001
$PreferredWebPorts = @(5173, 5174, 5175, 5176)

function Write-Step {
  param([string]$Text)
  Write-Host ""
  Write-Host "==> $Text" -ForegroundColor Cyan
}

function Write-Ok {
  param([string]$Text)
  Write-Host "OK  $Text" -ForegroundColor Green
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
      Write-Host "Port $Port is used by PID $ownerPid ($($proc.ProcessName)); stopping it..." -ForegroundColor Yellow
      Stop-Process -Id $ownerPid -Force -ErrorAction Stop
      Start-Sleep -Milliseconds 600
    } catch {
      Write-Host "Could not stop PID $ownerPid on port ${Port}: $($_.Exception.Message)" -ForegroundColor Yellow
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
  throw "No usable frontend port found. Checked: $($PreferredWebPorts -join ', ')"
}

function Wait-HttpReady {
  param(
    [string]$Url,
    [string]$Name,
    [int]$TimeoutSeconds = 45
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        Write-Ok "$Name ready: $Url"
        return
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }
  throw "$Name did not become ready in $TimeoutSeconds seconds: $Url"
}

function Ensure-EnvFile {
  $envPath = Join-Path $ServerDir ".env"
  $examplePath = Join-Path $ServerDir ".env.example"
  if (-not (Test-Path $envPath) -and (Test-Path $examplePath)) {
    Copy-Item $examplePath $envPath
    Write-Ok "Created apps\server\.env from .env.example"
  }
}

function Ensure-Dependencies {
  if (-not (Test-Path (Join-Path $WebDir "node_modules"))) {
    Write-Step "Installing frontend dependencies"
    Push-Location $WebDir
    npm install
    Pop-Location
  }

  if (-not (Test-Path (Join-Path $ServerDir "node_modules"))) {
    Write-Step "Installing backend dependencies"
    Push-Location $ServerDir
    npm install
    Pop-Location
  }
}

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

Write-Host "DreamChord one-click launcher" -ForegroundColor Magenta
Write-Host "Project: $ProjectRoot"

Write-Step "Checking project folders"
if (-not (Test-Path $ServerDir)) { throw "Missing folder: $ServerDir" }
if (-not (Test-Path $WebDir)) { throw "Missing folder: $WebDir" }
Write-Ok "Project folders found"

Ensure-EnvFile
Ensure-Dependencies

Write-Step "Handling port conflicts"
if (Test-PortListening -Port $ServerPort) {
  Stop-PortOwner -Port $ServerPort
}
$WebPort = Resolve-WebPort
Write-Ok "Backend port: $ServerPort"
Write-Ok "Frontend port: $WebPort"

Write-Step "Starting backend and frontend"
Start-CmdWindow `
  -Title "DreamChord Backend $ServerPort" `
  -WorkingDirectory $ServerDir `
  -CommandParts @("set", "PORT=$ServerPort&&", "npm", "run", "dev")

Start-CmdWindow `
  -Title "DreamChord Frontend $WebPort" `
  -WorkingDirectory $WebDir `
  -CommandParts @("npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "$WebPort", "--strictPort")

Write-Step "Waiting for services"
Wait-HttpReady -Url "http://127.0.0.1:$ServerPort/api/health" -Name "Backend"
Wait-HttpReady -Url "http://127.0.0.1:$WebPort" -Name "Frontend"

$HomeUrl = "http://127.0.0.1:$WebPort"
Write-Step "Opening browser"
Start-Process $HomeUrl

Write-Host ""
Write-Host "DreamChord is ready." -ForegroundColor Green
Write-Host "Frontend: $HomeUrl"
Write-Host "Backend:  http://127.0.0.1:$ServerPort"
Write-Host ""
Write-Host "Close the Backend and Frontend command windows to stop services."
