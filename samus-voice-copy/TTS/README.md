TTS (self-contained)
======================

This folder is a self-contained bundle of the repo's text-to-speech helpers.

Quick commands

- Start persistent TTS server:
  python TTS/tts_server.py

- Say text (uses persistent server when available, otherwise pyttsx3):
  python -c "from TTS import speak; print(speak('hello'))"
  or
  python TTS/demo_tts.py

- List cloud voices (optional, requires `edge-tts`):
  python TTS/edge_tts.py --list --locale en-US

Notes
- Models (Vosk) and temporary files are kept under `TTS/models/` and the
  package prefers local paths so the folder is runnable independently.

Further reading — realistic TTS packages
- See `TTS/REALISTIC_TTS.md` (summary + links) for a practical survey of Python
  TTS packages and cloud options: https://smallest.ai/blog/python-packages-realistic-text-to-speech
  (includes quick experiment steps for `edge-tts`, `pyttsx3`, and others).

Piper (OHF-Voice)
- Piper is an open‑source, GPL‑licensed neural TTS project. See `TTS/PIPER.md` for a
  local‑experiment guide and `TTS/clone_piper.ps1` for a convenience clone helper.
  Upstream repo: https://github.com/OHF-Voice/piper1-gpl
