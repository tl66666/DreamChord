param(
  [Parameter(Mandatory = $true)]
  [string]$EnvPath,
  [Parameter(Mandatory = $true)]
  [int]$ServerPort,
  [Parameter(Mandatory = $true)]
  [int]$WebPort
)

$ErrorActionPreference = 'Stop'

function Set-EnvValue {
  param(
    [string]$Content,
    [string]$Key,
    [string]$Value,
    [switch]$Always
  )

  $escapedKey = [Regex]::Escape($Key)
  $linePattern = "(?m)^\s*$escapedKey\s*=.*$"
  $blankPattern = "(?m)^\s*$escapedKey\s*=\s*(?:`"`"\s*)?$"
  $line = "$Key=$Value"

  if ($Content -match $linePattern) {
    if ($Always -or $Content -match $blankPattern) {
      return [Regex]::Replace($Content, $linePattern, $line, 1)
    }
    return $Content
  }

  if ($Content.Length -gt 0 -and -not $Content.EndsWith("`n")) {
    $Content += "`n"
  }
  return $Content + $line + "`n"
}

$content = if (Test-Path -LiteralPath $EnvPath) {
  Get-Content -Raw -Encoding UTF8 -LiteralPath $EnvPath
} else {
  ''
}

$content = Set-EnvValue $content 'DATABASE_URL' '"file:./dev.db"'
$content = Set-EnvValue $content 'JWT_SECRET' "`"dreamchord-local-$([Guid]::NewGuid().ToString('N'))`""
$content = Set-EnvValue $content 'UPLOAD_DIR' '"./uploads"'
$content = Set-EnvValue $content 'PORT' $ServerPort -Always
$cors = "`"http://127.0.0.1:$WebPort,http://localhost:$WebPort`""
$content = Set-EnvValue $content 'CORS_ORIGIN' $cors -Always

$utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($EnvPath, $content, $utf8WithoutBom)
