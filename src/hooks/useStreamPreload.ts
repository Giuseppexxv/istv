import { useCallback, useEffect, useRef } from 'react';
import { stremioService } from '../services/stremioService';

// Preload only deliberate interest, never every card rendered or touched while scrolling.
export function useStreamPreload(type: string, id: string) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const start = useCallback(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (type !== 'movie' || !id || timer.current || document.hidden || connection?.saveData) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      stremioService.preloadStream(type, id);
    }, 350);
  }, [type, id]);
  useEffect(() => cancel, [type, id, cancel]);
  return { start, cancel };
}
