# ISTV / Vivid

React and Express application for catalogs, HTTP video playback and live TV.

## Run locally

Use Node.js 22.12 or later:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. To preview the production build with its API server:

```sh
npm run build
npm run preview
```

`npm run start` runs the same compiled server. The compiled entry point serves
production assets even if the host does not set `NODE_ENV`. Never serve just
`dist/index.html` without the API server.

## Configuration

Copy `.env.example` to `.env` if needed. `TMDB_API_KEY` is optional and is used
server-side for trailer lookup. No key is bundled into the frontend. Use
`TRUST_PROXY_HOPS` only for a known trusted reverse proxy; the default is 0.
HTTPS certificate verification remains enabled.

Movies and series use **ToastFlix only**, configured for Italian direct HTTP
streams. Every selected video goes through `/api/stream-proxy`, including HLS
playlists, keys and segments. Torrent files, magnets, `infoHash` results and
external player pages are excluded on both client and server. No torrent client
or debrid service is configured. The existing live-TV integration also relays
video through the same proxy.

The relay handles browser CORS and source headers. It does not guarantee access
to every public provider: source outages, authentication and network restrictions
can still prevent playback. Private/reserved IP destinations are intentionally
blocked, including after redirects and during socket DNS resolution. Credentials
are removed on cross-origin redirects. API traffic and concurrent requests are
limited, and metadata/image response sizes and caches are bounded.

## Checks

```sh
npm run check
```

This runs TypeScript, automated regression tests and the production build. GitHub
Actions repeats the checks for pull requests and pushes to `main`.

Provider comparison: see [STREAMING.md](STREAMING.md). Third-party availability
changes over time; a successful manifest or stream listing is not proof of playback.
