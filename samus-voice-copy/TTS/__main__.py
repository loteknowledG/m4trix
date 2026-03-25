from . import speak

if __name__ == '__main__':
    import sys
    txt = ' '.join(sys.argv[1:]) or 'TTS package ready'
    speak(txt)