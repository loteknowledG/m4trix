import os, sys, time, json, zipfile, urllib.request
import argparse
import numpy as np
import sounddevice as sd
import pyttsx3
import pyautogui as p

try:
    from vosk import Model, KaldiRecognizer
except Exception as e:
    print("Vosk not installed. Run: pip install vosk sounddevice pyttsx3 numpy", file=sys.stderr)
    raise

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
    main()
