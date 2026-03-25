"""TTS package — lightweight facade for the TTS utilities in this folder.

Usage:
  from TTS import speak
  speak("hello world")

The facade prefers the persistent `tts_server` (websocket) and falls back to
one-shot `pyttsx3` if the server or websocket is unavailable.
"""
import asyncio
from typing import Any, Dict, Optional

from . import tts_say as _tts_say

__all__ = ["speak"]


def speak(text: str, rate: Optional[int] = None, voice: Optional[str] = None, wait: bool = True) -> Any:
    """Speak `text` using the bundled TTS server when possible, otherwise fallback to pyttsx3.

    Returns the server response on success or a dict with an error key on failure.
    """
    # Try persistent websocket server first
    try:
        _tts_say.ensure_server()
        try:
            return asyncio.run(_tts_say.send(text, rate=rate, voice=voice, wait=wait))
        except BaseException:
            # websocket/send raised KeyboardInterrupt/CancelledError — fall back to one-shot
            pass
    except Exception:
        # best-effort: fall through to one-shot fallback
        pass

    # Fallback: one-shot pyttsx3
    try:
        import pyttsx3
        e = pyttsx3.init()
        if rate:
            e.setProperty('rate', rate)
        if voice:
            try:
                e.setProperty('voice', voice)
            except Exception:
                pass
        e.say(text)
        e.runAndWait()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}
