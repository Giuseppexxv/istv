# Streaming source selection

Checked on 23 October 2026 (Europe/Rome), using the official configuration pages
and three requests per source: a film, a series episode and another film.
No paid/external EasyProxy or MediaFlow service was configured for this comparison.

| Source | Configuration | Requests with HTTP results | Response times |
| --- | --- | --- | --- |
| ToastFlix | `soloDirect: true`, Italian default | 2 / 3 | 1.2–3.9 s |
| EasyStreams | HTTP preference, EasyJack disabled | 1 / 3 | 13.9–15.4 s |
| StreamVix | documented direct-capable film/series providers, trailers off | 0 / 3 | 16.4–16.5 s; one 18 s timeout |

**Selected: ToastFlix**, as the fastest usable candidate in this limited sample.
The series sample returned no ToastFlix streams. This is not a universal coverage
or playback guarantee. The other two addons are not enabled as fallback sources.

Official pages:
- https://toastflix.stremio-italia.eu/
- https://easystreams.realbestia.com/
- https://streamvix.hayd.uk/

EasyStreams includes a torrent provider by default, and some of its HTTP providers
require an external EasyProxy. StreamVix also requires an EasyProxy or MediaFlow
endpoint for some provider modes. Our HTTP/HLS relay is not a drop-in replacement
for those services' extraction APIs.
