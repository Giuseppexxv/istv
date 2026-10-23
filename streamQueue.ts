export type StreamIntent = 'play' | 'preload';
export class StreamQueueFullError extends Error {}

export interface StreamJob<T> { promise: Promise<T>; promote(): void; }

// Reserve capacity for real play clicks; speculative work can use only one slot.
export function createStreamQueue(concurrency = 4, maxPreloads = 1, queueTimeoutMs = 2500) {
  let running = 0;
  let preloading = 0;
  const waiting: Array<{ intent: StreamIntent; start(): void }> = [];

  function drain() {
    while (running < concurrency) {
      let index = waiting.findIndex(job => job.intent === 'play');
      if (index < 0 && preloading < maxPreloads) index = waiting.findIndex(job => job.intent === 'preload');
      if (index < 0) break;
      waiting.splice(index, 1)[0].start();
    }
  }

  return function schedule<T>(task: () => Promise<T>, intent: StreamIntent): StreamJob<T> {
    let started = false;
    let timeout: ReturnType<typeof setTimeout>;
    let job: (typeof waiting)[number];
    const promise = new Promise<T>((resolve, reject) => {
      if (waiting.length >= 32) { reject(new StreamQueueFullError('Stream queue busy')); return; }
      job = {
        intent,
        start() {
          started = true;
          clearTimeout(timeout);
          const backgroundSlot = job.intent === 'preload';
          running++;
          if (backgroundSlot) preloading++;
          Promise.resolve().then(task).then(resolve, reject).finally(() => {
            running--;
            if (backgroundSlot) preloading--;
            drain();
          });
        },
      };
      timeout = setTimeout(() => {
        const index = waiting.indexOf(job);
        if (index >= 0) waiting.splice(index, 1);
        reject(new StreamQueueFullError('Stream queue wait expired'));
      }, queueTimeoutMs);
      waiting.push(job);
      drain();
    });
    return { promise, promote() { if (job && !started) { job.intent = 'play'; drain(); } } };
  };
}
