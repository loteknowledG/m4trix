param(
  [Parameter(Mandatory=$true, Position=0)]
  [string]$Text
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$say = Join-Path $root 'say.ps1'

if (-not (Test-Path $say)) {
  throw "Could not find say.ps1 at $say"
}

# Keep Jeena defaults for this skill invocation unless caller already set them.
if (-not $env:BOOTUP_VOICE) { $env:BOOTUP_VOICE = 'en-US-JennyNeural' }
if (-not $env:BOOTUP_TTS_RATE) { $env:BOOTUP_TTS_RATE = '-19%' }
if (-not $env:BOOTUP_TTS_PITCH) { $env:BOOTUP_TTS_PITCH = '-9Hz' }
if (-not $env:BOOTUP_TTS_VOLUME) { $env:BOOTUP_TTS_VOLUME = '+2%' }

& $say $Text
