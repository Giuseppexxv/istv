import test from 'node:test';
import assert from 'node:assert/strict';
import { createToastFlixClient, prepareStreams, TOASTFLIX_URL } from './toastflix.ts';

test('uses the official Italian direct configuration', () => {
  assert.deepEqual(JSON.parse(Buffer.from(TOASTFLIX_URL.split('/').pop()!, 'base64url').toString()), { soloDirect: true });
});

test('filters invalid streams, deduplicates and ranks before proxy encoding', () => {
  const result = prepareStreams([
    null, { url: 'javascript:alert(1)' }, { url: 'https://cdn.test/trailer', ytId: 'abc' },
    { name: '4K', url: 'https://cdn.test/a.mp4' },
    { name: 'ITA 1080p', url: 'https://cdn.test/b.m3u8', behaviorHints: { proxyHeaders: { request: { Origin: 'https://source.test', Host: 'unsafe' } } } },
    { name: '4K', url: 'https://cdn.test/a.mp4' },
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].name, 'ITA 1080p');
  const query = new URL(result[0].url, 'http://localhost').searchParams;
  assert.equal(query.get('url'), 'https://cdn.test/b.m3u8');
  assert.deepEqual(JSON.parse(query.get('headers')!), { Origin: 'https://source.test' });
});

test('shares concurrent requests and caches successful responses', async () => {
  let calls = 0;
  const client = createToastFlixClient((async (url) => {
    calls++;
    assert.equal(url, TOASTFLIX_URL + '/stream/series/tt123:2:3.json');
    await new Promise(resolve => setTimeout(resolve, 10));
    return Response.json({ streams: [{ url: 'https://cdn.test/a.m3u8' }] });
  }) as typeof fetch);
  const path = '/stream/series/tt123:2:3.json';
  const [a, b] = await Promise.all([client(path), client(path)]);
  assert.deepEqual(a, b);
  await client(path);
  assert.equal(calls, 1);
});

test('does not cache upstream failures and rejects arbitrary resources', async () => {
  let calls = 0;
  const client = createToastFlixClient((async () => {
    calls++;
    return calls === 1 ? new Response('', { status: 503 }) : Response.json({ streams: [] });
  }) as typeof fetch);
  await assert.rejects(client('/stream/movie/tt123.json'), /503/);
  assert.deepEqual(await client('/stream/movie/tt123.json'), { streams: [] });
  await assert.rejects(client('/configure'), /Invalid/);
  assert.equal(calls, 2);
});

test('rejects malformed upstream payloads', async () => {
  const client = createToastFlixClient((async () => Response.json({ streams: 'invalid' })) as typeof fetch);
  await assert.rejects(client('/stream/movie/tt123.json'), /Invalid/);
});
