# Test for Voice Skill (voice_loop.py)

import subprocess

def test_voice_loop_basic():
    result = subprocess.run(["python", "..\voice_loop.py", "Test voice output"], capture_output=True, text=True)
    assert result.returncode == 0
    assert "Test voice output" in result.stdout or result.stderr

if __name__ == "__main__":
    test_voice_loop_basic()
    print("Voice skill test passed.")
