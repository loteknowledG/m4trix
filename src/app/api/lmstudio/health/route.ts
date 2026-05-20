import { NextRequest } from 'next/server';
import {
  DEFAULT_LMSTUDIO_URL,
  getLmstudioModelsUrl,
  normalizeLmstudioUrl,
  parseLmstudioModelsResponse,
} from '@/lib/lmstudio';

export const runtime = 'nodejs';

type HealthPayload = {
  ok: boolean;
  baseUrl: string;
  modelsUrl: string;
  modelCount?: number;
  models?: Array<{ id: string; label: string }>;
  error?: string;
};

export async function GET(req: NextRequest) {
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    const payload: HealthPayload = {
      ok: true,
      baseUrl: DEFAULT_LMSTUDIO_URL,
      modelsUrl: getLmstudioModelsUrl(DEFAULT_LMSTUDIO_URL),
      modelCount: 0,
      models: [],
    };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { searchParams } = new URL(req.url);
  const lmstudioUrl = normalizeLmstudioUrl(
    searchParams.get('lmstudio_url') || DEFAULT_LMSTUDIO_URL
  );
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
