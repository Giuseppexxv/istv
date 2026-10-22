export const TOASTFLIX_CONFIG = { soloDirect: true };
export const TOASTFLIX_BASE = 'https://toastflix.stremio-italia.eu';
export const TOASTFLIX_URL = `${TOASTFLIX_BASE}/${Buffer.from(JSON.stringify(TOASTFLIX_CONFIG)).toString('base64url')}`;

export function scoreStream(stream: any): number {
  const label = `${stream.name || ''} ${stream.title || ''}`.toLowerCase();
  const italian = /🇮🇹|\b(?:ita|italiano|italian)\b/.test(label);
  const hls = /\.m3u8|manifest/i.test(stream.url || '') || /\bhls\b/.test(label);
  return (italian ? 10000 : 0) + (hls ? 3000 : 0)
    + (/1080|\bfhd\b/.test(label) ? 2000 : /2160|\b4k\b/.test(label) ? 1200 : /720/.test(label) ? 600 : 0);
}

export function prepareStreams(streams: any[]): any[] {
  const seen = new Set<string>();
  return streams.filter((stream) => {
    if (!stream || typeof stream.url !== 'string' || stream.ytId || /trailer/i.test(stream.name || '')) return false;
    try {
      const url = new URL(stream.url);
      if (!['http:', 'https:'].includes(url.protocol)) return false;
    } catch { return false; }
    const key = JSON.stringify([stream.url, stream.headers, stream.behaviorHints?.proxyHeaders?.request]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => scoreStream(b) - scoreStream(a)).map((stream) => {
    const headers: Record<string, string> = {};
    const input = { ...stream.headers, ...stream.behaviorHints?.proxyHeaders?.request };
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string' && !/[\r\n]/.test(value)
        && ['user-agent', 'referer', 'origin', 'cookie', 'authorization', 'accept', 'accept-language'].includes(key.toLowerCase())) {
        headers[key] = value;
      }
    }
    const query = new URLSearchParams({ url: stream.url });
    if (Object.keys(headers).length) query.set('headers', JSON.stringify(headers));
    return { ...stream, name: stream.name || 'ToastFlix 🥪', url: `/api/stream-proxy?${query}` };
  });
}

// One upstream request per title, including concurrent clients. Short caches avoid stale signed URLs.
export function createToastFlixClient(fetcher: typeof fetch = fetch) {
  const cache = new Map<string, { expires: number; data: any }>();
  const pending = new Map<string, Promise<any>>();
  return async function request(subPath: string): Promise<any> {
    const manifest = subPath === '/manifest.json';
    if (!manifest && !/^\/stream\/(movie|series)\/[^/?#]+\.json$/.test(subPath)) {
      throw new Error('Invalid ToastFlix resource');
    }
    const cached = cache.get(subPath);
    if (cached && cached.expires > Date.now()) return cached.data;
    if (pending.has(subPath)) return pending.get(subPath)!;
    const task = (async () => {
      const response = await fetcher(`${TOASTFLIX_URL}${subPath}`, {
        headers: { Accept: 'application/json', 'Accept-Language': 'it-IT,it;q=0.9' },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`ToastFlix HTTP ${response.status}`);
      const payload = await response.json();
      if (!payload || (manifest ? typeof payload.id !== 'string' : !Array.isArray(payload.streams))) {
        throw new Error('Invalid ToastFlix response');
      }
      const data = manifest ? payload : { streams: prepareStreams(payload.streams) };
      const now = Date.now();
      for (const [key, value] of cache) if (value.expires <= now) cache.delete(key);
      if (cache.size >= 300) cache.delete(cache.keys().next().value!);
      cache.set(subPath, { data, expires: now + (manifest ? 3600000 : data.streams.length ? 120000 : 10000) });
      return data;
    })();
    pending.set(subPath, task);
    try { return await task; } finally { pending.delete(subPath); }
  };
}
