export const DEFAULT_LMSTUDIO_URL = 'http://192.168.12.48:1234';
export const LMSTUDIO_CHAT_PATH = '/v1/chat/completions';
export const LMSTUDIO_MODELS_PATH = '/v1/models';
/** Keep trailing slash — next.config sets trailingSlash: true, so bare paths 308. */
export const LMSTUDIO_HEALTH_API_PATH = '/api/lmstudio/health/';
export const LMSTUDIO_HEALTH_TIMEOUT_MS = 12000;
export const LMSTUDIO_CHAT_TIMEOUT_MS = 180000;

export function getLmstudioHttpsPageHint(pageOrigin?: string): string {
  const origin = pageOrigin || (typeof window !== 'undefined' ? window.location.origin : 'this HTTPS page');
  return (
    `Browsers block ${origin} from calling http:// LM Studio (mixed content). ` +
    `Open http://localhost:3000 (pnpm dev) or set an https:// tunnel URL for LM Studio.`
  );
}

/** @deprecated use getLmstudioHttpsPageHint() — kept for older call sites */
export const LMSTUDIO_SECURE_CONTEXT_HINT = getLmstudioHttpsPageHint('https://m4trix.vercel.app');

export function normalizeLmstudioUrl(input: string | null | undefined): string {
  const value = (input ?? '').trim();
  if (!value) return DEFAULT_LMSTUDIO_URL;

  const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value) ? value : `http://${value}`;
  let normalized = withScheme.replace(/\/+$/, '');
  normalized = normalized.replace(/\/v1\/chat\/completions\/?$/i, '');
  normalized = normalized.replace(/\/v1\/models\/?$/i, '');
  normalized = normalized.replace(/\/v1\/?$/i, '');
  return normalized;
}

function parseLmstudioHostname(baseUrl: string): string | null {
  try {
    return new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** True when LM Studio is on RFC1918 / link-local (browser PNA often blocks from localhost). */
export function isPrivateLanLmstudioHost(baseUrl: string): boolean {
  const hostname = parseLmstudioHostname(baseUrl);
  if (!hostname) return false;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return false;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^10\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  if (/^169\.254\./.test(hostname)) return true;
  return false;
}

/** Node proxy can reach LAN when the app is served over local http (dev / Electron). */
export function canUseLmstudioServerProxy(): boolean {
  if (typeof window === 'undefined') return true;
  const { protocol, hostname } = window.location;
  if (protocol !== 'http:') {
    return hostname === 'localhost' || hostname === '127.0.0.1';
  }
  return true;
}

export function shouldPreferLmstudioProxy(baseUrl: string): boolean {
  if (!canUseLmstudioServerProxy()) return false;
  if (typeof window === 'undefined') return true;

  const pageHostname = window.location.hostname.toLowerCase();
  const pageIsLocal =
    pageHostname === 'localhost' || pageHostname === '127.0.0.1' || pageHostname === '[::1]';

  if (pageIsLocal && isPrivateLanLmstudioHost(baseUrl)) return true;
  return pageIsLocal;
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

/**
 * HTTPS pages cannot call http:// LM Studio (mixed content).
 * http://localhost is a "secure context" but is NOT https — LAN HTTP works there.
 */
export function getLmstudioBrowserReachabilityError(
  input: string | null | undefined,
): string | null {
  if (typeof window === 'undefined') return null;
  if (window.location.protocol !== 'https:') return null;

  try {
    const url = new URL(normalizeLmstudioUrl(input));
    if (url.protocol !== 'http:') return null;
    return getLmstudioHttpsPageHint(window.location.origin);
  } catch {
    return null;
  }
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

type LmstudioHealthProxyPayload = {
  ok?: boolean;
  error?: string;
  modelCount?: number;
  models?: LmstudioModelOption[];
  skipServerCheck?: boolean;
};

async function probeLmstudioViaBrowser(
  baseUrl: string,
  modelsUrl: string,
): Promise<LmstudioHealthResult> {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      baseUrl,
      modelsUrl,
      modelCount: 0,
      models: [],
      via: 'browser',
      error: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function probeLmstudioViaProxy(
  baseUrl: string,
  modelsUrl: string,
): Promise<LmstudioHealthResult> {
  try {
    const proxyRes = await fetch(getLmstudioHealthApiUrl(baseUrl), {
      method: 'GET',
      cache: 'no-store',
    });
    const payload = (await proxyRes.json().catch(() => null)) as LmstudioHealthProxyPayload | null;

    if (payload?.skipServerCheck) {
      return {
        ok: false,
        baseUrl,
        modelsUrl,
        modelCount: 0,
        models: [],
        via: 'proxy',
        error:
          'Tunnel URL detected. Server-side check skipped — use browser reachability or confirm the tunnel is active.',
      };
    }

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

    return {
      ok: false,
      baseUrl,
      modelsUrl,
      modelCount: 0,
      models: [],
      via: 'proxy',
      error: payload?.error || `proxy HTTP ${proxyRes.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      baseUrl,
      modelsUrl,
      modelCount: 0,
      models: [],
      via: 'proxy',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function formatLmstudioHealthFailure(
  baseUrl: string,
  browserError: string | undefined,
  proxyError: string | undefined,
  mixedContentHint: string | null,
): string {
  if (mixedContentHint && !proxyError) return mixedContentHint;

  const parts: string[] = [];
  if (proxyError) parts.push(`Proxy: ${proxyError}`);
  if (browserError) parts.push(`Browser: ${browserError}`);
  if (mixedContentHint) parts.push(mixedContentHint);

  const detail = parts.length ? parts.join('. ') : `Cannot reach LM Studio at ${baseUrl}`;
  return `${detail}. Use the base URL only (e.g. http://192.168.12.48:1234), not /v1/models.`;
}

/**
 * Probe LM Studio health. Local dev / Electron prefers the Next.js proxy first
 * (Node can reach LAN; browser fetch often fails Private Network Access).
 * HTTPS deploys try browser first for tunnel URLs; Vercel cannot reach LAN.
 */
export async function probeLmstudioHealth(
  input: string | null | undefined,
): Promise<LmstudioHealthResult> {
  const baseUrl = normalizeLmstudioUrl(input);
  const modelsUrl = getLmstudioModelsUrl(baseUrl);
  const mixedContentHint = getLmstudioBrowserReachabilityError(baseUrl);
  const preferProxy = shouldPreferLmstudioProxy(baseUrl);

  if (mixedContentHint && !canUseLmstudioServerProxy()) {
    return {
      ok: false,
      baseUrl,
      modelsUrl,
      modelCount: 0,
      models: [],
      via: 'browser',
      error: mixedContentHint,
    };
  }

  let browserResult: LmstudioHealthResult | undefined;
  let proxyResult: LmstudioHealthResult | undefined;

  const tryBrowser = async () => {
    if (mixedContentHint) return;
    browserResult = await probeLmstudioViaBrowser(baseUrl, modelsUrl);
    if (browserResult.ok) return browserResult;
    return undefined;
  };

  const tryProxy = async () => {
    if (!canUseLmstudioServerProxy()) return;
    proxyResult = await probeLmstudioViaProxy(baseUrl, modelsUrl);
    if (proxyResult.ok) return proxyResult;
    return undefined;
  };

  if (preferProxy) {
    const proxyOk = await tryProxy();
    if (proxyOk) return proxyOk;
    const browserOk = await tryBrowser();
    if (browserOk) return browserOk;
  } else {
    const browserOk = await tryBrowser();
    if (browserOk) return browserOk;
    const proxyOk = await tryProxy();
    if (proxyOk) return proxyOk;
  }

  return {
    ok: false,
    baseUrl,
    modelsUrl,
    modelCount: 0,
    models: [],
    via: preferProxy ? 'proxy' : 'browser',
    error: formatLmstudioHealthFailure(
      baseUrl,
      browserResult?.error,
      proxyResult?.error,
      mixedContentHint,
    ),
  };
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

  const blocked = getLmstudioBrowserReachabilityError(data.url);
  if (blocked) {
    return new Response(JSON.stringify({ error: blocked }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LMSTUDIO_CHAT_TIMEOUT_MS);

  let lmRes: Response;
  try {
    lmRes = await fetch(data.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data.payload ?? {}),
      signal: controller.signal,
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return new Response(
      JSON.stringify({
        error: aborted
          ? `LM Studio timed out after ${LMSTUDIO_CHAT_TIMEOUT_MS / 1000}s. Try a smaller/faster model, or confirm the server is still generating.`
          : err instanceof Error
            ? err.message
            : String(err),
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  } finally {
    clearTimeout(timeout);
  }

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
