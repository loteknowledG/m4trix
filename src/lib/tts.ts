import { get as idbGet } from 'idb-keyval';

import {
  DEFAULT_CHARACTER_TTS_VOICE,
  normalizeCharacterTtsVoice,
  resolveCharacterTtsVoice,
  type CharacterTtsVoice,
} from '@/lib/character-tts-profile';
import { storyTextForPrompt } from '@/lib/game/story-moments';

const INTRO_TTS_CACHE_PREFIX = 'tts:intro:';

type IntroTtsCacheEntry = {
  textHash: string;
  audioBase64: string;
  updatedAt: number;
};

export type TtsSpeakResult =
  | { ok: true }
  | { ok: false; error: string };

export type TtsSpeakOptions = {
  /** When true, fall back to Jenny Neural if the selected profile fails. */
  allowFallback?: boolean;
};

function sanitizeSpeechText(text: string) {
  return storyTextForPrompt(text);
}

let speakQueueTail: Promise<TtsSpeakResult> = Promise.resolve({ ok: true });
let audioContext: AudioContext | null = null;
let activeAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;
let primedAudio: HTMLAudioElement | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextCtor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;
  if (!audioContext) {
    audioContext = new AudioContextCtor();
  }
  return audioContext;
}

/** Call synchronously from a click/pointer handler before awaiting TTS fetches. */
export function unlockAudioPlayback(): void {
  if (typeof window === 'undefined') return;

  const context = getAudioContext();
  if (context) {
    void context.resume();
  }

  try {
    if (!primedAudio) {
      primedAudio = new Audio();
      primedAudio.preload = 'auto';
    }
    primedAudio.volume = 0.001;
    primedAudio.muted = false;
    if (!primedAudio.src) {
      primedAudio.src =
        'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAA=';
    }
    void primedAudio.play().then(() => {
      primedAudio?.pause();
      if (primedAudio) primedAudio.currentTime = 0;
    }).catch(() => {
      /* ignore — best-effort unlock during user gesture */
    });
  } catch {
    /* ignore */
  }
}

function stopActiveAudio() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = '';
    activeAudio = null;
  }
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

async function speakAudioBase64WebAudio(audioBase64: string): Promise<boolean> {
  const context = getAudioContext();
  if (!context) return false;

  try {
    await context.resume();
    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    const buffer = await context.decodeAudioData(bytes.buffer.slice(0));
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);

    await new Promise<void>((resolve, reject) => {
      source.onended = () => resolve();
      try {
        source.start(0);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Audio playback failed'));
      }
    });
    return true;
  } catch (error) {
    console.warn('[tts] Web Audio playback failed', error);
    return false;
  }
}

async function speakAudioBase64(audioBase64: string, contentType = 'audio/mpeg'): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    stopActiveAudio();
    const url = URL.createObjectURL(new Blob([bytes], { type: contentType }));
    activeObjectUrl = url;
    const audio = new Audio(url);
    activeAudio = audio;
    audio.preload = 'auto';
    audio.volume = 1;

    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error('Audio playback failed'));
      void audio.play().catch(reject);
    });
    return true;
  } catch (error) {
    console.warn('[tts] HTML Audio playback failed', error);
    return speakAudioBase64WebAudio(audioBase64);
  } finally {
    if (activeAudio) {
      activeAudio = null;
    }
    if (activeObjectUrl) {
      URL.revokeObjectURL(activeObjectUrl);
      activeObjectUrl = null;
    }
  }
}

type TtsApiResponse = {
  ok?: boolean;
  audioBase64?: string;
  contentType?: string;
  error?: string;
  detail?: string;
};

async function speakViaVoiceProfile(text: string, profile: string): Promise<TtsSpeakResult> {
  if (typeof window === 'undefined') return { ok: false, error: 'TTS is unavailable in this environment.' };
  const speechText = sanitizeSpeechText(text);
  if (!speechText) return { ok: false, error: 'No speakable text after formatting.' };
  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ text: speechText, profile }),
    });
    const data = (await response.json().catch(() => null)) as TtsApiResponse | null;
    const errorMessage = data?.detail || data?.error || `TTS request failed (${response.status})`;

    if (!response.ok || !data?.ok) {
      return { ok: false, error: errorMessage };
    }
    if (data.audioBase64 && (await speakAudioBase64(data.audioBase64, data.contentType || 'audio/mpeg'))) {
      return { ok: true };
    }
    return { ok: false, error: 'TTS returned no playable audio. Check browser sound permissions and try again.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TTS request failed';
    console.warn('[tts] profile speech failed', error);
    return { ok: false, error: message };
  }
}

function hashText(input: string) {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) hash = (hash * 33) ^ input.charCodeAt(index);
  return (hash >>> 0).toString(16);
}

export async function speakWithCharacterTtsVoice(
  text: string,
  settings?: CharacterTtsVoice | string | null,
  legacyProfile?: string | null,
  options: TtsSpeakOptions = {},
): Promise<TtsSpeakResult> {
  unlockAudioPlayback();

  const run = async (): Promise<TtsSpeakResult> => {
    const allowFallback = options.allowFallback ?? false;
    const voice =
      typeof settings === 'string' || settings == null
        ? resolveCharacterTtsVoice(null, settings ?? legacyProfile)
        : resolveCharacterTtsVoice(settings, legacyProfile);

    const primary = await speakViaVoiceProfile(text, voice.profileId);
    if (primary.ok) return primary;
    if (!allowFallback || voice.profileId === DEFAULT_CHARACTER_TTS_VOICE.profileId) {
      return primary;
    }

    return speakViaVoiceProfile(text, DEFAULT_CHARACTER_TTS_VOICE.profileId);
  };

  const resultPromise = speakQueueTail.then(run, run);
  speakQueueTail = resultPromise.catch(() => ({ ok: false, error: 'TTS queue failed.' }));
  return resultPromise;
}

export async function speakWithVoiceProfile(text: string, profile?: string | CharacterTtsVoice | null) {
  if (profile && typeof profile === 'object') {
    return speakWithCharacterTtsVoice(text, profile);
  }
  return speakWithCharacterTtsVoice(text, normalizeCharacterTtsVoice(undefined, profile));
}

export async function speakWithJennyVoice(text: string) {
  return speakWithCharacterTtsVoice(text, resolveCharacterTtsVoice(null), undefined, {
    allowFallback: false,
  });
}

export async function speakWithJennyOnlyVoice(text: string) {
  return speakWithJennyVoice(text);
}

/** Resolves after all queued TTS playback finishes. */
export function waitForTtsQueueIdle(): Promise<void> {
  return speakQueueTail.then(() => undefined);
}

export async function speakWithCachedStoryIntro(text: string, storyId: string) {
  if (typeof window === 'undefined') return false;
  const normalized = sanitizeSpeechText(text);
  if (!normalized || !storyId) return false;
  const cacheKey = `${INTRO_TTS_CACHE_PREFIX}${storyId}`;
  const textHash = hashText(normalized);
  try {
    const cached = await idbGet<IntroTtsCacheEntry>(cacheKey);
    if (cached?.textHash === textHash && (await speakAudioBase64(cached.audioBase64))) return true;
  } catch {
    // A cache miss should not block speech.
  }
  const result = await speakViaVoiceProfile(normalized, DEFAULT_CHARACTER_TTS_VOICE.profileId);
  return result.ok;
}
