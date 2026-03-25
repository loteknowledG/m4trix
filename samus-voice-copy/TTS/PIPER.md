Piper (OHF-Voice/piper1-gpl)
=============================

Repository:
- https://github.com/OHF-Voice/piper1-gpl

What this is
- An open-source (GPL‑licensed) neural text‑to‑speech implementation maintained by the OHF‑Voice community.
- Provides higher‑quality, model‑based TTS engines you can run locally; see the upstream README for exact model/build instructions.

How to add Piper into this `TTS/` folder
1. Clone the upstream repository into this folder:
   ```powershell
   git clone https://github.com/OHF-Voice/piper1-gpl TTS/piper1-gpl
   ```
2. Follow the upstream build & model download steps (see `TTS/piper1-gpl/README.md`).

License note ⚠️
- Piper is GPL‑licensed; embedding or redistributing the Piper code or its models may carry GPL obligations. Review the upstream license before redistributing or bundling Piper inside other distributions.

Integration notes
- This project does **not** vendor Piper by default — `PIPER.md` is a pointer + helper to make experimentation easier.
- After cloning + building, you can call Piper from `TTS/` scripts or add a bridge that converts text → WAV and then plays it with the existing playback helpers in this folder.

Helpful helper script
- See `TTS/clone_piper.ps1` for a convenience clone helper (PowerShell).

Upstream docs
- Always consult the upstream repository for the most accurate usage and building instructions.