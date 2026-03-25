"""
Simple offline TTS helper using pyttsx3.
Provides a CLI to speak text and a small helper function `speak()` for other modules.
"""
import argparse
import pyttsx3
import time
import os
import sys

# Add missing imports for Vosk STT
from vosk import Model, KaldiRecognizer
import numpy as np
import urllib.request
import zipfile
import json
import sounddevice as sd

_engine = None
def _get_engine():
    global _engine
    if _engine is None:
        _engine = pyttsx3.init()
        _engine.setProperty('rate', 160)
    return _engine

def tts_speak(text: str):
    """Speak the given text (blocking)."""
    eng = _get_engine()
    eng.say(text)
    eng.runAndWait()

def speak(text: str):
    """Speak the given text (blocking)."""
    eng = _get_engine()
    eng.say(text)
    eng.runAndWait()

def set_hazel_voice(engine):
    voices = engine.getProperty('voices')
    for v in voices:
        if 'hazel' in (v.name or '').lower() or 'hazel' in (v.id or '').lower():
            engine.setProperty('voice', v.id)
            print(f"Using Hazel voice: {v.name} ({v.id})")
            return True
    return False

if __name__ == '__main__':
    ap = argparse.ArgumentParser(prog='voice_loop', description='TTS helper (pyttsx3)')
    ap.add_argument('text', nargs='*', help='Text to speak (or use --loop)')
    ap.add_argument('--loop', action='store_true', help='Say text repeatedly (demo)')
    ap.add_argument('--list-voices', action='store_true', help='List installed TTS voices and exit')
    ap.add_argument('--voice', help='Select voice by id or name keyword (e.g. Zira)')
    ap.add_argument('--hanna', action='store_true', help="Use Hanna's recommended female voice preset")
    ap.add_argument('--rate', type=int, help='Speech rate (words per minute)')
    args = ap.parse_args()

    eng = _get_engine()

    # Always try to set Hazel voice first
    set_hazel_voice(eng)

    # if user hasn't explicitly chosen a voice, try loading a saved preferred voice from memory
    if not args.voice and not args.hanna:
        try:
            from memory import get_memory
            for r in get_memory().all(50):
                if r.get('type') == 'voice' and r.get('text'):
                    pref = r.get('text')
                    try:
                        eng.setProperty('voice', pref)
                        print(f"Using preferred voice from memory: {pref}")
                        break
                    except Exception:
                        pass
        except Exception:
            pass

    # list voices and exit
    if args.list_voices:
        voices = eng.getProperty('voices')
        for i, v in enumerate(voices):
            langs = getattr(v, 'languages', None)
            if langs:
                try:
                    langs_s = ','.join(l.decode('utf-8') if isinstance(l, bytes) else str(l) for l in langs)
                except Exception:
                    langs_s = str(langs)
            else:
                langs_s = ''
            print(f"{i}: {v.id} | {v.name} | {langs_s}")
        raise SystemExit(0)

    # apply Hanna preset (prefer a female-sounding voice)
    if args.hanna:
        voices = eng.getProperty('voices')
        chosen = None
        preferred_keywords = ['zira', 'anna', 'female', 'sara', 'sarah', 'siri']
        for v in voices:
            name = (v.name or '').lower()
            vid = (v.id or '').lower()
            if any(k in name or k in vid for k in preferred_keywords):
                chosen = v
                break
        if not chosen:
            for v in voices:
                name = (v.name or '').lower()
                if 'david' not in name and 'male' not in name:
                    chosen = v
                    break
        if not chosen and voices:
            chosen = voices[0]
        if chosen:
            eng.setProperty('voice', chosen.id)
            eng.setProperty('rate', args.rate or 170)

    elif args.voice:
        voices = eng.getProperty('voices')
        kw = args.voice.lower()
        found = None
        for v in voices:
            if kw in (v.name or '').lower() or kw in (v.id or '').lower():
                found = v
                break
        if found:
            eng.setProperty('voice', found.id)

    if args.rate:
        eng.setProperty('rate', args.rate)

    if not args.text:
        print('Usage: voice_loop.py "Hello world" (use --list-voices to see available voices)')
    else:
        text = ' '.join(args.text)
        if args.loop:
            while True:
                speak(text)
                time.sleep(1)
        else:
            speak(text)

ROOT = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(ROOT, 'models')
MODEL_NAME = 'vosk-model-small-en-us-0.15'
MODEL_PATH = os.path.join(MODELS_DIR, MODEL_NAME)
MODEL_URL = f'https://alphacephei.com/vosk/models/{MODEL_NAME}.zip'

SAMPLE_RATE = 16000
DURATION = 6  # seconds per turn (simple PTT style)


def ensure_model():
    os.makedirs(MODELS_DIR, exist_ok=True)
    if os.path.isdir(MODEL_PATH):
        return MODEL_PATH
    zip_path = os.path.join(MODELS_DIR, MODEL_NAME + '.zip')
    print(f"Downloading Vosk model (~50MB): {MODEL_URL}")
    urllib.request.urlretrieve(MODEL_URL, zip_path)
    print("Extracting model...")
    with zipfile.ZipFile(zip_path, 'r') as z:
        z.extractall(MODELS_DIR)
    os.remove(zip_path)
    return MODEL_PATH


def speak(engine, text: str):
    print(f"🗣️  {text}")
    engine.say(text)
    engine.runAndWait()


def record_block(seconds=DURATION):
    print("🎙️  Listening...")
    audio = sd.rec(int(seconds * SAMPLE_RATE), samplerate=SAMPLE_RATE, channels=1, dtype='float32')
    sd.wait()
    # Convert to int16 PCM bytes
    pcm = (audio.flatten() * 32767).astype(np.int16).tobytes()
    return pcm


def transcribe(recognizer: KaldiRecognizer, pcm: bytes) -> str:
    if recognizer.AcceptWaveform(pcm):
        res = json.loads(recognizer.Result())
        return res.get('text', '').strip()
    else:
        res = json.loads(recognizer.FinalResult())
        return res.get('text', '').strip()


def maybe_act(text: str, tts_engine):
    t = text.lower().strip()
    if not t:
        speak(tts_engine, "I didn't catch that")
        return
    if any(k in t for k in ("quit", "exit", "stop now")):
        speak(tts_engine, "Goodbye")
        sys.exit(0)

    if "move" in t and "center" in t:
        w,h = p.size(); p.moveTo(w//2, h//2, duration=0.3)
        speak(tts_engine, "Moving to center")
        return
    if "double click" in t:
        p.doubleClick(); speak(tts_engine, "Double click")
        return
    if "click" in t:
        p.click(); speak(tts_engine, "Click")
        return
    if t.startswith("type "):
        msg = text[5:].strip()
        if msg:
            p.write(msg, interval=0.03); speak(tts_engine, f"Typed {msg}")
            return

    speak(tts_engine, f"You said: {text}")


def main():
    ap = argparse.ArgumentParser(description='Voice loop (Vosk + pyttsx3)')
    ap.add_argument('--no-prompt', action='store_true', help='Disable the audible "Speak now." prompt before recording')
    args = ap.parse_args()

    # TTS engine
    tts = pyttsx3.init()
    tts.setProperty('rate', 180)

    # STT model
    model_dir = ensure_model()
    model = Model(model_dir)
    rec = KaldiRecognizer(model, SAMPLE_RATE)

    speak(tts, "Voice control ready. Press Enter to talk. Say quit to exit.")
    while True:
        try:
            input("\nPress Enter to talk...")
        except KeyboardInterrupt:
            print("\nExiting")
            break
        # Audible prompt (can be disabled with --no-prompt)
        if not args.no_prompt:
            speak(tts, "Speak now.")
        pcm = record_block()
        text = transcribe(rec, pcm)
        print(f"📝 {text}")
        maybe_act(text, tts)
        time.sleep(0.1)


if __name__ == '__main__':
    import sys
    # If text is provided as arguments, use TTS CLI mode
    if len(sys.argv) > 1 and not sys.argv[1].startswith('--'):
        text = ' '.join(sys.argv[1:])
        tts_speak(text)
    else:
        main()
