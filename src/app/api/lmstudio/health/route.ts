import { DEFAULT_LMSTUDIO_URL, getLmstudioModelsUrl, normalizeLmstudioUrl } from '@/lib/lmstudio';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

type HealthPayload = {
  ok: boolean;
  baseUrl: string;
  modelsUrl: string;
  modelCount?: number;
  models?: string[];
  error?: string;
};

/** No `Request` — required for `output: "export"` prerender (avoids `request.url` dynamic). */
export async function GET() {
  const lmstudioUrl = normalizeLmstudioUrl(DEFAULT_LMSTUDIO_URL);
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
        .map((m: any) => m?.id || m?.model_id || m?.name)
        .filter((id: any): id is string => typeof id === 'string' && id.trim().length > 0);
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
