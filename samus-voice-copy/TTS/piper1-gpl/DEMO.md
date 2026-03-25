Piper — quick demo & shortcuts
==============================

This file shows the fastest way to try Piper locally using the code and voice
already placed in `TTS/piper1-gpl/` in this repository.

Quick start (working from repo root)
-----------------------------------
1. Ensure the Python package is available (preferred: PyPI wheel):

   ```bash
   pip install piper-tts
   ```

2. Download an example voice (we used `en_US-lessac-medium`):

   ```bash
   python -m piper.download_voices en_US-lessac-medium --download-dir TTS/piper1-gpl/models
   ```

3. Run the packaged demo (writes WAV to the Piper folder):

   ```bash
   python TTS/piper1-gpl/run_demo_installed.py
   # -> writes: TTS/piper1-gpl/demo_installed.wav
   ```

4. Play the WAV on Windows (quick):

   ```powershell
   start TTS\piper1-gpl\demo_installed.wav
   # or (PowerShell):
   Invoke-Item TTS\piper1-gpl\demo_installed.wav
   ```

Python API (minimal example)
----------------------------
Create a small script or run interactively:

```python
from piper import PiperVoice
import wave

voice = PiperVoice.load('TTS/piper1-gpl/models/en_US-lessac-medium.onnx')
with wave.open('TTS/piper1-gpl/demo.wav', 'wb') as out:
    voice.synthesize_wav('Hello from Piper — local demo.', out)
```

Shortcuts included in this folder
---------------------------------
- `run_demo.py` — demo that uses the local source (for development).
- `run_demo_installed.py` — demo that uses the installed `piper` package (recommended).
- `clone_piper.ps1` — convenience helper to clone upstream `piper1-gpl` into this folder.
- `models/` — voice models downloaded by `piper.download_voices`.

GPU / performance
-----------------
- Use `PiperVoice.load(..., use_cuda=True)` to enable GPU (requires `onnxruntime-gpu`).

Troubleshooting
---------------
- If you see import errors for `espeakbridge` or errors building from source,
  install the packaged wheel (`pip install piper-tts`) instead of building locally.
- Building from source requires a C toolchain (CMake + MSVC on Windows) —
  see `docs/BUILDING.md` in the upstream repo.

License & notes
----------------
- Piper is **GPL**-licensed (see upstream `COPYING`). Review license obligations
  before redistributing Piper code or binaries.

Integration tips
----------------
- To integrate Piper output into this repo's TTS workflow, synthesize a WAV
  (`PiperVoice.synthesize_wav`) and then play it with your preferred player or
  script (e.g. `start` / `Invoke-Item` on Windows).

Want a wrapper that calls Piper and immediately plays audio from `TTS/`? I can
add a one-file helper (synthesize+play) next.