from piper import PiperVoice
import wave, os
model = r'C:\dev\samus-manus\TTS\piper1-gpl\models\en_US-lessac-medium.onnx'
v = PiperVoice.load(model)
out = os.path.join(os.path.dirname(__file__), 'demo_installed.wav')
with wave.open(out, 'wb') as f:
    v.synthesize_wav('Boardwalk Bimbo Candi wants to be a Magazine Model for Max Hardcore!', f)
print('Wrote', out)
