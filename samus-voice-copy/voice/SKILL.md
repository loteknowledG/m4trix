# Voice Skill

## Purpose
Speech output (TTS) and optional speech input loop.

## Entry Points
- `powershell -ExecutionPolicy Bypass -File .\say.ps1 "text"`
- `python skills\voice\voice_loop.py`
- `python tools\voice_bridge.py`

## Common Commands
- Speak (fast/native fallback): `powershell -ExecutionPolicy Bypass -File .\say.ps1 "Hello"`
- Start voice loop: `python skills\voice\voice_loop.py`
- Read latest hearing lines: `powershell -ExecutionPolicy Bypass -File .\hear.ps1`

## Boot Integration
- `ai_bootup.py` can auto-start voice and hearing bridge.
- Disable at boot with:
  - `BOOTUP_ENABLE_VOICE=0`
  - `BOOTUP_ENABLE_HEARING=0`
