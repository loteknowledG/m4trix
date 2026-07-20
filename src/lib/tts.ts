import { get as idbGet, set as idbSet } from 'idb-keyval';

import { storyTextForPrompt } from '@/lib/game/story-moments';

const JENNY_VOICE_PATTERNS = ['en-US-JennyNeural', 'Jenny Neural', 'Microsoft Jenny Neural', 'Jenny'];
const FEMALE_VOICE_PATTERNS = ['jenny', 'jennyneural', 'microsoft jenny', 'en-us-jenny', 'zira', 'samantha', 'victoria', 'karen', 'aria', 'susan', 'hazel', 'female'];
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
  if (voices.length) return voices;
  return new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const timeoutId = window.setTimeout(finish, VOICES_WAIT_TIMEOUT_MS);
    function finish() {
      speechSynthesis.removeEventListener('voiceschanged', finish);
      clearTimeout(timeoutId);
      resolve(speechSynthesis.getVoices());
    }
    speechSynthesis.addEventListener('voiceschanged', finish, { once: true });
  });
}

async function speakWithBrowserVoice(text: string, patterns: string[]): Promise<boolean> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  try {
    const synthesis = window.speechSynthesis;
    synthesis.cancel();
    const voices = await loadVoices(synthesis);
    const voice = patterns.length
      ? voices.find((candidate) => matchesAnyPattern(candidate, patterns))
      : voices[0];
    if (!voice) return false;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang || 'en-US';
    utterance.volume = 1;
    return await new Promise((resolve) => {
      const timeoutId = window.setTimeout(() => resolve(false), 2500);
      utterance.onstart = () => {
        clearTimeout(timeoutId);
        resolve(true);
      };
      utterance.onerror = () => {
        clearTimeout(timeoutId);
        resolve(false);
      };
      synthesis.speak(utterance);
    });
  } catch (error) {
    console.warn('[tts] browser speech failed', error);
    return false;
  }
}

async function speakAudioUrl(audioUrl: string) {
  if (typeof window === 'undefined') return false;
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
  if (typeof window === 'undefined') return false;
  try {
    const binary = atob(audioBase64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: contentType }));
    try {
      return await speakAudioUrl(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.warn('[tts] base64 audio playback failed', error);
    return false;
  }
}

async function speakViaCoderobo(text: string) {
  if (typeof window === 'undefined') return false;
  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ text, language: 'en-US', voice: 'JennyNeural', rate: '0', pitch: '0' }),
    });
    const data = (await response.json()) as { audioUrl?: string };
    return response.ok && data.audioUrl ? speakAudioUrl(data.audioUrl) : false;
  } catch (error) {
    console.warn('[tts] coderobo speech failed', error);
    return false;
  }
}

async function speakViaVoiceProfile(text: string, profile = 'jenny-neural') {
  if (typeof window === 'undefined') return false;
  const speechText = sanitizeSpeechText(text);
  if (!speechText) return false;
  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ text: speechText, profile }),
    });
    const data = (await response.json().catch(() => null)) as
      | { ok?: boolean; audioBase64?: string; contentType?: string }
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

function hashText(input: string) {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) hash = (hash * 33) ^ input.charCodeAt(index);
  return (hash >>> 0).toString(16);
}

export async function speakWithFallbackVoice(text: string) {
  return (await speakWithBrowserVoice(text, FEMALE_VOICE_PATTERNS)) || speakWithBrowserVoice(text, []);
}

export async function speakWithJennyVoice(text: string) {
  return (
    (await speakViaVoiceProfile(text)) ||
    (await speakViaCoderobo(text)) ||
    (await speakWithBrowserVoice(text, JENNY_VOICE_PATTERNS)) ||
    speakWithFallbackVoice(text)
  );
}

export async function speakWithJennyOnlyVoice(text: string) {
  return speakWithJennyVoice(text);
}

export async function speakWithCachedStoryIntro(text: string, storyId: string) {
  if (typeof window === 'undefined') return false;
  const normalized = sanitizeSpeechText(text);
  if (!normalized || !storyId) return false;
  const cacheKey = `${INTRO_TTS_CACHE_PREFIX}${storyId}`;
  const textHash = hashText(normalized);
  try {
    const cached = await idbGet<IntroTtsCacheEntry>(cacheKey);
    if (cached?.textHash === textHash && await speakAudioBase64(cached.audioBase64)) return true;
  } catch {
    // A cache miss should not block speech.
  }
  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ text: normalized, profile: 'jenny-neural' }),
    });
    const data = (await response.json().catch(() => null)) as
      | { ok?: boolean; audioBase64?: string; contentType?: string }
      | null;
    if (!data?.ok || !data.audioBase64 || !(await speakAudioBase64(data.audioBase64, data.contentType))) {
      return speakWithJennyVoice(normalized);
    }
    await idbSet(cacheKey, { textHash, audioBase64: data.audioBase64, updatedAt: Date.now() });
    return true;
  } catch {
    return speakWithJennyVoice(normalized);
  }
}
