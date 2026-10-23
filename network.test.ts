import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicAddress, validateTarget, publicLookup, safeFetch, readTextLimited, sanitizeHeaders } from './network';

test('blocks private, loopback, link-local and mapped IP destinations', () => {
  for (const host of ['127.0.0.1', '10.0.1.2', '172.16.1.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '::1', 'fe80::1', 'fc00::1', '::ffff:127.0.0.1']) {
    assert.equal(isPublicAddress(host), false, host);
    assert.throws(() => validateTarget(`http://${host.includes(':') ? `[${host}]` : host}/`));
  }
  for (const url of ['file:///etc/passwd', 'http://localhost/', 'http://127.1/', 'http://2130706433/', 'http://0x7f000001/', 'http://user:password@example.com/', 'https://server.local/', 'https://localhost./']) {
    assert.throws(() => validateTarget(url), url);
  }
  assert.equal(validateTarget('https://8.8.8.8/path').hostname, '8.8.8.8');
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
});

test('socket DNS lookup refuses a hostname resolving to loopback', async () => {
  await assert.rejects(new Promise((resolve, reject) => {
    publicLookup('localhost', { all: true }, (error, addresses) => error ? reject(error) : resolve(addresses));
  }), /blocked/);
});

test('redirect to a private destination is blocked before a second request', async () => {
  let calls = 0;
  const requester = (async () => { calls++; return new Response('', { status: 302, headers: { location: 'http://127.0.0.1/secret' } }); }) as any;
  await assert.rejects(safeFetch('https://example.com', {}, requester), /public/);
  assert.equal(calls, 1);
});

test('cross-origin redirect drops credentials and preserves request cancellation', async () => {
  const controller = new AbortController();
  let calls = 0;
  const requester = (async (_url: URL, options: any) => {
    assert.equal(options.signal, controller.signal);
    if (++calls === 1) return new Response('', { status: 302, headers: { location: 'https://cdn.example.net/video' } });
    assert.equal(options.headers.has('authorization'), false);
    assert.equal(options.headers.has('cookie'), false);
    return new Response('ok');
  }) as any;
  assert.equal(await (await safeFetch('https://example.com', { signal: controller.signal, headers: { Authorization: 'secret', Cookie: 'secret' } }, requester)).text(), 'ok');
});

test('bounded response reader counts bytes and refuses oversized bodies', async () => {
  assert.equal(await readTextLimited(new Response('ciao'), 4), 'ciao');
  await assert.rejects(readTextLimited(new Response('èèè'), 5), /size limit/);
});

test('only supported playback headers survive sanitization', () => {
  assert.deepEqual(sanitizeHeaders({ Host: 'localhost', ORIGIN: 'https://source.test', Cookie: 'x=1', Referer: 'bad\r\nheader', Connection: 'close' }), { origin: 'https://source.test', cookie: 'x=1' });
});
