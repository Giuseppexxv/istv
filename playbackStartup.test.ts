import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaybackStartup } from './src/utils/playbackStartup';

test('startup warning waits a full minute, including discovery and early failures', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const warnings: string[] = [];
  const startup = createPlaybackStartup(message => warnings.push(message));
  t.mock.timers.tick(20_000);
  startup.reportFailure('Nessun flusso disponibile');
  t.mock.timers.tick(39_999);
  assert.deepEqual(warnings, []);
  assert.equal(startup.waiting, true);
  t.mock.timers.tick(1);
  assert.deepEqual(warnings, ['Nessun flusso disponibile']);
  assert.equal(startup.waiting, false);
  startup.dispose();
});

test('successful playback cancels the startup warning; later playback errors are immediate', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const warnings: string[] = [];
  const startup = createPlaybackStartup(message => warnings.push(message));
  t.mock.timers.tick(45_000);
  startup.complete();
  t.mock.timers.tick(30_000);
  assert.deepEqual(warnings, []);
  startup.reportFailure('Riproduzione interrotta');
  assert.deepEqual(warnings, ['Riproduzione interrotta']);
  startup.dispose();
});

test('closing the player cancels pending warnings', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let warned = false;
  const startup = createPlaybackStartup(() => { warned = true; });
  startup.dispose();
  startup.reportFailure('Late response');
  t.mock.timers.tick(60_000);
  assert.equal(warned, false);
});
