// Runs on the Next.js server at startup. Used to attach telemetry or guards.
// This wraps console methods to cap the size of messages forwarded by Next dev tooling,
// preventing RangeError: Max payload size exceeded (WS_ERR_UNSUPPORTED_MESSAGE_LENGTH).

function createSafeStringifier(limit: number) {
  const seen = new WeakSet<any>();
  const replacer = (_key: string, value: any) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
    }
    if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;
    return value;
  };

  const truncate = (s: string) => (s.length > limit ? s.slice(0, limit) + "… [truncated]" : s);

  return (arg: any) => {
    try {
      if (typeof arg === "string") return truncate(arg);
      // Prefer stable JSON for objects/arrays, fall back to String()
      const s = JSON.stringify(arg, replacer);
      if (typeof s === "string") return truncate(s);
      return truncate(String(arg));
    } catch {
      return truncate(String(arg));
    }
  };
}

function wrapConsole(limitBytes: number) {
  const stringify = createSafeStringifier(limitBytes);
  const orig = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    dir: console.dir,
  } as const;

  const wrap = (fn: (...args: any[]) => void) =>
    (...args: any[]) => fn(...args.map((a) => stringify(a)));

  console.log = wrap(orig.log);
  console.info = wrap(orig.info);
  console.warn = wrap(orig.warn);
  console.error = wrap(orig.error);
  console.dir = wrap(orig.dir);
}

export async function register() {
  // Only attach on server runtime; client/browser is unaffected.
  const isServer = typeof window === "undefined";
  if (!isServer) return;

  // Default cap ~1 MiB per argument. Tunable via env.
  const limit = Number((globalThis as any).process?.env?.LOG_MAX_BYTES ?? 1024 * 1024);
  // Avoid double-wrapping if hot reloaded.
  if (!(globalThis as any).__LOG_GUARD_INSTALLED__) {
    wrapConsole(limit);
    (globalThis as any).__LOG_GUARD_INSTALLED__ = true;
  }
}
