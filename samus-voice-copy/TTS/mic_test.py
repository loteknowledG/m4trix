#!/usr/bin/env python3
"""Simple microphone test — record a short block and transcribe with Vosk.

Usage:
  python tools/mic_test.py            # record 4s and print transcript
  python tools/mic_test.py --speak    # also speak the transcript via pyttsx3
  python tools/mic_test.py -s 6       # record 6 seconds
"""
import json
import argparse
import sys
import os
import zipfile
import urllib.request

# local model constants (mirror of voice_loop.py)
ROOT = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(ROOT, 'models')
MODEL_NAME = 'vosk-model-small-en-us-0.15'
MODEL_PATH = os.path.join(MODELS_DIR, MODEL_NAME)
SAMPLE_RATE = 16000


def ensure_model():
    os.makedirs(MODELS_DIR, exist_ok=True)
    if os.path.isdir(MODEL_PATH):
        return MODEL_PATH
    zip_path = os.path.join(MODELS_DIR, MODEL_NAME + '.zip')
    print(f"Downloading Vosk model (~50MB): https://alphacephei.com/vosk/models/{MODEL_NAME}.zip")
    urllib.request.urlretrieve(f"https://alphacephei.com/vosk/models/{MODEL_NAME}.zip", zip_path)
    print("Extracting model...")
    with zipfile.ZipFile(zip_path, 'r') as z:
        z.extractall(MODELS_DIR)
    os.remove(zip_path)
    return MODEL_PATH

import sounddevice as sd
import numpy as np
try:
    from vosk import Model, KaldiRecognizer
except Exception:
    print('Vosk is not available. Install requirements-voice.txt', file=sys.stderr)
    raise

try:
    import pyttsx3
except Exception:
    pyttsx3 = None


def record_block(seconds: int, do_prompt: bool = True):
    prompt = "Speak now."
    if do_prompt:
        print(f"🎙️  Recording {seconds}s — {prompt}")
        # Audibly prompt the user before recording (pyttsx3 optional)
        if pyttsx3:
            try:
                engine = pyttsx3.init()
                engine.say(prompt)
                engine.runAndWait()
            except Exception:
                # Fall back to the printed prompt if TTS fails
                pass
    else:
        print(f"🎙️  Recording {seconds}s — (no audible prompt)")
    audio = sd.rec(int(seconds * SAMPLE_RATE), samplerate=SAMPLE_RATE, channels=1, dtype='float32')
    sd.wait()
    pcm = (audio.flatten() * 32767).astype(np.int16).tobytes()
    return pcm


def transcribe_pcm(model_path: str, pcm: bytes) -> str:
    model = Model(model_path)
    rec = KaldiRecognizer(model, SAMPLE_RATE)
    if rec.AcceptWaveform(pcm):
        res = json.loads(rec.Result())
    else:
        res = json.loads(rec.FinalResult())
    return res.get('text', '').strip()


def main():
    ap = argparse.ArgumentParser(description='Microphone test + Vosk transcription')
    ap.add_argument('--seconds', '-s', type=int, default=4, help='Seconds to record (default 4)')
    ap.add_argument('--speak', action='store_true', help='Also speak the transcript via pyttsx3')
    ap.add_argument('--no-prompt', action='store_true', help='Disable the audible "Speak now." prompt before recording')
    args = ap.parse_args()

    model_path = ensure_model()
    pcm = record_block(args.seconds, do_prompt=not args.no_prompt)
    text = transcribe_pcm(model_path, pcm)

    if text:
        print('\n📝 Transcript:')
        print(text)
        if args.speak and pyttsx3:
            try:
                e = pyttsx3.init()
                e.say(text)
                e.runAndWait()
            except Exception as e:
                print('TTS speak failed:', e)
    else:
        print('\n(No speech detected)')


if __name__ == '__main__':
    main()
