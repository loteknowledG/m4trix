"""
Voice Benchmark Script for samus-manus
Run: python skills/voice/benchmark.py
"""

import time
import pyttsx3
import os
import sys

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def run_benchmark() -> None:
    print("=" * 50)
    print("SAMUS-MANUS VOICE BENCHMARK")
    print("=" * 50)

    # TTS Benchmark (pyttsx3)
    print("\n[TTS Benchmark - pyttsx3]")
    engine = pyttsx3.init()
    engine.setProperty("rate", 160)

    # First run (cold start)
    print("Cold start (first run)...")
    start = time.time()
    engine.say("test")
    engine.runAndWait()
    cold_time = (time.time() - start) * 1000
    print(f"Cold start TTS: {cold_time:.0f}ms")

    # Warm runs
    times = []
    for i in range(3):
        start = time.time()
        engine.say("hello world testing")
        engine.runAndWait()
        elapsed = (time.time() - start) * 1000
        times.append(elapsed)
        print(f"Run {i + 1}: {elapsed:.0f}ms")

    avg_tts = sum(times) / len(times)
    print(f"Average TTS (warm): {avg_tts:.0f}ms")

    # Vosk STT (if available)
    print("\n[STT Benchmark - Vosk]")
    try:
        from vosk import Model, KaldiRecognizer
        import sounddevice as sd

        print("Vosk STT available - requires microphone input")
        print("Skipping auto-benchmark (needs audio input)")
    except ImportError as e:
        print(f"Vosk not available: {e}")

    print("\n" + "=" * 50)
    print("RESULTS COMPARISON:")
    print("=" * 50)
    print(f"Python pyttsx3 TTS: ~{avg_tts:.0f}ms")
    print("")
    print("Browser (JavaScript Web Speech API):")
    print("  - TTS start:  ~24ms")
    print("  - STT:        ~4431ms")
    print("  - Full loop:  ~4465ms")
    print("=" * 50)


if __name__ == "__main__":
    run_benchmark()
