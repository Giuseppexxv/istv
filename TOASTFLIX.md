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

Playback requests use high browser priority and are scheduled before speculative
preloads on the backend. At most one preload runs concurrently, with capacity for
four discovery requests overall. A play click promotes a queued request for the
same title without another upstream fetch. Queued work expires after 2.5 seconds;
the 15-second upstream deadline starts when its slot is granted.

Film cards preload after 350 ms of mouse hover or keyboard focus; leaving the card
cancels the timer. Save-Data users do not trigger hover preloads. The browser allows
only one speculative request at a time, at most one new request per second. Series
preloading waits for an explicit episode ID. Discovery has its own HTTP connection
pool, separate from proxied video segments, and repeated foreground calls in the
same browser share their result.

`X-ToastFlix-Cache` reports HIT, MISS or SHARED. `Server-Timing` separates queue,
upstream and total request time. HTTP Priority headers are hints to the upstream
service; they do not grant this website privileged access to ToastFlix.

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
