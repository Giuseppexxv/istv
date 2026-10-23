import test from 'node:test';
import assert from 'node:assert/strict';
import { isHttpVideoStream, proxyVideoUrl } from './streamPolicy';
import { prepareStreams } from './toastflix';

test('rejects torrent metadata even when a URL is also present', () => {
  for (const stream of [
    { infoHash: 'abc', url: 'https://cdn.test/video.mp4' },
    { url: 'magnet:?xt=urn:btih:abc' }, { url: 'https://cdn.test/file.torrent?token=x' },
    { externalUrl: 'https://player.test' }, { url: 'blob:local' },
  ]) {
    assert.equal(isHttpVideoStream(stream), false);
    assert.equal(proxyVideoUrl(stream), '');
    assert.deepEqual(prepareStreams([stream]), []);
  }
});

test('every accepted video uses the application proxy exactly once', () => {
  const url = proxyVideoUrl({ url: 'https://cdn.test/video.mp4', headers: { Origin: 'https://source.test' } });
  assert.ok(url.startsWith('/api/stream-proxy?'));
  assert.equal(new URL(url, 'https://local.test').searchParams.get('url'), 'https://cdn.test/video.mp4');
  assert.equal(proxyVideoUrl({ url }), url);
});
