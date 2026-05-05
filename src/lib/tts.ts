const FEMALE_VOICE_PATTERNS = [
  'jenny',
  'jennyneural',
  'microsoft jenny',
  'en-us-jenny',
  'zira',
  'samantha',
  'victoria',
  'karen',
  'aria',
  'susan',
  'hazel',
  'female',
];

const VOICES_WAIT_TIMEOUT_MS = 1500;

function matchesAnyPattern(voice: SpeechSynthesisVoice, patterns: string[]) {
  const haystack = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  return patterns.some((pattern) => haystack.includes(pattern.toLowerCase()));
}

async function loadVoices(speechSynthesis: SpeechSynthesis) {
  const voices = speechSynthesis.getVoices();
  if (voices.length > 0) {
    return voices;
  }

  return await new Promise<SpeechSynthesisVoice[]>((resolve) => {
    let settled = false;
    const finish = (nextVoices: SpeechSynthesisVoice[]) => {
      if (settled) return;
      settled = true;
      speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      clearTimeout(timeoutId);
      resolve(nextVoices);
    };

    const handleVoicesChanged = () => finish(speechSynthesis.getVoices());
    const timeoutId = window.setTimeout(() => finish(speechSynthesis.getVoices()), VOICES_WAIT_TIMEOUT_MS);

    speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged, { once: true });
  });
}

function pickVoice(voices: SpeechSynthesisVoice[], patterns: string[]) {
  if (patterns.length === 0) {
    return voices[0] ?? null;
  }
  return voices.find((voice) => matchesAnyPattern(voice, patterns)) ?? null;
}

async function speakWithBrowserVoice(text: string, voicePatterns: string[]): Promise<boolean> {
  if (typeof window === 'undefined' || typeof window.speechSynthesis === 'undefined') {
    return false;
  }

  try {
    const speechSynthesis = window.speechSynthesis;
    speechSynthesis.cancel();

    const voices = await loadVoices(speechSynthesis);
    const selectedVoice = pickVoice(voices, voicePatterns);
    if (!selectedVoice) {
      return false;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang || 'en-US';
    utterance.volume = 1;

    const didStart = await new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const timeoutId = window.setTimeout(() => finish(false), 2500);
      utterance.onstart = () => {
        clearTimeout(timeoutId);
        finish(true);
      };
      utterance.onerror = () => {
        clearTimeout(timeoutId);
        finish(false);
      };

      speechSynthesis.speak(utterance);
    });

    return didStart;
  } catch (error) {
    console.warn('[tts] browser speech failed', error);
    return false;
  }
}

async function speakAudioUrl(audioUrl: string) {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const audio = new Audio(audioUrl);
    audio.preload = 'auto';
    await audio.play();
    return true;
  } catch (error) {
    console.warn('[tts] audio playback failed', error);
    return false;
  }
}

async function speakViaCoderobo(text: string) {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        text,
        language: 'en-US',
        voice: 'JennyNeural',
        rate: '0',
        pitch: '0',
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(body || `TTS request failed with status ${response.status}`);
    }

    const data = (await response.json()) as { audioUrl?: string };
    if (!data.audioUrl) {
      throw new Error('TTS route did not return an audioUrl');
    }

    return speakAudioUrl(data.audioUrl);
  } catch (error) {
    console.warn('[tts] coderobo speech failed', error);
    return false;
  }
}

async function speakViaVoiceProfile(text: string, profile = 'jenny-neural') {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        text,
        profile,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(body || `TTS voice profile failed with status ${response.status}`);
    }

    const data = (await response.json().catch(() => null)) as
      | { ok?: boolean; provider?: string; error?: string; detail?: string }
      | null;
    if (!data?.ok) {
      return false;
    }

    return true;
  } catch (error) {
    console.warn('[tts] voice profile speech failed', error);
    return false;
  }
}

export async function speakWithJennyOnlyVoice(text: string) {
  const viaProfile = await speakViaVoiceProfile(text, 'jenny-neural');
  if (viaProfile) {
    return true;
  }
  return speakViaCoderobo(text);
}

export async function speakWithFallbackVoice(text: string) {
  const spokeWithFemaleVoice = await speakWithBrowserVoice(text, FEMALE_VOICE_PATTERNS);
  if (spokeWithFemaleVoice) {
    return true;
  }

  return speakWithBrowserVoice(text, []);
}

export async function speakWithJennyVoice(text: string) {
  const spokeWithProfile = await speakViaVoiceProfile(text, 'jenny-neural');
  if (spokeWithProfile) {
    return true;
  }

  const spokeWithJenny = await speakViaCoderobo(text);
  if (spokeWithJenny) {
    return true;
  }

  const spokeWithFemaleVoice = await speakWithBrowserVoice(text, FEMALE_VOICE_PATTERNS);
  if (spokeWithFemaleVoice) {
    return true;
  }

  // Last resort: speak with any available browser voice so audio still works.
  return speakWithBrowserVoice(text, []);
}
