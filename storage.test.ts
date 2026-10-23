import test from 'node:test';
import assert from 'node:assert/strict';

test('library synchronizes across tabs and clears; episode progress never alters another episode', async () => {
  const storage = new Map<string, string>();
  const browser = new EventTarget();
  Object.assign(globalThis, {
    window: browser,
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
  const { stremioService } = await import('./src/services/stremioService');
  const event = (key: string | null) => {
    const update = new Event('storage');
    Object.defineProperty(update, 'key', { value: key });
    browser.dispatchEvent(update);
  };
  const key = 'liquid_stremio_library_v1';
  storage.set(key, JSON.stringify([{ id: 'tt1', type: 'movie', name: 'Example' }]));
  event(key);
  assert.equal(stremioService.isInLibrary('tt1'), true);
  storage.clear();
  event(null);
  assert.equal(stremioService.isInLibrary('tt1'), false);
  stremioService.saveHistoryItem({ id: 'tt2', name: 'Series', videoId: 'tt2:1:2', currentTime: 10 });
  stremioService.savePlaybackProgress('tt2', 300, 900, 'tt2:1:1');
  assert.equal(stremioService.getHistory()[0].currentTime, 10);
  storage.set('liquid_stremio_history_v1', JSON.stringify([null, {}, { id: 'tt3', name: 'Valid' }]));
  assert.equal(stremioService.getHistory().length, 1);
});
