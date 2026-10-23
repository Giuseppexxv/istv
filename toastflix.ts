import { fetchStreamDiscovery, readTextLimited } from './network';
import { isHttpVideoStream } from './streamPolicy';
import { createStreamQueue, type StreamIntent, type StreamJob } from './streamQueue';

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
    if (!isHttpVideoStream(stream) || /trailer/i.test(stream.name || '')) return false;
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
        && ['user-agent', 'referer', 'origin', 'cookie', 'authorization', 'accept', 'accept-language', 'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest'].includes(key.toLowerCase())) {
        headers[key] = value;
      }
    }
    const query = new URLSearchParams({ url: stream.url });
    if (Object.keys(headers).length) query.set('headers', JSON.stringify(headers));
    return { ...stream, name: stream.name || 'ToastFlix 🥪', url: `/api/stream-proxy?${query}` };
  });
}

export interface ToastFlixTiming {
  cache: 'hit' | 'miss' | 'shared';
  queueMs: number;
  upstreamMs: number;
  totalMs: number;
}

// Share discovery per title and prioritize playback over speculative preloads.
export function createToastFlixClient(fetcher: typeof fetch = fetchStreamDiscovery as typeof fetch) {
  const cache = new Map<string, { expires: number; data: any }>();
  type Loaded = { data: any; queueMs: number; upstreamMs: number };
  const pending = new Map<string, StreamJob<Loaded>>();
  const schedule = createStreamQueue();
  return async function request(subPath: string, options: {
    intent?: StreamIntent; onTiming?: (timing: ToastFlixTiming) => void;
  } = {}): Promise<any> {
    const requestedAt = performance.now();
    const manifest = subPath === '/manifest.json';
    if (!manifest && !/^\/stream\/(movie|series)\/[^/?#]+\.json$/.test(subPath)) {
      throw new Error('Invalid ToastFlix resource');
    }
    const cached = cache.get(subPath);
    if (cached && cached.expires > Date.now()) {
      options.onTiming?.({ cache: 'hit', queueMs: 0, upstreamMs: 0, totalMs: performance.now() - requestedAt });
      return cached.data;
    }
    const existing = pending.get(subPath);
    if (existing) {
      if (options.intent !== 'preload') existing.promote();
      const result = await existing.promise;
      options.onTiming?.({ cache: 'shared', queueMs: result.queueMs, upstreamMs: result.upstreamMs, totalMs: performance.now() - requestedAt });
      return result.data;
    }
    let intent = options.intent || 'play';
    const job = schedule(async () => {
      const startedAt = performance.now();
      const response = await fetcher(`${TOASTFLIX_URL}${subPath}`, {
        headers: { Accept: 'application/json', 'Accept-Language': 'it-IT,it;q=0.9', Priority: intent === 'play' ? 'u=0' : 'u=6' },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`ToastFlix HTTP ${response.status}`);
      const payload = JSON.parse(await readTextLimited(response));
      if (!payload || (manifest ? typeof payload.id !== 'string' : !Array.isArray(payload.streams))) {
        throw new Error('Invalid ToastFlix response');
      }
      const data = manifest ? payload : { streams: prepareStreams(payload.streams) };
      const now = Date.now();
      for (const [key, value] of cache) if (value.expires <= now) cache.delete(key);
      if (cache.size >= 300) cache.delete(cache.keys().next().value!);
      cache.set(subPath, { data, expires: now + (manifest ? 3600000 : data.streams.length ? 120000 : 10000) });
      return { data, queueMs: startedAt - requestedAt, upstreamMs: performance.now() - startedAt };
    }, intent);
    pending.set(subPath, { promise: job.promise, promote() { intent = 'play'; job.promote(); } });
    try {
      const result = await job.promise;
      options.onTiming?.({ cache: 'miss', queueMs: result.queueMs, upstreamMs: result.upstreamMs, totalMs: performance.now() - requestedAt });
      return result.data;
    } finally { pending.delete(subPath); }
  };
}
