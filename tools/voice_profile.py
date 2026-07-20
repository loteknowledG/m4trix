#!/usr/bin/env python
"""Voice-profile helper for m4trix."""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VOICE_PROFILE_TIMEOUT_SEC = float(os.environ.get("VOICE_PROFILE_TIMEOUT_SEC", "120"))

PROFILES = {
    "jenna-jacket": {
        "profile": "jenna-jacket",
        "label": "Jenna Jacket",
        "bootup_ai_name": "Jeena Jacket",
        "bootup_voice": "en-US-JennyNeural",
        "bootup_tts_rate": "-19%",
        "bootup_tts_pitch": "-9Hz",
        "bootup_tts_volume": "+2%",
        "description": "Friendly default operator voice for the desktop agent.",
    },
    "jenny-neural": {
        "profile": "jenny-neural",
        "label": "Jenny Neural",
        "bootup_ai_name": "Jenny Neural",
        "bootup_voice": "en-US-JennyNeural",
        "bootup_tts_rate": "-5%",
        "bootup_tts_pitch": "-2Hz",
        "bootup_tts_volume": "+0%",
        "description": "Cleaner voice-forward mode with lighter stylization.",
    },
    "muthur": {
        "profile": "muthur",
        "label": "MUTHUR",
        "bootup_ai_name": "MUTHUR 6000",
        "bootup_voice": "en-US-AriaNeural",
        "bootup_tts_rate": "-12%",
        "bootup_tts_pitch": "-5Hz",
        "bootup_tts_volume": "+0%",
        "description": "Calm, lower, system-like voice for MUTHUR.",
    },
}

ALIASES = {
    "jenna": "jenna-jacket",
    "jeena": "jenna-jacket",
    "jeena-neural": "jenny-neural",
    "jeeny": "jenny-neural",
    "jeeny-neural": "jenny-neural",
    "jacket": "jenna-jacket",
    "jenny": "jenny-neural",
    "mother": "muthur",
    "mu-thur": "muthur",
    "muthur-6000": "muthur",
    "neural": "jenny-neural",
}

_DEFAULT_MUTHUR_REVERB_AF = (
    "highpass=f=120,equalizer=f=4200:width_type=h:width=2000:g=2,"
    "lowpass=f=10000,aecho=0.92:0.88:34|58|82:0.1|0.07|0.05,"
    "aecho=0.97:0.9:115:0.14,extrastereo=m=0.35,volume=0.95"
)


def resolve_profile(name: str) -> dict:
    key = ALIASES.get((name or "").strip().lower(), (name or "").strip().lower())
    if key not in PROFILES:
        raise KeyError(f"Unknown voice profile: {name}")
    return PROFILES[key]


def profile_env(profile: dict, rate: str | None = None, pitch: str | None = None,
                volume: str | None = None) -> dict[str, str]:
    return {
        "BOOTUP_AI_NAME": profile["bootup_ai_name"],
        "BOOTUP_VOICE": profile["bootup_voice"],
        "BOOTUP_TTS_RATE": rate if rate not in (None, "") else profile["bootup_tts_rate"],
        "BOOTUP_TTS_PITCH": pitch if pitch not in (None, "") else profile["bootup_tts_pitch"],
        "BOOTUP_TTS_VOLUME": volume if volume not in (None, "") else profile["bootup_tts_volume"],
    }


def _wet_mp3_with_reverb(src_path: str) -> str | None:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return None
    fd, wet_path = tempfile.mkstemp(suffix=".mp3")
    os.close(fd)
    try:
        result = subprocess.run(
            [ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", src_path,
             "-af", os.environ.get("VOICE_PROFILE_REVERB_AF", _DEFAULT_MUTHUR_REVERB_AF),
             "-acodec", "libmp3lame", "-q:a", "3", wet_path],
            capture_output=True,
            timeout=int(VOICE_PROFILE_TIMEOUT_SEC),
        )
        if result.returncode == 0:
            return wet_path
    except (OSError, subprocess.SubprocessError, ValueError):
        pass
    try:
        os.remove(wet_path)
    except OSError:
        pass
    return None


async def _render(text: str, voice: str, rate: str | None, pitch: str | None,
                  volume: str | None, profile_key: str | None = None) -> bytes | None:
    try:
        import edge_tts
    except Exception as exc:
        print(f"[VOICE] Missing audio dependency: {exc}", file=sys.stderr)
        return None

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
        out_path = tmp.name
    wet_path: str | None = None
    try:
        communicate = edge_tts.Communicate(
            text, voice, rate=rate or "", pitch=pitch or "", volume=volume or ""
        )
        await asyncio.wait_for(communicate.save(out_path), timeout=VOICE_PROFILE_TIMEOUT_SEC)
        play_path = out_path
        reverb_enabled = os.environ.get("VOICE_PROFILE_REVERB", "1").lower() not in {
            "0", "false", "no", "off"
        }
        if profile_key == "muthur" and reverb_enabled:
            wet_path = _wet_mp3_with_reverb(out_path)
            if wet_path:
                play_path = wet_path
        with open(play_path, "rb") as audio_file:
            return audio_file.read()
    except Exception as exc:
        print(f"[VOICE] Rendering failed: {exc}", file=sys.stderr)
        return None
    finally:
        for candidate in (out_path, wet_path):
            if candidate:
                try:
                    os.remove(candidate)
                except OSError:
                    pass


def _speak_native(text: str, voice_name: str | None = None) -> bool:
    try:
        import pyttsx3
        engine = pyttsx3.init()
        if voice_name:
            for voice in engine.getProperty("voices"):
                if voice_name.lower() in f"{voice.id} {getattr(voice, 'name', '')}".lower():
                    engine.setProperty("voice", voice.id)
                    break
        engine.say(text)
        engine.runAndWait()
        engine.stop()
        return True
    except Exception as exc:
        print(f"[VOICE] Native speech failed: {exc}", file=sys.stderr)
        return False


def list_profiles() -> int:
    for name, profile in PROFILES.items():
        print(f"{name:14} -> {profile['bootup_ai_name']} / {profile['bootup_voice']}")
        print(f"  {profile['description']}")
    return 0


def show_profile(profile_name: str) -> int:
    print(json.dumps(resolve_profile(profile_name), indent=2))
    return 0


def emit_profile(profile_name: str, shell: str, rate: str | None = None,
                 pitch: str | None = None, volume: str | None = None) -> int:
    env = profile_env(resolve_profile(profile_name), rate, pitch, volume)
    if shell.lower() in ("ps1", "powershell", "pwsh"):
        for key, value in env.items():
            print(f"$Env:{key} = '{value}'")
    elif shell.lower() in ("bash", "sh"):
        for key, value in env.items():
            print(f"export {key}='{value}'")
    elif shell.lower() == "json":
        print(json.dumps(env, indent=2))
    else:
        raise ValueError(f"Unsupported shell: {shell}")
    return 0


def render_profile(profile_name: str, text: str, rate: str | None = None,
                   pitch: str | None = None, volume: str | None = None) -> int:
    profile = resolve_profile(profile_name)
    env = profile_env(profile, rate, pitch, volume)
    audio = asyncio.run(_render(
        text, env["BOOTUP_VOICE"], env["BOOTUP_TTS_RATE"], env["BOOTUP_TTS_PITCH"],
        env["BOOTUP_TTS_VOLUME"], profile["profile"]
    ))
    if not audio:
        return 1
    print(base64.b64encode(audio).decode("ascii"))
    return 0


def speak_profile(profile_name: str, text: str, **_kwargs: str | None) -> int:
    profile = resolve_profile(profile_name)
    return 0 if _speak_native(text, "zira" if sys.platform.startswith("win") else None) else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Voice profile helper for m4trix")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list").set_defaults(func=lambda args: list_profiles())
    p = sub.add_parser("show")
    p.add_argument("profile")
    p.set_defaults(func=lambda args: show_profile(args.profile))
    p = sub.add_parser("emit")
    p.add_argument("profile")
    p.add_argument("--shell", default="powershell")
    p.add_argument("--rate")
    p.add_argument("--pitch")
    p.add_argument("--volume")
    p.set_defaults(func=lambda args: emit_profile(args.profile, args.shell, args.rate, args.pitch, args.volume))
    for command, handler in (("render", render_profile), ("speak", speak_profile)):
        p = sub.add_parser(command)
        p.add_argument("profile")
        p.add_argument("--rate")
        p.add_argument("--pitch")
        p.add_argument("--volume")
        p.add_argument("--text")
        p.set_defaults(func=lambda args, h=handler: h(
            args.profile, (args.text or "").strip() or sys.stdin.read().strip(),
            rate=args.rate, pitch=args.pitch, volume=args.volume
        ))
    args = parser.parse_args()
    try:
        return int(args.func(args))
    except (KeyError, ValueError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
