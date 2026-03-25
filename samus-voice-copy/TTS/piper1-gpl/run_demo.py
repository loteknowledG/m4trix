import wave
from piper import PiperVoice

voice = PiperVoice.load('models/en_US-lessac-medium.onnx')
with wave.open('demo.wav', 'wb') as wav_file:
    voice.synthesize_wav('Hello from Piper. This is a local demo of Piper TTS.', wav_file)
print('Wrote demo.wav')
