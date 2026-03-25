#!/usr/bin/env python3
"""Voice bridge: Vosk realtime speech -> inbox + memory."""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import time
import zipfile
from pathlib import Path
from urllib.request import urlretrieve

import sounddevice as sd
from vosk import KaldiRecognizer, Model

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

MODELS_DIR = ROOT / "models"
MODEL_NAME = "vosk-model-small-en-us-0.15"
MODEL_PATH = MODELS_DIR / MODEL_NAME
MODEL_URL = f"https://alphacephei.com/vosk/models/{MODEL_NAME}.zip"


def ensure_model() -> Path:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    if MODEL_PATH.exists() and MODEL_PATH.is_dir():
        return MODEL_PATH

    zip_path = MODELS_DIR / f"{MODEL_NAME}.zip"
    print(f"[VOICE_BRIDGE] Downloading model: {MODEL_URL}")
    urlretrieve(MODEL_URL, str(zip_path))
    print("[VOICE_BRIDGE] Extracting model...")
    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall(MODELS_DIR)
    zip_path.unlink(missing_ok=True)
    return MODEL_PATH


def append_jsonl(path: Path, row: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


def add_memory(db_path: Path, text: str, metadata: dict) -> None:
    con = sqlite3.connect(str(db_path))
    cur = con.cursor()
    cur.execute(
        "INSERT INTO memories (type, text, metadata, embedding, created_at) VALUES (?, ?, ?, ?, ?)",
        ("voice_input", text, json.dumps(metadata), None, time.time()),
    )
    con.commit()
    con.close()


def main() -> int:
    ap = argparse.ArgumentParser(description="Vosk speech bridge")
    ap.add_argument("--out", default=str(ROOT / "voice_inbox.jsonl"))
    ap.add_argument("--db", default=str(ROOT / "skills" / "memory" / "memory.db"))
    ap.add_argument("--rate", type=int, default=16000)
    ap.add_argument("--name", default=os.getenv("BOOTUP_AI_NAME", "Jeena Jacket"))
    ap.add_argument("--min-len", type=int, default=2)
    args = ap.parse_args()

    out_path = Path(args.out)
    db_path = Path(args.db)

    model_dir = ensure_model()
    model = Model(str(model_dir))
    rec = KaldiRecognizer(model, args.rate)

    print("[VOICE_BRIDGE] Listening with Vosk...")
    print(f"[VOICE_BRIDGE] out={out_path}")

    last_text = ""
    last_ts = 0.0

    def handle_text(text: str):
        nonlocal last_text, last_ts
        cleaned = (text or "").strip()
        if len(cleaned) < args.min_len:
            return
        now = time.time()
        if cleaned.lower() == last_text.lower() and now - last_ts < 4.0:
            return
        last_text = cleaned
        last_ts = now

        row = {
            "ts": now,
            "ts_iso": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(now)),
            "speaker": "human",
            "channel": "voice",
            "text": cleaned,
            "target_ai": args.name,
        }
        append_jsonl(out_path, row)
        try:
            add_memory(
                db_path,
                cleaned,
                {
                    "source": "voice_bridge",
                    "speaker": "human",
                    "channel": "voice",
                    "target_ai": args.name,
                    "ts": now,
                },
            )
        except Exception as e:
            print(f"[VOICE_BRIDGE] memory write failed: {e}")

        print(f"[VOICE_BRIDGE] Heard: {cleaned}")

    def callback(indata, frames, time_info, status):
        if status:
            return
        data = bytes(indata)
        if rec.AcceptWaveform(data):
            res = json.loads(rec.Result())
            handle_text(res.get("text", ""))

    try:
        with sd.RawInputStream(
            samplerate=args.rate,
            blocksize=8000,
            dtype="int16",
            channels=1,
            callback=callback,
        ):
            while True:
                time.sleep(0.2)
    except KeyboardInterrupt:
        print("[VOICE_BRIDGE] Stopped")
        return 0
    except Exception as e:
        print(f"[VOICE_BRIDGE] Runtime error: {e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
