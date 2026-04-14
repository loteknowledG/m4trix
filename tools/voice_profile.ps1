param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Profile,
  [switch]$Speak,
  [string[]]$Text,
  [string]$Rate,
  [string]$Pitch,
  [string]$Volume
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$py = Join-Path $root 'tools\voice_profile.py'

if (-not (Test-Path $py)) {
  throw "Could not find voice_profile.py at $py"
}

$profileJson = & python $py show $Profile
if ($LASTEXITCODE -ne 0) {
  throw "voice_profile.py failed for profile '$Profile'"
}

$profile = $profileJson | ConvertFrom-Json

if ($profile.PSObject.Properties.Name -contains 'bootup_ai_name' -and $profile.bootup_ai_name) {
  $env:BOOTUP_AI_NAME = $profile.bootup_ai_name
}
if ($profile.PSObject.Properties.Name -contains 'bootup_voice' -and $profile.bootup_voice) {
  $env:BOOTUP_VOICE = $profile.bootup_voice
}
if ($profile.PSObject.Properties.Name -contains 'bootup_tts_rate' -and $profile.bootup_tts_rate) {
  $env:BOOTUP_TTS_RATE = $profile.bootup_tts_rate
} else {
  Remove-Item Env:BOOTUP_TTS_RATE -ErrorAction SilentlyContinue
}
if ($profile.PSObject.Properties.Name -contains 'bootup_tts_pitch' -and $profile.bootup_tts_pitch) {
  $env:BOOTUP_TTS_PITCH = $profile.bootup_tts_pitch
} else {
  Remove-Item Env:BOOTUP_TTS_PITCH -ErrorAction SilentlyContinue
}
if ($profile.PSObject.Properties.Name -contains 'bootup_tts_volume' -and $profile.bootup_tts_volume) {
  $env:BOOTUP_TTS_VOLUME = $profile.bootup_tts_volume
} else {
  Remove-Item Env:BOOTUP_TTS_VOLUME -ErrorAction SilentlyContinue
}

Write-Host "[VOICE] Profile loaded: $($profile.profile)"
Write-Host "[VOICE] AI name: $($env:BOOTUP_AI_NAME)"
Write-Host "[VOICE] Voice: $($env:BOOTUP_VOICE)"
if ($env:BOOTUP_TTS_RATE -or $env:BOOTUP_TTS_PITCH -or $env:BOOTUP_TTS_VOLUME) {
  Write-Host "[VOICE] Rate: $($env:BOOTUP_TTS_RATE) Pitch: $($env:BOOTUP_TTS_PITCH) Volume: $($env:BOOTUP_TTS_VOLUME)"
}

if ($Speak) {
  if (-not $Text -or $Text.Count -eq 0) {
    throw "Use -Text with -Speak, for example: .\tools\voice_profile.ps1 -Profile jenny-neural -Speak -Text 'Hello'"
  }

  $args = @('speak', $Profile)
  if ($Rate) { $args += @('--rate', $Rate) }
  if ($Pitch) { $args += @('--pitch', $Pitch) }
  if ($Volume) { $args += @('--volume', $Volume) }
  $args += $Text
  & python $py @args
  exit $LASTEXITCODE
}
