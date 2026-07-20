import type { NextRequest } from 'next/server';
import { DEFAULT_LMSTUDIO_URL, getLmstudioModelsUrl, normalizeLmstudioUrl } from '@/lib/lmstudio';

export const runtime = 'nodejs';
export const dynamic =
  process.env.M4TRIX_BUILD_TARGET === 'desktop' ? 'force-dynamic' : 'force-static';

type HealthPayload = {
  ok: boolean;
  baseUrl: string;
  modelsUrl: string;
  modelCount?: number;
  models?: string[];
  error?: string;
};

function resolveBaseUrl(req?: NextRequest): string {
  if (req) {
    try {
      const param = new URL(req.url).searchParams.get('lmstudio_url');
      if (param) return normalizeLmstudioUrl(param);
    } catch {
      // fall through to default
    }
  }
  return normalizeLmstudioUrl(DEFAULT_LMSTUDIO_URL);
}

export async function GET(req?: NextRequest) {
  // Pages static export: avoid reading request.url during prerender.
  if (
    process.env.NEXT_PHASE === 'phase-production-build' &&
    process.env.M4TRIX_BUILD_TARGET !== 'desktop'
  ) {
    const baseUrl = normalizeLmstudioUrl(DEFAULT_LMSTUDIO_URL);
    const payload: HealthPayload = {
      ok: false,
      baseUrl,
      modelsUrl: getLmstudioModelsUrl(baseUrl),
      error: 'Health check unavailable during static export build',
    };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const lmstudioUrl = resolveBaseUrl(req);
  const modelsUrl = getLmstudioModelsUrl(lmstudioUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(modelsUrl, {
      method: 'GET',
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      const payload: HealthPayload = {
        ok: false,
        baseUrl: lmstudioUrl,
        modelsUrl,
        error: text || response.statusText,
      };
      return new Response(JSON.stringify(payload), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let modelIds: string[] = [];
    try {
      const json = JSON.parse(text);
      const rawModels = Array.isArray(json)
        ? json
        : Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.models)
            ? json.models
            : [];
      modelIds = rawModels
        .map((m: { id?: string; model_id?: string; name?: string }) => m?.id || m?.model_id || m?.name)
        .filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0);
    } catch {
      modelIds = [];
    }

    const payload: HealthPayload = {
      ok: true,
      baseUrl: lmstudioUrl,
      modelsUrl,
      modelCount: modelIds.length,
      models: modelIds,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const payload: HealthPayload = {
      ok: false,
      baseUrl: lmstudioUrl,
      modelsUrl,
      error: err instanceof Error ? err.message : String(err),
    };
    return new Response(JSON.stringify(payload), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    clearTimeout(timeout);
  }
}
