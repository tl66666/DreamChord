param([string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot))

$failed = $false
function Pass([string]$Message) { Write-Host "[PASS] $Message" -ForegroundColor Green }
function Warn([string]$Message) { Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Fail([string]$Message) { $script:failed = $true; Write-Host "[FAIL] $Message" -ForegroundColor Red }

Write-Host "DreamChord Doctor`nRoot: $ProjectRoot"

foreach ($relativePath in @('package.json', 'pnpm-lock.yaml', 'apps\web\package.json', 'apps\server\package.json', 'apps\server\prisma\schema.prisma')) {
  if (Test-Path (Join-Path $ProjectRoot $relativePath)) { Pass "found $relativePath" }
  else { Fail "missing $relativePath" }
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Fail 'Node.js is not installed (Node.js 20+ required)' }
else {
  $version = node --version
  $major = [int]($version -replace '^v(\d+).*', '$1')
  if ($major -ge 20) { Pass "Node.js $version" } else { Fail "Node.js $version is below 20" }
}

if (Get-Command pnpm -ErrorAction SilentlyContinue) { Pass "pnpm $(pnpm --version)" }
elseif (Get-Command corepack -ErrorAction SilentlyContinue) { Warn 'pnpm is not active; launcher will enable pnpm 9.1.0 with Corepack' }
else { Fail 'neither pnpm nor Corepack is available' }

$envPath = Join-Path $ProjectRoot 'apps\server\.env'
if (Test-Path $envPath) {
  $envText = Get-Content -Raw -LiteralPath $envPath
  if ($envText -match '(?m)^JWT_SECRET="?(.{16,})"?$') { Pass 'JWT_SECRET is configured' }
  else { Fail 'JWT_SECRET is missing or shorter than 16 characters' }
} else { Warn 'apps\server\.env is absent; launcher will create it' }

foreach ($port in @(3001, 5173)) {
  $connection = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($connection) { Warn "port $port is occupied; launcher will choose another port" }
  else { Pass "port $port is available" }
}

if ($failed) { exit 1 }
exit 0
