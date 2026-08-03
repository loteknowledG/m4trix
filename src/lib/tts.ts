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

let activeAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;
let speakQueueTail: Promise<TtsSpeakResult> = Promise.resolve({ ok: true });

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

async function speakAudioBase64(audioBase64: string, contentType = 'audio/mpeg') {
  if (typeof window === 'undefined') return false;
  try {
    const binary = atob(audioBase64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    stopActiveAudio();
    const url = URL.createObjectURL(new Blob([bytes], { type: contentType }));
    activeObjectUrl = url;
    const audio = new Audio(url);
    activeAudio = audio;
    audio.preload = 'auto';
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error('Audio playback failed'));
      void audio.play().catch(reject);
    });
    return true;
  } catch (error) {
    console.warn('[tts] base64 audio playback failed', error);
    return false;
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
    return { ok: false, error: 'TTS returned no playable audio.' };
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
