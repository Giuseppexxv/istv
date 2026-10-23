import test from 'node:test';
import assert from 'node:assert/strict';
import { createStreamQueue } from './streamQueue';

const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

test('play starts without waiting for a speculative preload slot', async () => {
  const schedule = createStreamQueue(2, 1);
  const hold = deferred();
  const order: string[] = [];
  const a = schedule(async () => { order.push('preload-a'); await hold.promise; }, 'preload');
  const b = schedule(async () => { order.push('preload-b'); }, 'preload');
  const play = schedule(async () => { order.push('play'); }, 'play');
  await tick();
  assert.deepEqual(order, ['preload-a', 'play']);
  hold.resolve();
  await Promise.all([a.promise, b.promise, play.promise]);
  assert.deepEqual(order, ['preload-a', 'play', 'preload-b']);
});

test('a selected queued preload moves ahead of older speculative work', async () => {
  const schedule = createStreamQueue(1, 1);
  const hold = deferred();
  const order: string[] = [];
  const active = schedule(() => hold.promise, 'play');
  const older = schedule(async () => { order.push('older'); }, 'preload');
  const selected = schedule(async () => { order.push('selected'); }, 'preload');
  selected.promote();
  hold.resolve();
  await Promise.all([active.promise, older.promise, selected.promise]);
  assert.deepEqual(order, ['selected', 'older']);
});

test('expired queued jobs never call the upstream', async () => {
  const schedule = createStreamQueue(1, 1, 20);
  const hold = deferred();
  const active = schedule(() => hold.promise, 'play');
  let called = false;
  const waiting = schedule(async () => { called = true; }, 'play');
  await assert.rejects(waiting.promise, /wait expired/);
  hold.resolve();
  await active.promise;
  assert.equal(called, false);
});
