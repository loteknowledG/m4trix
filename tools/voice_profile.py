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
    "asian-elder": {
        "profile": "asian-elder",
        "label": "Asian Elder",
        "bootup_ai_name": "Asian Elder",
        "bootup_voice": "zh-CN-YunjianNeural",
        "bootup_tts_rate": "-28%",
        "bootup_tts_pitch": "-12Hz",
        "bootup_tts_volume": "-4%",
        "description": "Slow, low male voice with a natural East Asian accent on English.",
    },
    "vietnamese-male": {
        "profile": "vietnamese-male",
        "label": "Vietnamese Male",
        "bootup_ai_name": "Vietnamese Male",
        "bootup_voice": "vi-VN-NamMinhNeural",
        "bootup_tts_rate": "-6%",
        "bootup_tts_pitch": "-4Hz",
        "bootup_tts_volume": "+0%",
        "description": "Natural Vietnamese male voice for English dialogue.",
    },
    "old-fat-vietnamese-man": {
        "profile": "old-fat-vietnamese-man",
        "label": "Old Fat Vietnamese Man",
        "bootup_ai_name": "Old Fat Vietnamese Man",
        "bootup_voice": "vi-VN-NamMinhNeural",
        "bootup_tts_rate": "-26%",
        "bootup_tts_pitch": "-18Hz",
        "bootup_tts_volume": "-3%",
        "description": "Slow, deep older Vietnamese male voice — heavy and unhurried.",
    },
    "midwest-teen": {
        "profile": "midwest-teen",
        "label": "Midwest Teen",
        "bootup_ai_name": "Midwest Teen",
        "bootup_voice": "en-US-EmmaNeural",
        "bootup_tts_rate": "+12%",
        "bootup_tts_pitch": "+8Hz",
        "bootup_tts_volume": "+2%",
        "description": "Bright 16-year-old Midwestern female voice — flat, friendly General American.",
    },
    "narrator": {
        "profile": "narrator",
        "label": "Narrator",
        "bootup_ai_name": "Narrator",
        "bootup_voice": "en-US-GuyNeural",
        "bootup_tts_rate": "-18%",
        "bootup_tts_pitch": "-4Hz",
        "bootup_tts_volume": "+0%",
        "description": "Measured audiobook and documentary narration — calm, clear, authoritative.",
    },
    "narrator-female": {
        "profile": "narrator-female",
        "label": "Female Narrator",
        "bootup_ai_name": "Female Narrator",
        "bootup_voice": "en-US-AriaNeural",
        "bootup_tts_rate": "-18%",
        "bootup_tts_pitch": "-2Hz",
        "bootup_tts_volume": "+0%",
        "description": "Warm, measured female narration for audiobooks, stories, and documentaries.",
    },
    "seductive-secretary": {
        "profile": "seductive-secretary",
        "label": "Seductive Secretary",
        "bootup_ai_name": "Seductive Secretary",
        "bootup_voice": "en-US-MichelleNeural",
        "bootup_tts_rate": "-24%",
        "bootup_tts_pitch": "-11Hz",
        "bootup_tts_volume": "-3%",
        "description": "Slow, smooth, low office voice — polished and subtly flirtatious.",
    },
    "southern-belle": {
        "profile": "southern-belle",
        "label": "Southern Belle",
        "bootup_ai_name": "Southern Belle",
        "bootup_voice": "en-US-AriaNeural",
        "bootup_tts_rate": "-20%",
        "bootup_tts_pitch": "+5Hz",
        "bootup_tts_volume": "+3%",
        "description": "Warm, slow, gracious Southern female voice — sweet and drawn-out.",
    },
    "uk-twenties": {
        "profile": "uk-twenties",
        "label": "UK Twenties",
        "bootup_ai_name": "UK Twenties",
        "bootup_voice": "en-GB-LibbyNeural",
        "bootup_tts_rate": "+6%",
        "bootup_tts_pitch": "+4Hz",
        "bootup_tts_volume": "+0%",
        "description": "British woman in her 20s — casual, bright, modern UK accent.",
    },
    "uk-hazel": {
        "profile": "uk-hazel",
        "label": "Hazel (UK)",
        "bootup_ai_name": "Hazel (UK)",
        "bootup_voice": "en-GB-SoniaNeural",
        "bootup_tts_rate": "-6%",
        "bootup_tts_pitch": "-2Hz",
        "bootup_tts_volume": "+0%",
        "description": "Classic Microsoft British English female voice — clear, measured, natural UK accent.",
    },
    "au-twenties": {
        "profile": "au-twenties",
        "label": "AU Twenties",
        "bootup_ai_name": "AU Twenties",
        "bootup_voice": "en-AU-NatashaNeural",
        "bootup_tts_rate": "+8%",
        "bootup_tts_pitch": "+5Hz",
        "bootup_tts_volume": "+1%",
        "description": "Australian woman in her 20s — upbeat, casual, natural Aussie accent.",
    },
    "au-catherine": {
        "profile": "au-catherine",
        "label": "Catherine (AU)",
        "bootup_ai_name": "Catherine (AU)",
        "bootup_voice": "en-AU-NatashaNeural",
        "bootup_tts_rate": "-8%",
        "bootup_tts_pitch": "-3Hz",
        "bootup_tts_volume": "+0%",
        "description": "Classic Microsoft Australian English female voice — clear, measured, natural Aussie accent.",
    },
    "atlanta-thirties": {
        "profile": "atlanta-thirties",
        "label": "Atlanta 30s",
        "bootup_ai_name": "Atlanta 30s",
        "bootup_voice": "en-US-JennyNeural",
        "bootup_tts_rate": "-11%",
        "bootup_tts_pitch": "+1Hz",
        "bootup_tts_volume": "+2%",
        "description": "Atlanta woman in her 30s — warm urban Southern, confident and polished.",
    },
    "california-girl": {
        "profile": "california-girl",
        "label": "California Girl",
        "bootup_ai_name": "California Girl",
        "bootup_voice": "en-US-AvaNeural",
        "bootup_tts_rate": "+10%",
        "bootup_tts_pitch": "+9Hz",
        "bootup_tts_volume": "+3%",
        "description": "Bright, relaxed SoCal female voice — casual West Coast girl accent.",
    },
    "nyc-girl": {
        "profile": "nyc-girl",
        "label": "NYC Girl",
        "bootup_ai_name": "NYC Girl",
        "bootup_voice": "en-US-JennyNeural",
        "bootup_tts_rate": "+14%",
        "bootup_tts_pitch": "+3Hz",
        "bootup_tts_volume": "+1%",
        "description": "Fast, direct New York City female voice — urban, confident, no-nonsense.",
    },
    "atlanta-forties-male": {
        "profile": "atlanta-forties-male",
        "label": "Atlanta 40s Male",
        "bootup_ai_name": "Atlanta 40s Male",
        "bootup_voice": "en-US-AndrewNeural",
        "bootup_tts_rate": "-10%",
        "bootup_tts_pitch": "-8Hz",
        "bootup_tts_volume": "+1%",
        "description": "Atlanta man in his 40s — warm urban Southern, steady and confident.",
    },
    "stripper-female": {
        "profile": "stripper-female",
        "label": "Stripper",
        "bootup_ai_name": "Stripper",
        "bootup_voice": "en-US-AriaNeural",
        "bootup_tts_rate": "-19%",
        "bootup_tts_pitch": "-6Hz",
        "bootup_tts_volume": "-2%",
        "description": "Slow, husky club voice — playful, flirtatious, and upfront.",
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
    "asian-elder": "asian-elder",
    "asian-elder-male": "asian-elder",
    "elder": "asian-elder",
    "old-asian": "asian-elder",
    "wise-elder": "asian-elder",
    "vietnamese-male": "vietnamese-male",
    "vietnamese": "vietnamese-male",
    "viet-male": "vietnamese-male",
    "nam-minh": "vietnamese-male",
    "namminh": "vietnamese-male",
    "old-fat-vietnamese-man": "old-fat-vietnamese-man",
    "old-vietnamese-man": "old-fat-vietnamese-man",
    "fat-vietnamese-man": "old-fat-vietnamese-man",
    "vietnamese-elder": "old-fat-vietnamese-man",
    "vietnamese-old-man": "old-fat-vietnamese-man",
    "midwest-teen": "midwest-teen",
    "midwest-girl": "midwest-teen",
    "midwest-16": "midwest-teen",
    "teen-midwest": "midwest-teen",
    "narrator": "narrator",
    "narration": "narrator",
    "audiobook": "narrator",
    "documentary": "narrator",
    "voiceover": "narrator",
    "narrator-female": "narrator-female",
    "female-narrator": "narrator-female",
    "woman-narrator": "narrator-female",
    "seductive-secretary": "seductive-secretary",
    "secretary": "seductive-secretary",
    "sultry-secretary": "seductive-secretary",
    "southern-belle": "southern-belle",
    "southern-belle-accent": "southern-belle",
    "belle": "southern-belle",
    "southern-lady": "southern-belle",
    "scarlett": "southern-belle",
    "uk-twenties": "uk-twenties",
    "british-girl": "uk-twenties",
    "uk-girl": "uk-twenties",
    "british-20s": "uk-twenties",
    "uk-20s": "uk-twenties",
    "british-girl-20s": "uk-twenties",
    "uk-hazel": "uk-hazel",
    "hazel": "uk-hazel",
    "hazel-uk": "uk-hazel",
    "hazel-british": "uk-hazel",
    "microsoft-hazel": "uk-hazel",
    "en-gb-hazel": "uk-hazel",
    "au-twenties": "au-twenties",
    "australian-girl": "au-twenties",
    "au-girl": "au-twenties",
    "australian-20s": "au-twenties",
    "au-20s": "au-twenties",
    "australian-girl-20s": "au-twenties",
    "au-catherine": "au-catherine",
    "catherine": "au-catherine",
    "catherine-au": "au-catherine",
    "catherine-australian": "au-catherine",
    "microsoft-catherine": "au-catherine",
    "en-au-catherine": "au-catherine",
    "atlanta-thirties": "atlanta-thirties",
    "atlanta-female": "atlanta-thirties",
    "atlanta-30s": "atlanta-thirties",
    "atl-30s": "atlanta-thirties",
    "atlanta-girl": "atlanta-thirties",
    "california-girl": "california-girl",
    "cali-girl": "california-girl",
    "californian-girl": "california-girl",
    "californian-accent": "california-girl",
    "so-cal-girl": "california-girl",
    "valley-girl": "california-girl",
    "nyc-girl": "nyc-girl",
    "new-york-girl": "nyc-girl",
    "ny-girl": "nyc-girl",
    "nyc-accent": "nyc-girl",
    "brooklyn-girl": "nyc-girl",
    "atlanta-forties-male": "atlanta-forties-male",
    "atlanta-male-40s": "atlanta-forties-male",
    "atlanta-male": "atlanta-forties-male",
    "atl-male-40s": "atlanta-forties-male",
    "atlanta-man": "atlanta-forties-male",
    "stripper-female": "stripper-female",
    "stripper": "stripper-female",
    "club-voice": "stripper-female",
    "sultry-club": "stripper-female",
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
