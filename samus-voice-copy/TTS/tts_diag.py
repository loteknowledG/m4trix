import pyttsx3
import socket
import json

print('--- TTS DIAGNOSTIC ---')

# pyttsx3 voices
try:
    e = pyttsx3.init()
    vs = [{'id': v.id, 'name': v.name} for v in e.getProperty('voices')]
    print('pyttsx3 voices:', json.dumps(vs, indent=2))
except Exception as ex:
    print('pyttsx3 init error:', ex)

# attempt to speak
try:
    e.setProperty('rate', 160)
    e.say('Local TTS check. If you can hear this, please confirm.')
    e.runAndWait()
    print('pyttsx3: spoken')
except Exception as ex:
    print('pyttsx3 speak error:', ex)

# check tts server port
s = socket.socket()
try:
    s.settimeout(0.3)
    s.connect(('127.0.0.1', 8766))
    print('tts_server: listening on 127.0.0.1:8766')
except Exception as e:
    print('tts_server: not listening or unreachable (will attempt to start via tts_say if needed) -', e)
finally:
    try:
        s.close()
    except Exception:
        pass

print('--- end diagnostic ---')
