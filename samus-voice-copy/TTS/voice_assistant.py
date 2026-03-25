#!/usr/bin/env python3
"""
Voice assistant (STT + TTS) for Samus‑Manus.
- Uses Vosk + sounddevice for offline STT when available.
- Uses pyttsx3 for TTS (voice_loop.speak).
- Plans actions via samus_agent.plan_actions and asks for voice confirmation
  before executing actions locally (human‑in‑the‑loop).

Usage:
  python voice_assistant.py        # fall back to typed input if STT unavailable
  python voice_assistant.py --live  # continuous listening loop (requires Vosk + sounddevice)

Security: voice assistant *always* asks for explicit "yes" before running actions.
"""
import argparse
import time
import json
import sys
import os
from pathlib import Path

# TTS
try:
    from voice_loop import speak
except Exception:
    def speak(t): print('[TTS]', t)

# optional persistent memory (if present)
try:
    from memory import get_memory
except Exception:
    try:
        from samus_manus_mvp.memory import get_memory
    except Exception:
        get_memory = None

# Import planner & executor from samus_agent
try:
    from samus_agent import plan_actions, execute_action
except Exception:
    # if not importable as module, import by path
    sys.path.append(str(Path(__file__).parent))
    from samus_agent import plan_actions, execute_action

# Optional STT (Vosk)
STT_AVAILABLE = False
try:
    import sounddevice as sd
    from vosk import Model, KaldiRecognizer
    STT_AVAILABLE = True
except Exception:
    STT_AVAILABLE = False

MODEL_PATH = Path(__file__).parent / 'model'
LISTEN_RESUME_DELAY_SEC = float(os.environ.get('VOICE_LISTEN_RESUME_DELAY_SEC', '1.5'))


def list_audio_devices():
    try:
        import sounddevice as sd
        return sd.query_devices()
    except Exception:
        return []


def stt_listen_once(timeout=8):
    """Listen once via Vosk and return transcribed text. If STT not available, return None."""
    if not STT_AVAILABLE or not MODEL_PATH.exists():
        return None

    model = Model(str(MODEL_PATH))
    rec = KaldiRecognizer(model, 16000)

    def callback(indata, frames, time_info, status):
        if status:
            print('STT status:', status)
        if rec.AcceptWaveform(bytes(indata)):
            pass

    try:
        with sd.RawInputStream(samplerate=16000, blocksize=8000, dtype='int16', channels=1) as stream:
            print('Listening... (speak now)')
            start = time.time()
            data = b''
            while True:
                indata = stream.read(4000)[0]
                if rec.AcceptWaveform(bytes(indata)):
                    res = json.loads(rec.Result())
                    text = res.get('text', '').strip()
                    if text:
                        return text
                # partials ignored for clarity
                if time.time() - start > timeout:
                    return None
    except Exception as e:
        print('STT listen error:', e)
        return None


def text_listen_once(prompt='Say a command (or type): '):
    try:
        txt = input(prompt).strip()
        # persist typed input if memory is available
        try:
            if txt and get_memory is not None:
                get_memory().add('typed_input', txt, metadata={'source':'voice_assistant'})
        except Exception:
            pass
        return txt
    except EOFError:
        return None


def confirm_voice(prompt='Do you approve executing these actions? Say yes to confirm.'): 
    speak(prompt)
    # Prevent microphone from immediately hearing our own TTS tail.
    time.sleep(LISTEN_RESUME_DELAY_SEC)
    # try STT first
    if STT_AVAILABLE and MODEL_PATH.exists():
        ans = stt_listen_once(timeout=6)
        if ans:
            print('Heard confirmation:', ans)
            return ans.lower().strip() in ('yes', 'yeah', 'yup', 'confirm')
    # fallback to text input
    ans = text_listen_once('(type yes/no): ')
    return (ans or '').lower().strip() in ('yes', 'y')


def summarize_actions(actions):
    out = []
    for a in actions:
        t = a.get('type')
        if t == 'type':
            out.append(f"type '{a.get('text')[:30]}')")
        elif t == 'screenshot':
            out.append(f"screenshot -> {a.get('out')}")
        else:
            out.append(t)
    return '; '.join(out)


def handle_command(command: str):
    if not command:
        print('No command received')
        return
    speak(f'I heard: {command}')
    # persist voice command (best-effort)
    try:
        if get_memory is not None:
            get_memory().add('voice_command', command, metadata={'source':'voice_assistant'})
    except Exception:
        pass

    actions = plan_actions(command)
    if not actions:
        speak('I could not plan actions for that command')
        return

    # persist planned actions
    try:
        if get_memory is not None:
            get_memory().add('plan', json.dumps(actions), metadata={'source':'voice_assistant', 'command': command})
    except Exception:
        pass

    # remove trailing done for summary
    summary = summarize_actions([a for a in actions if a.get('type') != 'done'])
    speak(f'Planned actions: {summary}')
    print('Planned actions:', actions)
    approved = confirm_voice()

    # persist approval decision
    try:
        if get_memory is not None:
            get_memory().add('approval', 'yes' if approved else 'no', metadata={'command': command, 'approved': approved})
    except Exception:
        pass

    if not approved:
        speak('Cancelled by user')
        return
    speak('Executing now')
    for a in actions:
        res = execute_action(a, apply=True)
        print('→', res)
        try:
            if get_memory is not None:
                get_memory().add('action', res, metadata={'source': 'voice_assistant', 'command': command, 'action': a})
        except Exception:
            pass
    speak('Done')
    try:
        if get_memory is not None:
            get_memory().add('task_result', 'done', metadata={'source': 'voice_assistant', 'command': command})
    except Exception:
        pass


def live_loop():
    speak('Voice assistant activated. Say a command or type it.')
    time.sleep(LISTEN_RESUME_DELAY_SEC)
    while True:
        if STT_AVAILABLE and MODEL_PATH.exists():
            txt = stt_listen_once()
            if not txt:
                # fallback to typed input
                txt = text_listen_once()
        else:
            txt = text_listen_once()
        if txt:
            handle_command(txt)
        # Cooldown stops feedback loops and submit cascades after TTS responses.
        time.sleep(LISTEN_RESUME_DELAY_SEC)


def main():
    ap = argparse.ArgumentParser(prog='voice_assistant', description='Voice assistant (STT + TTS)')
    ap.add_argument('--live', action='store_true', help='Continuous listen loop')
    ap.add_argument('--command', '-c', help='Single command to run (text mode)')
    args = ap.parse_args()

    if args.command:
        handle_command(args.command)
        return
    if args.live:
        live_loop()
        return
    # interactive single prompt
    cmd = text_listen_once('Command (type): ')
    handle_command(cmd)


if __name__ == '__main__':
    main()
