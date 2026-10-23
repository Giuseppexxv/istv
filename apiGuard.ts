import type { RequestHandler } from 'express';

export function createApiGuard(maxRequests = 180, now = Date.now): RequestHandler {
  const clients = new Map<string, { count: number; mediaCount: number; active: number; reset: number }>();
  let active = 0;
  return (req, res, next) => {
    if (req.method === 'OPTIONS' || req.path === '/health') return next();
    const time = now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    for (const [ip, client] of clients) if (client.reset <= time && client.active === 0) clients.delete(ip);
    if (!clients.has(key) && clients.size >= 10000) return res.sendStatus(503);
    const client = clients.get(key) || { count: 0, mediaCount: 0, active: 0, reset: time + 60000 };
    if (client.reset <= time) { client.count = 0; client.mediaCount = 0; client.reset = time + 60000; }
    clients.set(key, client);
    const media = req.path === '/stream-proxy';
    if (media) client.mediaCount++; else client.count++;
    if (client.count > maxRequests || client.mediaCount > 3000 || client.active >= 32 || active >= 256) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((client.reset - time) / 1000))));
      return res.status(429).json({ error: 'Too many requests. Please retry shortly.' });
    }
    client.active++;
    active++;
    res.once('close', () => { client.active--; active--; });
    next();
  };
}
