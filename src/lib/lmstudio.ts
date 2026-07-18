export const DEFAULT_LMSTUDIO_URL = 'http://192.168.12.48:1234';
export const LMSTUDIO_CHAT_PATH = '/v1/chat/completions';
export const LMSTUDIO_MODELS_PATH = '/v1/models';
/** Keep trailing slash — next.config sets trailingSlash: true, so bare paths 308. */
export const LMSTUDIO_HEALTH_API_PATH = '/api/lmstudio/health/';
export const LMSTUDIO_HEALTH_TIMEOUT_MS = 20000;

export function normalizeLmstudioUrl(input: string | null | undefined): string {
  const value = (input ?? '').trim();
  if (!value) return DEFAULT_LMSTUDIO_URL;

  const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value) ? value : `http://${value}`;
  const withoutTrailingSlash = withScheme.replace(/\/$/, '');
  return withoutTrailingSlash.replace(/\/v1\/chat\/completions\/?$/, '');
}

export function getLmstudioChatUrl(input: string | null | undefined): string {
  return `${normalizeLmstudioUrl(input)}${LMSTUDIO_CHAT_PATH}`;
}

export function getLmstudioModelsUrl(input: string | null | undefined): string {
  return `${normalizeLmstudioUrl(input)}${LMSTUDIO_MODELS_PATH}`;
}

export function getLmstudioHealthApiUrl(input: string | null | undefined): string {
  return `${LMSTUDIO_HEALTH_API_PATH}?lmstudio_url=${encodeURIComponent(normalizeLmstudioUrl(input))}`;
}

export type LmstudioModelOption = { id: string; label: string };

export type LmstudioHealthResult = {
  ok: boolean;
  baseUrl: string;
  modelsUrl: string;
  modelCount: number;
  models: LmstudioModelOption[];
  error?: string;
  via: 'browser' | 'proxy';
};

/** Normalize LM Studio / OpenAI-compatible model list payloads. */
export function parseLmstudioModelsResponse(payload: unknown): LmstudioModelOption[] {
  let rawModels: unknown[] = [];
  if (Array.isArray(payload)) {
    rawModels = payload;
  } else if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.data)) rawModels = record.data;
    else if (Array.isArray(record.models)) rawModels = record.models;
  }

  return rawModels
    .map((entry): LmstudioModelOption | null => {
      if (!entry || typeof entry !== 'object') return null;
      const model = entry as Record<string, unknown>;
      const id =
        (typeof model.id === 'string' && model.id) ||
        (typeof model.model_id === 'string' && model.model_id) ||
        (typeof model.name === 'string' && model.name);
      if (!id) return null;
      const label =
        (typeof model.display_name === 'string' && model.display_name) ||
        (typeof model.name === 'string' && model.name) ||
        id;
      return { id, label };
    })
    .filter((option): option is LmstudioModelOption => Boolean(option));
}

/**
 * Probe LM Studio from the browser first (works on Vercel → LAN),
 * then fall back to the Next.js proxy (useful for local Electron/dev).
 */
export async function probeLmstudioHealth(
  input: string | null | undefined,
): Promise<LmstudioHealthResult> {
  const baseUrl = normalizeLmstudioUrl(input);
  const modelsUrl = getLmstudioModelsUrl(baseUrl);
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
      throw new Error(text || response.statusText || `HTTP ${response.status}`);
    }
    const models = parseLmstudioModelsResponse(JSON.parse(text));
    return {
      ok: true,
      baseUrl,
      modelsUrl,
      modelCount: models.length,
      models,
      via: 'browser',
    };
  } catch (browserErr) {
    try {
      const proxyRes = await fetch(getLmstudioHealthApiUrl(baseUrl), {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = (await proxyRes.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        modelCount?: number;
        models?: LmstudioModelOption[];
      } | null;

      if (proxyRes.ok && payload?.ok) {
        const models = Array.isArray(payload.models) ? payload.models : [];
        return {
          ok: true,
          baseUrl,
          modelsUrl,
          modelCount: payload.modelCount ?? models.length,
          models,
          via: 'proxy',
        };
      }

      const browserMessage =
        browserErr instanceof Error ? browserErr.message : String(browserErr);
      const proxyMessage = payload?.error || `proxy HTTP ${proxyRes.status}`;
      return {
        ok: false,
        baseUrl,
        modelsUrl,
        modelCount: 0,
        models: [],
        via: 'browser',
        error:
          `Cannot reach LM Studio at ${baseUrl}. ` +
          `Browser: ${browserMessage}. Proxy: ${proxyMessage}. ` +
          `Use a LAN URL (not localhost) and keep LM Studio's server running.`,
      };
    } catch (proxyErr) {
      const browserMessage =
        browserErr instanceof Error ? browserErr.message : String(browserErr);
      const proxyMessage = proxyErr instanceof Error ? proxyErr.message : String(proxyErr);
      return {
        ok: false,
        baseUrl,
        modelsUrl,
        modelCount: 0,
        models: [],
        via: 'browser',
        error:
          `Cannot reach LM Studio at ${baseUrl} (${browserMessage}). ` +
          `Cloud hosts cannot reach your LAN — open m4trix locally or ensure the browser can reach that IP. ` +
          `(Proxy also failed: ${proxyMessage})`,
      };
    }
  } finally {
    clearTimeout(timeout);
  }
}

export type LmstudioClientProxyPayload = {
  clientProxy?: boolean;
  url?: string;
  payload?: Record<string, unknown>;
};

const textEncoder = new TextEncoder();

/** Convert OpenAI-compatible SSE into a plain-text ReadableStream (matches /api/agents). */
export async function streamOpenAiCompatibleToText(response: Response): Promise<ReadableStream<Uint8Array>> {
  const contentType = response.headers.get('content-type') || '';
  const body = response.body;

  if (!body) {
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
  }

  if (!contentType.includes('text/event-stream')) {
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const text = await response.text();
          if (text) {
            try {
              const parsed = JSON.parse(text) as {
                choices?: Array<{ message?: { content?: unknown } }>;
              };
              const content = parsed?.choices?.[0]?.message?.content;
              if (typeof content === 'string' && content) {
                controller.enqueue(textEncoder.encode(content));
              } else {
                controller.enqueue(textEncoder.encode(text));
              }
            } catch {
              controller.enqueue(textEncoder.encode(text));
            }
          }
        } finally {
          controller.close();
        }
      },
    });
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const emit = (text: string) => {
        if (!text) return;
        controller.enqueue(textEncoder.encode(text));
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || !line.startsWith('data:')) continue;

            const data = line.slice(5).trim();
            if (data === '[DONE]') {
              controller.close();
              return;
            }

            try {
              const parsed = JSON.parse(data) as {
                choices?: Array<{
                  delta?: { content?: string; reasoning_content?: string };
                  message?: { content?: string };
                }>;
              };
              const delta =
                parsed?.choices?.[0]?.delta?.content ??
                parsed?.choices?.[0]?.delta?.reasoning_content ??
                parsed?.choices?.[0]?.message?.content ??
                '';
              if (typeof delta === 'string') emit(delta);
            } catch {
              // ignore malformed SSE chunks
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });
}

/**
 * POST /api/agents and, when the server returns an LM Studio clientProxy
 * envelope (cloud → LAN), execute that request from the browser.
 */
export async function fetchAgentsWithLmstudioBrowserProxy(
  requestBody: Record<string, unknown>,
): Promise<Response> {
  const res = await fetch('/api/agents/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) return res;

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return res;

  const data = (await res.json().catch(() => null)) as LmstudioClientProxyPayload | null;
  if (!data?.clientProxy || typeof data.url !== 'string') {
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const lmRes = await fetch(data.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data.payload ?? {}),
  });

  if (!lmRes.ok) {
    const text = await lmRes.text().catch(() => '');
    return new Response(
      JSON.stringify({
        error: `LM Studio error ${lmRes.status}: ${text || lmRes.statusText}`,
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const wantsStream = Boolean(
    data.payload && typeof data.payload === 'object' && (data.payload as { stream?: boolean }).stream,
  );

  if (wantsStream) {
    return new Response(await streamOpenAiCompatibleToText(lmRes), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  }

  const raw = await lmRes.text();
  try {
    const parsed = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = parsed?.choices?.[0]?.message?.content;
    if (typeof content === 'string') {
      return new Response(
        JSON.stringify({
          messages: [{ from: 'agent', text: content }],
          mode: 'live',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
  } catch {
    // fall through
  }

  return new Response(raw, {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
