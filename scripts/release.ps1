param(
  [Parameter(Mandatory = $true)]
  [string]$Version
)

$ErrorActionPreference = "Stop"

function Update-ManifestVersion {
  param(
    [string]$Path,
    [string]$NewVersion
  )

  $manifest = Get-Content -Raw -Path $Path | ConvertFrom-Json
  $manifest.version = $NewVersion
  $manifest | ConvertTo-Json -Depth 10 | Set-Content -Path $Path -Encoding UTF8
}

function Update-ReadmeVersion {
  param(
    [string]$Path,
    [string]$NewVersion
  )

  $content = Get-Content -Raw -Path $Path
  $updated = [regex]::Replace(
    $content,
    '(?m)^- `\d+\.\d+\.\d+`$',
    ('- `' + $NewVersion + '`'),
    1
  )

  Set-Content -Path $Path -Value $updated -Encoding UTF8
}

function Update-Changelog {
  param(
    [string]$Path,
    [string]$NewVersion
  )

  $content = Get-Content -Raw -Path $Path
  $escapedVersion = [regex]::Escape($NewVersion)

  if ($content -match ('(?m)^## ' + $escapedVersion + '$')) {
    return
  }

  $header = @"
# Changelog

## $NewVersion

- TODO: descreva as mudancas desta versao

"@

  $existing = $content -replace '^# Changelog\s*\r?\n\r?\n', ''
  $updated = $header + $existing.TrimStart()
  Set-Content -Path $Path -Value $updated -Encoding UTF8
}

$root = Split-Path -Parent $PSScriptRoot

Update-ManifestVersion -Path (Join-Path $root "manifest.json") -NewVersion $Version
Update-ReadmeVersion -Path (Join-Path $root "README.md") -NewVersion $Version
Update-Changelog -Path (Join-Path $root "CHANGELOG.md") -NewVersion $Version

Write-Output "Version files updated to $Version"
