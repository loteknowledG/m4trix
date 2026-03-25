#!/usr/bin/env python3
"""Tiny helper to list and synthesize voices using the unofficial `edge-tts` client.

Usage:
  # list all voices (filter by locale)
  python tools/edge_tts.py --list --locale nb-NO

  # synth and play (defaults to nb-NO-HeddaNeural if available)
  python tools/edge_tts.py --voice nb-NO-HeddaNeural "Hei — jeg heter Hanna"

Notes:
- `pip install edge-tts` to enable. This tool is optional and falls back gracefully when `edge-tts` isn't installed.
- Output is written to a temporary MP3 and opened with the system default player.
"""
from __future__ import annotations
import argparse
import asyncio
import os
import sys
import tempfile
import subprocess


async def _list_voices(locale: str | None = None):
    try:
        from edge_tts import VoicesManager
    except Exception as e:
        print('edge-tts not installed. Run: pip install edge-tts')
        return 2
    vm = VoicesManager()
    voices = await vm.get_voices()
    for v in voices:
        try:
            v_locale = v.get('Locale') or v.get('locale') or ''
            if locale and (v_locale.lower() != locale.lower()):
                continue
            name = v.get('Name') or v.get('VoiceName') or v.get('DisplayName') or ''
            short = v.get('ShortName') or v.get('Short_Id') or v.get('Id') or ''
            gender = v.get('Gender') or ''
            print(f"{short:30} | {name:40} | {v_locale:6} | {gender}")
        except Exception:
            print(v)
    return 0


async def _synth_and_play(text: str, voice: str | None = None, out_path: str | None = None):
    try:
        import edge_tts
    except Exception:
        print('edge-tts not installed. Run: pip install edge-tts')
        return 2

    out_path = out_path or os.path.join(tempfile.gettempdir(), f'edge_tts_{os.getpid()}.mp3')
    communicate = edge_tts.Communicate(text, voice or '')
    try:
        await communicate.save(out_path)
    except Exception as e:
        print('Synthesis failed:', e)
        return 3

    # Open the MP3 with the OS default player
    try:
        if sys.platform.startswith('win'):
            subprocess.run(['start', out_path], shell=True)
        elif sys.platform.startswith('darwin'):
            subprocess.run(['open', out_path])
        else:
            subprocess.run(['xdg-open', out_path])
    except Exception:
        print('Saved to:', out_path)
    return 0


def main():
    ap = argparse.ArgumentParser(prog='edge_tts', description='Edge TTS helper (optional)')
    ap.add_argument('--list', action='store_true', help='List available voices')
    ap.add_argument('--locale', help='Filter listed voices by locale (e.g. nb-NO)')
    ap.add_argument('--voice', help='Voice short name (e.g. nb-NO-HeddaNeural)')
    ap.add_argument('--out', help='Save output to this path (optional)')
    ap.add_argument('text', nargs='*', help='Text to synthesize')
    args = ap.parse_args()

    if args.list:
        code = asyncio.run(_list_voices(args.locale))
        sys.exit(code)

    if not args.text:
        ap.print_help()
        sys.exit(1)

    text = ' '.join(args.text)
    code = asyncio.run(_synth_and_play(text, voice=args.voice, out_path=args.out))
    sys.exit(code)


if __name__ == '__main__':
    main()
