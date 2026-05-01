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
import subprocess
import sys
import tempfile
import time
import shutil
from pathlib import Path

import pyttsx3


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
}

ALIASES = {
    "jenna": "jenna-jacket",
    "jeena": "jenna-jacket",
    "jeena-neural": "jenny-neural",
    "jacket": "jenna-jacket",
    "jenny": "jenny-neural",
    "neural": "jenny-neural",
}


def resolve_profile(name: str) -> dict:
    key = (name or "").strip().lower()
    key = ALIASES.get(key, key)
    if key not in PROFILES:
        raise KeyError(f"Unknown voice profile: {name}")
    return PROFILES[key]


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


async def _speak_cloud(
    text: str,
    voice: str,
    rate: str | None,
    pitch: str | None,
    volume: str | None,
) -> bool:
    print("[VOICE] Loading TTS libraries...", flush=True)
    try:
        import edge_tts
        import pygame
    except Exception as exc:
        print(f"[VOICE] Missing audio dependency: {exc}", file=sys.stderr)
        return False
    print("[VOICE] TTS libraries loaded.", flush=True)

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
        out_path = tmp.name

    try:
        communicate = edge_tts.Communicate(
            text,
            voice,
            rate=rate or "",
            pitch=pitch or "",
            volume=volume or "",
        )
        print("[VOICE] Synthesizing speech...", flush=True)
        await asyncio.wait_for(communicate.save(out_path), timeout=VOICE_PROFILE_TIMEOUT_SEC)

        try:
            if sys.platform.startswith("win"):
                ffmpeg = shutil.which("ffmpeg")
                if ffmpeg:
                    print("[VOICE] Playing via Windows sound API...", flush=True)
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as wav_tmp:
                        wav_path = wav_tmp.name
                    subprocess.run(
                        [ffmpeg, "-y", "-loglevel", "quiet", "-i", out_path, wav_path],
                        check=True,
                    )
                    import winsound

                    winsound.PlaySound(wav_path, winsound.SND_FILENAME)
                    try:
                        os.remove(wav_path)
                    except Exception:
                        pass
                else:
                    print("[VOICE] Playing via pygame...", flush=True)
                    pygame.mixer.init()
                    pygame.mixer.music.load(out_path)
                    pygame.mixer.music.play()
                    started = time.monotonic()
                    while pygame.mixer.music.get_busy():
                        if time.monotonic() - started > VOICE_PROFILE_TIMEOUT_SEC:
                            pygame.mixer.music.stop()
                            raise TimeoutError("Playback timed out")
                        pygame.time.Clock().tick(10)
            else:
                ffplay = shutil.which("ffplay")
                if ffplay:
                    print("[VOICE] Playing via ffplay...", flush=True)
                    subprocess.run(
                        [
                            ffplay,
                            "-nodisp",
                            "-autoexit",
                            "-loglevel",
                            "quiet",
                            out_path,
                        ],
                        check=True,
                    )
                else:
                    print("[VOICE] Playing via pygame...", flush=True)
                    pygame.mixer.init()
                    pygame.mixer.music.load(out_path)
                    pygame.mixer.music.play()
                    started = time.monotonic()
                    while pygame.mixer.music.get_busy():
                        if time.monotonic() - started > VOICE_PROFILE_TIMEOUT_SEC:
                            pygame.mixer.music.stop()
                            raise TimeoutError("Playback timed out")
                        pygame.time.Clock().tick(10)
        except Exception as exc:
            print(f"[VOICE] playback failed: {exc}; falling back to OS player", file=sys.stderr)
            if sys.platform.startswith("win"):
                os.startfile(out_path)  # type: ignore[attr-defined]
            elif sys.platform.startswith("darwin"):
                subprocess.Popen(["open", out_path])
            else:
                subprocess.Popen(["xdg-open", out_path])
            time.sleep(2)
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


def _speak_native(
    text: str,
    voice_name: str | None = None,
    rate: str | None = None,
    pitch: str | None = None,
    volume: str | None = None,
) -> bool:
    try:
        engine = pyttsx3.init()
    except Exception as exc:
        print(f"[VOICE] Native speech init failed: {exc}", file=sys.stderr)
        return False

    try:
        if rate not in (None, ""):
            try:
                engine.setProperty("rate", int(str(rate).replace("%", "")))
            except Exception:
                pass
        if volume not in (None, ""):
            try:
                engine.setProperty("volume", max(0.0, min(1.0, float(str(volume).replace("%", "")))))
            except Exception:
                pass

        if voice_name:
            for voice in engine.getProperty("voices"):
                voice_haystack = f"{voice.id} {getattr(voice, 'name', '')}".lower()
                if voice_name.lower() in voice_haystack:
                    engine.setProperty("voice", voice.id)
                    break

        engine.say(text)
        engine.runAndWait()
        return True
    except Exception as exc:
        print(f"[VOICE] Native speech failed: {exc}", file=sys.stderr)
        return False
    finally:
        try:
            engine.stop()
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
    ok = _speak_native(
        text,
        voice_name="zira" if sys.platform.startswith("win") else None,
        rate=env.get("BOOTUP_TTS_RATE"),
        pitch=env.get("BOOTUP_TTS_PITCH"),
        volume=env.get("BOOTUP_TTS_VOLUME"),
    )
    return 0 if ok else 1


def cloud_worker_profile(
    profile_name: str,
    text: str,
    rate: str | None = None,
    pitch: str | None = None,
    volume: str | None = None,
) -> int:
    profile = resolve_profile(profile_name)
    env = profile_env(profile, rate=rate, pitch=pitch, volume=volume)
    ok = asyncio.run(
        _speak_cloud(
            text,
            env["BOOTUP_VOICE"],
            env.get("BOOTUP_TTS_RATE"),
            env.get("BOOTUP_TTS_PITCH"),
            env.get("BOOTUP_TTS_VOLUME"),
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

    p = sub.add_parser("_cloud", help=argparse.SUPPRESS)
    p.add_argument("profile", nargs="+", help=argparse.SUPPRESS)
    p.add_argument("--rate", help=argparse.SUPPRESS)
    p.add_argument("--pitch", help=argparse.SUPPRESS)
    p.add_argument("--volume", help=argparse.SUPPRESS)
    p.add_argument("text", nargs="+", help=argparse.SUPPRESS)
    p.set_defaults(
        func=lambda args: cloud_worker_profile(
            " ".join(args.profile), " ".join(args.text), args.rate, args.pitch, args.volume
        )
    )

    args = parser.parse_args()
    try:
        return int(args.func(args))
    except KeyError as e:
        print(str(e), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
