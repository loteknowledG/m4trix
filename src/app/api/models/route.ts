import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Hardcoded OpenCode endpoints.
const ZEN_CHAT_URL = 'https://opencode.ai/zen/v1/chat/completions';
const ZEN_MODELS_URL = 'https://opencode.ai/zen/v1/models';

// Google Gemini OpenAI-compatible endpoints
const GOOGLE_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/v1/models';

// Hugging Face Inference API models endpoint (simulated via chat endpoint for validation if needed, or static list)
const HUGGINGFACE_MODELS_URL =
  'https://huggingface.co/api/models?pipeline_tag=text-generation&sort=downloads&direction=-1&limit=20';

// Simple proxy to list models available to your Zen/OpenCode API key.
//
// Uses the hardcoded OpenCode models endpoint above. You can still
// override this by changing ZEN_MODELS_URL here if needed.

function deriveModelsUrlFromChatUrl(chatUrl: string | undefined): string | null {
  if (!chatUrl) return null;

  try {
    const url = new URL(chatUrl);
    // keep origin + first path segment ("/zen/v1") and then add "/models"
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length >= 2) {
      const basePath = `/${segments[0]}/${segments[1]}`;
      return `${url.origin}${basePath}/models`;
    }
    // Fallback: just use origin + "/models"
    return `${url.origin}/models`;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const overrideKey = req.headers.get('x-zen-api-key')?.trim() || null;
  const googleOverrideKey = req.headers.get('x-google-api-key')?.trim() || null;
  const nvidiaOverrideKey = req.headers.get('x-nvidia-api-key')?.trim() || null;

  const zenApiKey = overrideKey || process.env.ZEN_API_KEY;
  const googleApiKey = googleOverrideKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const hfOverrideKey = req.headers.get('x-hf-api-key')?.trim() || null;
  const hfApiKey = hfOverrideKey || process.env.HUGGINGFACE_API_KEY;
  const nvidiaApiKey = nvidiaOverrideKey || process.env.NVIDIA_API_KEY;

  if (!zenApiKey && !googleApiKey && !hfApiKey && !nvidiaApiKey) {
    return new Response('No API keys configured (Zen, Google, Hugging Face, or NVIDIA)', {
      status: 400,
    });
  }

  // If a NVIDIA key was provided, attempt real model discovery against an NVIDIA models endpoint.
  // The endpoint can be overridden by setting NVIDIA_MODELS_URL in the environment.
  if (Boolean(nvidiaOverrideKey)) {
    const nvidiaModelsUrl = process.env.NVIDIA_MODELS_URL || 'https://api.ngc.nvidia.com/v2/models';

    try {
      const resp = await fetch(nvidiaModelsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // many NVIDIA APIs accept a bearer token; accept the same key supplied by the client
          Authorization: `Bearer ${nvidiaOverrideKey}`,
        },
      });

      const bodyText = await resp.text();
      if (!resp.ok) {
        console.warn('NVIDIA models endpoint returned non-OK status', resp.status, bodyText);
        throw new Error(`NVIDIA models endpoint error ${resp.status}`);
      }

      const json = (() => {
        try {
          return JSON.parse(bodyText);
        } catch {
          return null;
        }
      })();

      // Try to extract an array of models from commonly-used keys
      const rawModels: any[] = Array.isArray(json)
        ? json
        : Array.isArray(json?.models)
        ? json.models
        : Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.results)
        ? json.results
        : Array.isArray(json?.items)
        ? json.items
        : [];

      const mapped = rawModels
        .map((m: any) => ({
          id: (m?.id || m?.model_id || m?.name || m?.modelId || '').toString(),
          display_name: m?.display_name || m?.displayName || m?.name || m?.id || '',
        }))
        .filter((x: any) => x.id);

      if (mapped.length) {
        return new Response(JSON.stringify(mapped), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Fallback: return a small example list so the UI can still function
      const fallback = [
        { id: 'nvidia/nemo-13b', display_name: 'NVIDIA NeMo - 13B' },
        { id: 'nvidia/nemo-70b', display_name: 'NVIDIA NeMo - 70B (experimental)' },
      ];
      return new Response(JSON.stringify(fallback), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.warn('NVIDIA model discovery failed:', err);
      const fallback = [
        { id: 'nvidia/nemo-13b', display_name: 'NVIDIA NeMo - 13B' },
        { id: 'nvidia/nemo-70b', display_name: 'NVIDIA NeMo - 70B (experimental)' },
      ];
      return new Response(JSON.stringify(fallback), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // If a google key is provided (or specifically requested via header), prefer it or use it.
  // In the playground, the client sends exactly one key header usually.
  const isGoogle = Boolean(
    googleOverrideKey || (googleApiKey && !zenApiKey && !overrideKey && !hfApiKey && !hfOverrideKey)
  );
  const isHF = Boolean(hfOverrideKey);

  const modelsUrl = isHF
    ? HUGGINGFACE_MODELS_URL
    : isGoogle
    ? GOOGLE_MODELS_URL
    : ZEN_MODELS_URL || deriveModelsUrlFromChatUrl(ZEN_CHAT_URL);

  const apiKeyToUse = isHF ? hfApiKey : isGoogle ? googleApiKey : zenApiKey;

  try {
    const response = await fetch(modelsUrl!, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(isHF ? {} : { Authorization: `Bearer ${apiKeyToUse}` }),
      },
    });

    const text = await response.text();

    if (!response.ok) {
      const provider = isHF ? 'Hugging Face' : isGoogle ? 'Google Gemini' : 'Zen';
      return new Response(
        `${provider} models endpoint error ${response.status}: ${text || response.statusText}`,
        { status: response.status }
      );
    }

    // Pass through JSON from provider so you can see all details.
    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error: unknown) {
    const provider = isHF ? 'Hugging Face' : isGoogle ? 'Google Gemini' : 'Zen';
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Internal error';

    return new Response(`Failed to fetch ${provider} models: ${message}`, {
      status: 500,
    });
  }
}
