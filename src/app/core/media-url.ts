/** Point API asset URLs at this device’s host so phone/LAN previews load. */
export function rewriteMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (typeof window === 'undefined') return url;
  if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('assets/')) return url;
  try {
    const parsed = new URL(url, window.location.origin);
    if (!/\/(assets|uploads)\//.test(parsed.pathname)) return url;
    parsed.protocol = window.location.protocol;
    parsed.hostname = window.location.hostname;
    return parsed.toString();
  } catch {
    return url;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  if (typeof Blob !== 'undefined' && value instanceof Blob) return false;
  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function rewriteAssetUrlsInJson<T>(body: T): T {
  if (body === null || body === undefined) return body;
  if (typeof body === 'string') {
    return (rewriteMediaUrl(body) ?? body) as T;
  }
  if (Array.isArray(body)) {
    return body.map((item) => rewriteAssetUrlsInJson(item)) as T;
  }
  if (isPlainRecord(body)) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      out[key] = rewriteAssetUrlsInJson(value);
    }
    return out as T;
  }
  return body;
}
