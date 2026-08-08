import { get as idbGet } from 'idb-keyval';

import {
  DEFAULT_CHARACTER_TTS_VOICE,
  normalizeCharacterTtsVoice,
  resolveCharacterTtsVoice,
  type CharacterTtsVoice,
} from '@/lib/character-tts-profile';
import { storyTextForPrompt } from '@/lib/game/story-moments';
import { resolveVoiceProfileEdgeConfig } from '@/lib/voice-profile-edge';
import {
  resolveVoiceReverbImpulsePath,
  type VoiceProfileReverbConfig,
} from '@/lib/voice-profile-reverb';

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

export const VOICE_ENABLED_STORAGE_KEY = 'm4trix:voice-enabled';

export function readVoiceEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem(VOICE_ENABLED_STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

export function writeVoiceEnabled(value: boolean): void {
  try {
    window.localStorage.setItem(VOICE_ENABLED_STORAGE_KEY, String(value));
  } catch {
    /* ignore storage failures */
  }
}

export function stopActiveTts(): void {
  stopActiveAudio();
  if (typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined') {
    window.speechSynthesis.cancel();
  }
}

function sanitizeSpeechText(text: string) {
  return storyTextForPrompt(text);
}

let speakQueueTail: Promise<TtsSpeakResult> = Promise.resolve({ ok: true });
let audioContext: AudioContext | null = null;
let activeAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;
let primedAudio: HTMLAudioElement | null = null;
const impulseBufferCache = new Map<string, AudioBuffer>();

async function loadImpulseBuffer(context: AudioContext, path: string): Promise<AudioBuffer | null> {
  const cached = impulseBufferCache.get(path);
  if (cached) return cached;

  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await context.decodeAudioData(arrayBuffer.slice(0));
    impulseBufferCache.set(path, buffer);
    return buffer;
  } catch (error) {
    console.warn('[tts] failed to load reverb impulse', path, error);
    return null;
  }
}

function decodeAudioBase64(audioBase64: string): Uint8Array {
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

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

async function speakAudioBase64WebAudio(
  audioBase64: string,
  reverb?: VoiceProfileReverbConfig,
): Promise<boolean> {
  const context = getAudioContext();
  if (!context) return false;

  try {
    await context.resume();
    const bytes = decodeAudioBase64(audioBase64);
    const buffer = await context.decodeAudioData(bytes.buffer.slice(0) as ArrayBuffer);
    const source = context.createBufferSource();
    source.buffer = buffer;

    if (reverb) {
      const impulsePath = resolveVoiceReverbImpulsePath(reverb.impulseId);
      const impulse = await loadImpulseBuffer(context, impulsePath);
      if (impulse) {
        const dryGain = context.createGain();
        const wetGain = context.createGain();
        const convolver = context.createConvolver();
        convolver.buffer = impulse;
        dryGain.gain.value = reverb.dry;
        wetGain.gain.value = reverb.wet;
        source.connect(dryGain);
        source.connect(convolver);
        convolver.connect(wetGain);
        dryGain.connect(context.destination);
        wetGain.connect(context.destination);
      } else {
        source.connect(context.destination);
      }
    } else {
      source.connect(context.destination);
    }

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

async function speakAudioBase64(
  audioBase64: string,
  contentType = 'audio/mpeg',
  reverb?: VoiceProfileReverbConfig,
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (reverb) {
    stopActiveAudio();
    return speakAudioBase64WebAudio(audioBase64, reverb);
  }

  try {
    const bytes = decodeAudioBase64(audioBase64);

    stopActiveAudio();
    const url = URL.createObjectURL(new Blob([bytes.slice()], { type: contentType }));
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
    if (
      data.audioBase64 &&
      (await speakAudioBase64(
        data.audioBase64,
        data.contentType || 'audio/mpeg',
        resolveVoiceProfileEdgeConfig(profile).reverb,
      ))
    ) {
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
