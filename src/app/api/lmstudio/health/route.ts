import type { NextRequest } from 'next/server';
import {
  DEFAULT_LMSTUDIO_URL,
  getLmstudioModelsUrl,
  LMSTUDIO_HEALTH_TIMEOUT_MS,
  normalizeLmstudioUrl,
  parseLmstudioModelsResponse,
} from '@/lib/lmstudio';

export const runtime = 'nodejs';
export const dynamic = "force-dynamic";

type HealthPayload = {
  ok: boolean;
  baseUrl: string;
  modelsUrl: string;
  modelCount?: number;
  models?: Array<{ id: string; label: string }>;
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

export async function GET(req: NextRequest) {
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
  const timeout = setTimeout(() => controller.abort(), LMSTUDIO_HEALTH_TIMEOUT_MS);

  try {
    const response = await fetch(modelsUrl, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
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

    let models: Array<{ id: string; label: string }> = [];
    try {
      models = parseLmstudioModelsResponse(JSON.parse(text));
    } catch {
      models = [];
    }

    const payload: HealthPayload = {
      ok: true,
      baseUrl: lmstudioUrl,
      modelsUrl,
      modelCount: models.length,
      models,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const aborted =
      (err instanceof Error && err.name === 'AbortError') ||
      (err instanceof Error && /aborted/i.test(err.message));
    const payload: HealthPayload = {
      ok: false,
      baseUrl: lmstudioUrl,
      modelsUrl,
      error: aborted
        ? `Timed out after ${LMSTUDIO_HEALTH_TIMEOUT_MS / 1000}s reaching ${modelsUrl}`
        : err instanceof Error
          ? err.message
          : String(err),
    };
    return new Response(JSON.stringify(payload), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    clearTimeout(timeout);
  }
}
