param(
  [Parameter(Mandatory = $true)]
  [string]$EnvPath,
  [Parameter(Mandatory = $true)]
  [string]$SchemaPath
)

$ErrorActionPreference = 'Stop'

$content = Get-Content -Raw -Encoding UTF8 -LiteralPath $EnvPath
$match = [Regex]::Match(
  $content,
  '(?m)^\s*DATABASE_URL\s*=\s*(?<quote>["'']?)(?<url>file:[^\r\n]*?)\k<quote>\s*$'
)
if (-not $match.Success) { throw 'DATABASE_URL must be a local file: SQLite URL before schema synchronization' }

$databaseUrl = $match.Groups['url'].Value.Trim()
$absoluteUri = $null
$pathValue = if (
  [Uri]::TryCreate($databaseUrl, [UriKind]::Absolute, [ref]$absoluteUri) -and
  $absoluteUri.IsFile
) {
  $absoluteUri.LocalPath
} else {
  $relativePath = $databaseUrl.Substring('file:'.Length)
  $queryIndex = $relativePath.IndexOf('?')
  if ($queryIndex -ge 0) { $relativePath = $relativePath.Substring(0, $queryIndex) }
  [Uri]::UnescapeDataString($relativePath)
}
if ([string]::IsNullOrWhiteSpace($pathValue)) { throw 'DATABASE_URL does not contain a SQLite file path' }

$schemaDirectory = Split-Path -Parent (Resolve-Path -LiteralPath $SchemaPath)
$DatabasePath = if ([System.IO.Path]::IsPathRooted($pathValue)) {
  [System.IO.Path]::GetFullPath($pathValue)
} else {
  [System.IO.Path]::GetFullPath((Join-Path $schemaDirectory $pathValue))
}

if (-not (Test-Path -LiteralPath $DatabasePath)) { exit 0 }
$database = Get-Item -LiteralPath $DatabasePath
if ($database.Length -eq 0) { exit 0 }

$backupDirectory = Join-Path $database.DirectoryName 'backups'
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
$databaseName = [Regex]::Replace(
  [System.IO.Path]::GetFileNameWithoutExtension($database.Name),
  '[^A-Za-z0-9_-]',
  '-'
)
$normalizedDatabasePath = $DatabasePath.Replace('/', '\').TrimEnd('\').ToLowerInvariant()
$pathHasher = [System.Security.Cryptography.SHA256]::Create()
try {
  $pathBytes = [System.Text.Encoding]::UTF8.GetBytes($normalizedDatabasePath)
  $pathHash = [System.BitConverter]::ToString($pathHasher.ComputeHash($pathBytes)).Replace('-', '').ToLowerInvariant()
} finally {
  $pathHasher.Dispose()
}
$pathTag = $pathHash.Substring(0, 16)
$schemaHash = (Get-FileHash -LiteralPath $SchemaPath -Algorithm SHA256).Hash.ToLowerInvariant()
$schemaTag = $schemaHash.Substring(0, 16)
$schemaPattern = "$databaseName-$pathTag-before-schema-$schemaTag-*.db"
$existing = Get-ChildItem -LiteralPath $backupDirectory -File -Filter $schemaPattern |
  Sort-Object LastWriteTimeUtc -Descending |
  Select-Object -First 1
if ($existing) {
  if ($existing.Length -eq 0) { throw "Existing schema backup is empty: $($existing.FullName)" }
  Write-Output $existing.FullName
  exit 0
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$backupPath = Join-Path $backupDirectory "$databaseName-$pathTag-before-schema-$schemaTag-$timestamp.db"
Copy-Item -LiteralPath $database.FullName -Destination $backupPath
$sourceHash = (Get-FileHash -LiteralPath $database.FullName -Algorithm SHA256).Hash
$backupHash = (Get-FileHash -LiteralPath $backupPath -Algorithm SHA256).Hash
if ($sourceHash -ne $backupHash) {
  Remove-Item -LiteralPath $backupPath -Force
  throw 'SQLite backup verification failed; schema synchronization was cancelled'
}

$backups = Get-ChildItem -LiteralPath $backupDirectory -File -Filter "$databaseName-$pathTag-before-schema-*.db" |
  Sort-Object LastWriteTimeUtc -Descending
$backups | Select-Object -Skip 5 | ForEach-Object {
  if ($_.DirectoryName -ne $backupDirectory) { throw "Unsafe backup cleanup target: $($_.FullName)" }
  Remove-Item -LiteralPath $_.FullName -Force
}

Write-Output $backupPath
