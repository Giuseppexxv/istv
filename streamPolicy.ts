// A single policy shared by the server and browser: HTTP video through our proxy only.
export function isHttpVideoStream(stream: any): boolean {
  if (!stream || stream.infoHash || stream.ytId || typeof stream.url !== 'string') return false;
  try {
    let url = new URL(stream.url, 'https://app.invalid');
    if (stream.url.startsWith('/api/stream-proxy?')) {
      url = new URL(url.searchParams.get('url') || '');
    } else if (!/^https?:\/\//i.test(stream.url)) return false;
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      && !/\.torrent$/i.test(url.pathname) && !/magnet:|urn:btih:/i.test(url.href);
  } catch { return false; }
}

export function proxyVideoUrl(stream: any): string {
  if (!isHttpVideoStream(stream)) return '';
  if (stream.url.startsWith('/api/stream-proxy?')) return stream.url;
  const query = new URLSearchParams({ url: stream.url });
  const headers = { ...stream.headers, ...(stream.behaviorHints?.proxyHeaders?.request || {}) };
  if (Object.keys(headers).length) query.set('headers', JSON.stringify(headers));
  return `/api/stream-proxy?${query}`;
}
