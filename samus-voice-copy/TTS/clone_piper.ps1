<#
PowerShell helper: clone the OHF-Voice Piper repo into this folder.
Usage:
  .\clone_piper.ps1
#>
$dest = Join-Path $PSScriptRoot 'piper1-gpl'
if (Test-Path $dest) {
  Write-Host "Directory already exists: $dest"
  exit 0
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Error 'git not found in PATH — install Git before running this script.'
  exit 2
}

$repo = 'https://github.com/OHF-Voice/piper1-gpl'
Write-Host "Cloning $repo → $dest"
git clone $repo $dest
if ($LASTEXITCODE -ne 0) {
  Write-Error 'git clone failed.'
  exit $LASTEXITCODE
}

Write-Host "Cloned into $dest. See TTS/PIPER.md and the upstream README for build/run instructions."