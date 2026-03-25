"""Small demo: say 'tts enabled' using the local TTS package."""
from TTS import speak

if __name__ == '__main__':
    print("Calling TTS.speak('tts enabled')")
    res = speak('tts enabled', wait=True)
    print('Result:', res)