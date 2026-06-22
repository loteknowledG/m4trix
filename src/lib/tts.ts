import { get as idbGet, set as idbSet } from 'idb-keyval';

import { storyTextForPrompt } from '@/lib/game/story-moments';

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
const INTRO_TTS_CACHE_PREFIX = 'tts:intro:';

type IntroTtsCacheEntry = {
  textHash: string;
  audioBase64: string;
  updatedAt: number;
};

function sanitizeSpeechText(text: string) {
  return storyTextForPrompt(text);
}

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

async function speakAudioBase64(audioBase64: string, contentType = 'audio/mpeg') {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: contentType });
    const url = URL.createObjectURL(blob);

    try {
      const audio = new Audio(url);
      audio.preload = 'auto';
      await audio.play();
      return true;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.warn('[tts] base64 audio playback failed', error);
    return false;
  }
}

function hashText(input: string) {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
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

  const speechText = sanitizeSpeechText(text);
  if (!speechText) {
    return false;
  }

  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        text: speechText,
        profile,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(body || `TTS voice profile failed with status ${response.status}`);
    }

    const data = (await response.json().catch(() => null)) as
      | {
          ok?: boolean;
          audioBase64?: string;
          contentType?: string;
          error?: string;
          detail?: string;
        }
      | null;

    if (!data?.ok || !data.audioBase64) {
      return false;
    }

    return speakAudioBase64(data.audioBase64, data.contentType || 'audio/mpeg');
  } catch (error) {
    console.warn('[tts] voice profile speech failed', error);
    return false;
  }
}

export async function speakWithJennyVoice(text: string) {
  return speakViaVoiceProfile(text, 'jenny-neural');
}

export async function speakWithJennyOnlyVoice(text: string) {
  return speakViaVoiceProfile(text, 'jenny-neural');
}

export async function speakWithFallbackVoice(text: string) {
  const spokeWithFemaleVoice = await speakWithBrowserVoice(text, FEMALE_VOICE_PATTERNS);
  if (spokeWithFemaleVoice) {
    return true;
  }

  return speakWithBrowserVoice(text, []);
}

export async function speakWithCachedStoryIntro(text: string, storyId: string) {
  if (typeof window === 'undefined') return false;
  const normalized = sanitizeSpeechText(text);
  if (!normalized || !storyId) return false;

  const cacheKey = `${INTRO_TTS_CACHE_PREFIX}${storyId}`;
  const nextHash = hashText(normalized);

  try {
    const cached = await idbGet<IntroTtsCacheEntry>(cacheKey);
    if (cached?.textHash === nextHash && cached.audioBase64) {
      const replayed = await speakAudioBase64(cached.audioBase64);
      if (replayed) return true;
    }
  } catch {
    // ignore cache read failures
  }

  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        text: normalized,
        profile: 'jenny-neural',
      }),
    });

    if (!response.ok) {
      return false;
    }

    const data = (await response.json().catch(() => null)) as
      | { ok?: boolean; audioBase64?: string; contentType?: string }
      | null;

    if (!data?.ok || !data.audioBase64) {
      return false;
    }

    const spokeFresh = await speakAudioBase64(data.audioBase64, data.contentType || 'audio/mpeg');
    if (!spokeFresh) {
      return false;
    }

    try {
      await idbSet(cacheKey, {
        textHash: nextHash,
        audioBase64: data.audioBase64,
        updatedAt: Date.now(),
      } as IntroTtsCacheEntry);
    } catch {
      // ignore cache write failures
    }

    return true;
  } catch {
    return false;
  }
}
