export const PLAYBACK_STARTUP_TIMEOUT_MS = 60_000;

// One deadline covers discovery and video startup, including automatic source changes.
export function createPlaybackStartup(onWarning: (message: string) => void) {
  let state: 'waiting' | 'playing' | 'expired' | 'disposed' = 'waiting';
  let message = 'Il flusso non risponde dopo un minuto. Puoi riprovare o cambiare sorgente dalle impostazioni.';
  const timer = setTimeout(() => {
    if (state !== 'waiting') return;
    state = 'expired';
    onWarning(message);
  }, PLAYBACK_STARTUP_TIMEOUT_MS);
  return {
    get waiting() { return state === 'waiting'; },
    reportFailure(reason: string) {
      message = reason;
      if (state === 'expired' || state === 'playing') onWarning(reason);
    },
    complete() {
      if (state === 'disposed') return;
      clearTimeout(timer);
      state = 'playing';
    },
    dispose() { clearTimeout(timer); state = 'disposed'; },
  };
}
