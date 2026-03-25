import requests
import os

CODEROBO_API_URL = "https://tts-api.coderobo.org/tts"
DEFAULT_JWT = "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJzdWIiOiAiZGVmYXVsdF93ZWJfY2xpZW50IiwgInJvbGUiOiAidXNlciJ9.eSHTiqjO5QItqrB7UCKbW2zrYW5AFoFTwYMQ8gJa4AY"

# Example voices: 'AriaNeural', 'GuyNeural', 'JennyNeural', etc.
# Example languages: 'en-US', 'en-GB', 'es-ES', etc.
def generate_voice(text, language="en-US", voice="AriaNeural", rate=0, pitch=0, jwt_token=DEFAULT_JWT, out_path="output.mp3"):
    """
    Generate TTS audio using coderobo.org API and save as MP3.
    """
    form_data = {
        "text": text,
        "language": language,
        "voice": voice,
        "rate": str(rate),
        "pitch": str(pitch),
        "user_ip": "127.0.0.1"
    }
    headers = {"Authorization": f"Bearer {jwt_token}"}
    response = requests.post(CODEROBO_API_URL, data=form_data, headers=headers)
    response.raise_for_status()
    data = response.json()
    if "audio_url" not in data:
        raise Exception(f"API error: {data}")
    # Download audio
    audio_url = f"https://tts-api.coderobo.org{data['audio_url']}"
    audio_resp = requests.get(audio_url, headers=headers)
    audio_resp.raise_for_status()
    with open(out_path, "wb") as f:
        f.write(audio_resp.content)
    return out_path

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Generate TTS using coderobo.org API")
    parser.add_argument("text", help="Text to speak")
    parser.add_argument("--lang", default="en-US", help="Language code (default: en-US)")
    parser.add_argument("--voice", default="AriaNeural", help="Voice name (default: AriaNeural)")
    parser.add_argument("--rate", type=int, default=0, help="Speech rate (-50 to 50)")
    parser.add_argument("--pitch", type=int, default=0, help="Pitch (-20 to 20)")
    parser.add_argument("--out", default="output.mp3", help="Output MP3 file")
    args = parser.parse_args()
    out_file = generate_voice(
        text=args.text,
        language=args.lang,
        voice=args.voice,
        rate=args.rate,
        pitch=args.pitch,
        out_path=args.out
    )
    print(f"Audio saved to {out_file}")
