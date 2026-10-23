# ToastFlix integration

The backend uses the official ToastFlix configuration `{ "soloDirect": true }`,
encoded as base64url in the upstream URL. Multi Language is off (Italian default).
No external dual-audio server, credentials or paid service is required. Full HD
is preferred in sorting, but other resolutions remain available.

The client requests one configured endpoint per title, with a 15-second upstream
deadline inside the frontend's 20-second budget. Concurrent requests share the
same promise. Successful stream responses expire after two minutes, empty results
after ten seconds; failed requests are not cached. The server cache holds at most
300 entries. A series request preserves its explicit episode ID.

Only HTTP(S) video URLs are passed to the player. Streams are ranked before proxy
encoding; duplicate URL/header combinations and trailers are removed. Required
playback headers are preserved through the proxy. HLS relative paths resolve
against the final upstream URL after redirects, including keys and sub-playlists.
The video proxy limits the initial response wait without imposing an 18-second
limit on the whole transfer.

Validation: `npm test`, `npm run lint`, `npm run build`. The official configured
manifest was checked live. Production smoke checks also verified redirected HLS
paths, Origin propagation and a 19-second local video transfer. Playback against
third-party content sources has not been verified and remains source-dependent.

HTTPS certificates are verified. Public destination checks apply at URL parsing,
redirect handling and socket DNS lookup; generic proxy traffic is rate-limited.
Torrent metadata and torrent URLs are rejected on server and client. Movies and
series query only this addon, and every accepted video uses the application proxy.
