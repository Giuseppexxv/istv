import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { BoundedCache } from './cache';
import { createApiGuard } from './apiGuard';
import { isAlreadyReleased, rankFamousItems } from './src/utils/releaseFilter';

test('cache removes expired entries and never exceeds its entry limit', () => {
  const cache = new BoundedCache<string, { expires: number }>(2);
  cache.set('expired', { expires: Date.now() - 1 });
  assert.equal(cache.get('expired'), undefined);
  cache.set('a', { expires: Date.now() + 60000 });
  cache.set('b', { expires: Date.now() + 60000 });
  cache.set('c', { expires: Date.now() + 60000 });
  assert.equal(cache.size, 2);
  assert.equal(cache.has('a'), false);
});

test('release filtering allows previously blacklisted titles after their release', () => {
  const item = { id: 'test', name: 'Toy Story 5', type: 'movie', poster: 'https://example.com/poster', releaseInfo: '2026-06-01' };
  assert.equal(isAlreadyReleased(item, new Date(2026, 9, 22)), true);
  assert.equal(isAlreadyReleased({ ...item, releaseInfo: '2027-06-01' }, new Date(2026, 9, 22)), false);
  assert.equal(isAlreadyReleased({ ...item, status: 'In Production' } as any), false);
  assert.equal(isAlreadyReleased({ id: 'unknown', type: 'movie', name: 'Unscheduled Sequel', poster: 'https://example.com/poster' }), false);
});

test('search treats leading title articles consistently and ranks a rated exact match first', () => {
  const items = [
    { id: 'series', type: 'series', name: 'Matrix', releaseInfo: '1993' },
    { id: 'film', type: 'movie', name: 'The Matrix', releaseInfo: '1999', imdbRating: '8.7' },
    { id: 'making', type: 'movie', name: 'Making The Matrix', releaseInfo: '1999', imdbRating: '8.6' },
  ];
  assert.equal(rankFamousItems(items, 'Matrix')[0].id, 'film');
});

test('API quota resets after its window and releases completed connections', () => {
  let time = 0;
  const guard = createApiGuard(2, () => time);
  const request = { method: 'GET', path: '/stremio-proxy', ip: 'test', socket: {} } as any;
  function run() {
    const response = new EventEmitter() as any;
    let passed = false;
    response.setHeader = () => {};
    response.status = (code: number) => { response.code = code; return response; };
    response.json = () => {};
    guard(request, response, () => { passed = true; });
    response.emit('close');
    return { passed, code: response.code };
  }
  assert.equal(run().passed, true);
  assert.equal(run().passed, true);
  assert.equal(run().code, 429);
  time = 60001;
  assert.equal(run().passed, true);
});
