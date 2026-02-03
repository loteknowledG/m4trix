export function normalizeMomentSrc(src: string | undefined | null): string {
  if (!src) return "";
  const s = String(src);

  // Already proxied through our API route
  if (s.startsWith("/api/img?u=")) {
    return s;
  }

  // Only special-case Google Photos / googleusercontent URLs
  if (/googleusercontent\.com\//.test(s)) {
    let withSize = s;
    // Ensure a size parameter is present; '=s0' means original size.
    if (!/[?&]w=\d+/.test(withSize) && !/=[ws]\d+/.test(withSize)) {
      withSize = withSize + "=s0";
    }
    const esc = encodeURIComponent(withSize);
    return `/api/img?u=${esc}`;
  }

  return s;
}
