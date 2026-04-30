#!/usr/bin/env python
"""Voice profile helper for m4trix.

This is the Samus-Manus voice-profile pattern, trimmed to the pieces we need
here: a stable `jenny-neural` profile and a small CLI that can speak text.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
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
        # Base voice: calm Aria, slightly slowed + a touch lower (ship computer, not robot).
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
    "muthur": "muthur",
}


def resolve_profile(name: str) -> dict:
    key = (name or "").strip().lower()
    key = ALIASES.get(key, key)
    if key not in PROFILES:
        raise KeyError(f"Unknown voice profile: {name}")
    return PROFILES[key]


# MUTHUR "tuner" chain (ffmpeg -af): EQ + light metal-room taps + subtle relay delay.
# Override with VOICE_PROFILE_REVERB_AF; set VOICE_PROFILE_REVERB=0 to disable.
_DEFAULT_MUTHUR_REVERB_AF = (
    "highpass=f=120,"
    "equalizer=f=4200:width_type=h:width=2000:g=2,"
    "lowpass=f=10000,"
    "aecho=0.92:0.88:34|58|82:0.1|0.07|0.05,"
    "aecho=0.97:0.9:115:0.14,"
    "extrastereo=m=0.35,"
    "volume=0.95"
)


def _wet_mp3_with_reverb(src_path: str) -> str | None:
    """Return path to a new temp mp3 with reverb, or None if ffmpeg is missing or fails."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return None
    filt = os.environ.get("VOICE_PROFILE_REVERB_AF", _DEFAULT_MUTHUR_REVERB_AF).strip()
    if not filt:
        return None
    fd, wet_path = tempfile.mkstemp(suffix=".mp3")
    os.close(fd)
    try:
        r = subprocess.run(
            [
                ffmpeg,
                "-nostdin",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                src_path,
                "-af",
                filt,
                "-acodec",
                "libmp3lame",
                "-q:a",
                "3",
                wet_path,
            ],
            capture_output=True,
            timeout=int(VOICE_PROFILE_TIMEOUT_SEC),
        )
        if r.returncode != 0:
            try:
                os.remove(wet_path)
            except OSError:
                pass
            return None
        return wet_path
    except (OSError, subprocess.SubprocessError, ValueError):
        try:
            os.remove(wet_path)
        except OSError:
            pass
        return None


def profile_env(
    profile: dict,
    rate: str | None = None,
    pitch: str | None = None,
    volume: str | None = None,
) -> dict[str, str]:
    env = {
        "BOOTUP_AI_NAME": profile["bootup_ai_name"],
        "BOOTUP_VOICE": profile["bootup_voice"],
    }
    default_rate = profile.get("bootup_tts_rate")
    default_pitch = profile.get("bootup_tts_pitch")
    default_volume = profile.get("bootup_tts_volume")

    env["BOOTUP_TTS_RATE"] = rate if rate not in (None, "") else default_rate
    env["BOOTUP_TTS_PITCH"] = pitch if pitch not in (None, "") else default_pitch
    env["BOOTUP_TTS_VOLUME"] = volume if volume not in (None, "") else default_volume
    return env


async def _speak(
    text: str,
    voice: str,
    rate: str | None,
    pitch: str | None,
    volume: str | None,
    profile_key: str | None = None,
) -> bool:
    try:
        import edge_tts
        import pygame
    except Exception as exc:
        print(f"[VOICE] Missing audio dependency: {exc}", file=sys.stderr)
        return False

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
        out_path = tmp.name

    wet_path: str | None = None
    try:
        communicate = edge_tts.Communicate(
            text,
            voice,
            rate=rate or "",
            pitch=pitch or "",
            volume=volume or "",
        )
        await asyncio.wait_for(communicate.save(out_path), timeout=VOICE_PROFILE_TIMEOUT_SEC)

        play_path = out_path
        reverb_on = os.environ.get("VOICE_PROFILE_REVERB", "1").strip().lower() not in (
            "0",
            "false",
            "no",
            "off",
        )
        if profile_key == "muthur" and reverb_on:
            wet_path = _wet_mp3_with_reverb(out_path)
            if wet_path:
                play_path = wet_path

        pygame.mixer.init()
        pygame.mixer.music.load(play_path)
        pygame.mixer.music.play()
        started = time.monotonic()
        while pygame.mixer.music.get_busy():
            if time.monotonic() - started > VOICE_PROFILE_TIMEOUT_SEC:
                pygame.mixer.music.stop()
                raise TimeoutError("Playback timed out")
            pygame.time.Clock().tick(10)
        return True
    finally:
        try:
            pygame.mixer.quit()  # type: ignore[name-defined]
        except Exception:
            pass
        try:
            os.remove(out_path)
        except Exception:
            pass
        if wet_path:
            try:
                os.remove(wet_path)
            except Exception:
                pass


def list_profiles() -> int:
    for name, profile in PROFILES.items():
        print(f"{name:14} -> {profile['bootup_ai_name']} / {profile['bootup_voice']}")
        print(f"  {profile['description']}")
    return 0


def show_profile(profile_name: str) -> int:
    profile = resolve_profile(profile_name)
    print(json.dumps(profile, indent=2))
    return 0


def emit_profile(
    profile_name: str,
    shell: str,
    rate: str | None = None,
    pitch: str | None = None,
    volume: str | None = None,
) -> int:
    profile = resolve_profile(profile_name)
    env = profile_env(profile, rate=rate, pitch=pitch, volume=volume)

    shell = (shell or "powershell").strip().lower()
    if shell in ("ps1", "powershell", "pwsh"):
        for key, value in env.items():
            print(f"$Env:{key} = '{value}'")
        return 0

    if shell in ("bash", "sh"):
        for key, value in env.items():
            print(f"export {key}='{value}'")
        return 0

    if shell == "json":
        print(json.dumps(env, indent=2))
        return 0

    raise SystemExit(f"Unsupported shell: {shell}")


def speak_profile(
    profile_name: str,
    text: str,
    rate: str | None = None,
    pitch: str | None = None,
    volume: str | None = None,
) -> int:
    profile = resolve_profile(profile_name)
    env = profile_env(profile, rate=rate, pitch=pitch, volume=volume)
    print(
        f"[VOICE] Speaking with profile '{profile['profile']}' "
        f"({profile['bootup_voice']}): {text}",
        flush=True,
    )
    ok = asyncio.run(
        _speak(
            text,
            env["BOOTUP_VOICE"],
            env.get("BOOTUP_TTS_RATE"),
            env.get("BOOTUP_TTS_PITCH"),
            env.get("BOOTUP_TTS_VOLUME"),
            profile_key=profile["profile"],
        )
    )
    return 0 if ok else 1


def current_profile() -> int:
    env = {
        "BOOTUP_AI_NAME": os.getenv("BOOTUP_AI_NAME", ""),
        "BOOTUP_VOICE": os.getenv("BOOTUP_VOICE", ""),
        "BOOTUP_TTS_RATE": os.getenv("BOOTUP_TTS_RATE", ""),
        "BOOTUP_TTS_PITCH": os.getenv("BOOTUP_TTS_PITCH", ""),
        "BOOTUP_TTS_VOLUME": os.getenv("BOOTUP_TTS_VOLUME", ""),
    }
    print(json.dumps(env, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Voice profile helper for m4trix")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("list", help="List known profiles")
    p.set_defaults(func=lambda args: list_profiles())

    p = sub.add_parser("show", help="Show a single profile as JSON")
    p.add_argument("profile", help="Profile name or alias")
    p.set_defaults(func=lambda args: show_profile(args.profile))

    p = sub.add_parser("emit", help="Emit env commands for a profile")
    p.add_argument("profile", help="Profile name or alias")
    p.add_argument("--shell", default="powershell", help="powershell, bash, or json")
    p.add_argument("--rate", help="Optional TTS rate override")
    p.add_argument("--pitch", help="Optional TTS pitch override")
    p.add_argument("--volume", help="Optional TTS volume override")
    p.set_defaults(
        func=lambda args: emit_profile(args.profile, args.shell, args.rate, args.pitch, args.volume)
    )

    p = sub.add_parser("speak", help="Speak text using a profile")
    p.add_argument("profile", help="Profile name or alias")
    p.add_argument("--rate", help="Optional TTS rate override")
    p.add_argument("--pitch", help="Optional TTS pitch override")
    p.add_argument("--volume", help="Optional TTS volume override")
    p.add_argument("text", nargs="+", help="Text to speak")
    p.set_defaults(
        func=lambda args: speak_profile(
            args.profile, " ".join(args.text), args.rate, args.pitch, args.volume
        )
    )

    p = sub.add_parser("current", help="Show the currently active env values")
    p.set_defaults(func=lambda args: current_profile())

    args = parser.parse_args()
    try:
        return int(args.func(args))
    except KeyError as e:
        print(str(e), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
