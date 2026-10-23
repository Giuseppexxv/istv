import { lookup } from 'node:dns';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import { Agent, fetch as upstreamFetch } from 'undici';

export class UnsafeTargetError extends Error {}

export function isPublicAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === 'unicast';
  } catch { return false; }
}

export function validateTarget(input: string): URL {
  let url: URL;
  try { url = new URL(input); } catch { throw new UnsafeTargetError('Invalid URL'); }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
    || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')
    || !host.includes('.') && !isIP(host) || isIP(host) && !isPublicAddress(host)) {
    throw new UnsafeTargetError('Only public HTTP(S) destinations are allowed');
  }
  return url;
}

// Validate the addresses actually used by the socket, not an earlier DNS lookup.
export const publicLookup: typeof lookup = ((hostname: string, options: any, callback: any) => {
  lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) return callback(error);
    if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
      return callback(new UnsafeTargetError('Private or reserved DNS destination blocked'));
    }
    const family = typeof options === 'number' ? options : options?.family;
    const eligible = family ? addresses.filter(a => a.family === family) : addresses;
    if (!eligible.length) return callback(new Error('No address for requested family'));
    if (options?.all) callback(null, eligible);
    else callback(null, eligible[0].address, eligible[0].family);
  });
}) as typeof lookup;

const dispatcher = new Agent({ connect: { lookup: publicLookup }, connections: 8,
  keepAliveTimeout: 10000, keepAliveMaxTimeout: 30000 });

export async function safeFetch(input: string | URL, init: RequestInit = {}, requester = upstreamFetch): Promise<Response> {
  let target = validateTarget(String(input));
  const headers = new Headers(init.headers);
  for (let redirects = 0; redirects <= 5; redirects++) {
    const response = await requester(target, { ...init, signal: init.signal ?? AbortSignal.timeout(15000), headers, redirect: 'manual', dispatcher } as any);
    if (![301, 302, 303, 307, 308].includes(response.status)) return response as unknown as Response;
    const location = response.headers.get('location');
    if (!location) return response as unknown as Response;
    await response.body?.cancel();
    const next = validateTarget(new URL(location, target).href);
    if (target.origin !== next.origin) {
      headers.delete('authorization');
      headers.delete('cookie');
    }
    target = next;
  }
  throw new Error('Too many upstream redirects');
}

export async function readTextLimited(response: Response, maxBytes = 5 * 1024 * 1024): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('Upstream response exceeds size limit');
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
}

export function sanitizeHeaders(input: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return result;
  const allowed = new Set(['user-agent', 'referer', 'origin', 'cookie', 'authorization', 'accept', 'accept-language', 'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest']);
  for (const [name, value] of Object.entries(input)) {
    if (allowed.has(name.toLowerCase()) && typeof value === 'string' && value.length <= 8192 && !/[\r\n]/.test(value)) {
      result[name.toLowerCase()] = value;
    }
  }
  return result;
}
