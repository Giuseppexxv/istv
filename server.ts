import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for JSON
  app.use(express.json());

  // Global High-Priority & Performance Headers for all API routes (RFC 9218 HTTP Priority standard)
  app.use("/api/*", (_req, res, next) => {
    res.setHeader("Priority", "u=0, i"); // Urgent priority, incremental
    res.setHeader("X-API-Priority", "ultra-high");
    res.setHeader("Connection", "keep-alive");
    next();
  });

  // CORS Preflight for all API routes
  app.options("/api/*", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type, Authorization, X-Requested-With, Origin, Accept");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges, Content-Type");
    res.status(204).end();
  });

  // API: Health Check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "Liquid Stremio Core" });
  });

  // Helper to parse custom headers from query
  function extractCustomHeaders(req: express.Request): Record<string, string> {
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "*/*",
      "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
    };

    // Extract headers parameter if present
    if (req.query.headers && typeof req.query.headers === "string") {
      try {
        let parsed: any = null;
        if (req.query.headers.startsWith("{")) {
          parsed = JSON.parse(req.query.headers);
        } else {
          // base64 check
          const decoded = Buffer.from(req.query.headers, "base64").toString("utf-8");
          if (decoded.startsWith("{")) parsed = JSON.parse(decoded);
        }
        if (parsed) {
          const reqObj = parsed.request || parsed;
          for (const [k, v] of Object.entries(reqObj)) {
            if (typeof v === "string") headers[k] = v;
          }
        }
      } catch (e) {
        // ignore parse error
      }
    }

    if (req.query.referer && typeof req.query.referer === "string") {
      headers["Referer"] = req.query.referer;
    }
    if (req.query.origin && typeof req.query.origin === "string") {
      headers["Origin"] = req.query.origin;
    }

    return headers;
  }

  // Generates a stable, pseudo-random public IPv4 address per video stream/addon URL path
  // to bypass provider/addon IP rate limits and prevent "support project" block screens.
  // It ensures the IP is perfectly stable while watching the same stream (for all its segment requests),
  // but resets and shifts to a completely different IP when a different movie, episode, or stream is opened.
  function getSpoofedIpForUrl(targetUrl: string): string {
    if (!targetUrl) return "1.1.1.1";

    let cleanUrl = targetUrl;
    try {
      const parsed = new URL(targetUrl);
      let pathname = parsed.pathname;
      // Strip segment-specific file names so all chunks/segments of the same parent playlist hash to the same IP
      if (pathname.match(/\.(ts|aac|m4s|mp4|mp3|png|jpg|jpeg|gif)$/i)) {
        const parts = pathname.split("/");
        parts.pop();
        pathname = parts.join("/");
      }
      cleanUrl = parsed.host + pathname;
    } catch {
      // fallback
    }

    // String hashing
    let hash = 0;
    for (let i = 0; i < cleanUrl.length; i++) {
      hash = (hash << 5) - hash + cleanUrl.charCodeAt(i);
      hash |= 0;
    }
    hash = Math.abs(hash);

    // Generate valid public IPv4 octets (avoiding private subnets like 10.x, 192.168.x, etc.)
    const octet1 = 71 + (hash % 109); // 71 to 179
    const octet2 = (hash >> 8) & 255;
    const octet3 = (hash >> 16) & 255;
    const octet4 = 1 + (hash % 254); // 1 to 254

    return `${octet1}.${octet2}.${octet3}.${octet4}`;
  }

  // API: Universal Video Stream & HLS Proxy
  // Supports Range requests (seeking), header spoofing (Referer/Origin/User-Agent),
  // and rewrites HLS .m3u8 playlists so all chunks are automatically proxied
  app.all("/api/stream-proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).json({ error: "Missing 'url' query parameter" });
    }

    try {
      const parsed = new URL(targetUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return res.status(400).json({ error: "Invalid protocol" });
      }

      const headers = extractCustomHeaders(req);

      // Auto-spoof client IP to bypass addon and provider IP rate limiting
      const spoofedIp = getSpoofedIpForUrl(targetUrl);
      headers["X-Forwarded-For"] = spoofedIp;
      headers["X-Real-IP"] = spoofedIp;
      headers["Client-IP"] = spoofedIp;
      headers["CF-Connecting-IP"] = spoofedIp;
      headers["True-Client-IP"] = spoofedIp;
      headers["X-Client-IP"] = spoofedIp;
      headers["X-Cluster-Client-IP"] = spoofedIp;

      // Forward Range request for progressive video loading / seeking
      if (req.headers.range) {
        headers["Range"] = req.headers.range;
      }

      const controller = new AbortController();
      req.on("close", () => {
        controller.abort();
      });

      const response = await fetch(targetUrl, {
        method: req.method === "HEAD" ? "HEAD" : "GET",
        headers,
        signal: controller.signal,
      });

      // Set permissive CORS headers for HTML5 video & Hls.js
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type, Authorization, X-Requested-With, Origin, Accept");
      res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges, Content-Type");
      res.setHeader("Accept-Ranges", "bytes");

      const contentType = response.headers.get("content-type") || "";
      const isM3u8 =
        targetUrl.includes(".m3u8") ||
        contentType.includes("mpegurl") ||
        contentType.includes("application/x-mpegURL");

      if (req.method === "HEAD") {
        res.status(response.status);
        if (contentType) res.setHeader("Content-Type", contentType);
        const cl = response.headers.get("content-length");
        if (cl) res.setHeader("Content-Length", cl);
        return res.end();
      }

      // If it's an HLS playlist, rewrite segment and sub-playlist URLs to point through stream-proxy
      if (isM3u8) {
        const text = await response.text();
        const trimmed = text.trim();
        if (trimmed.includes("#EXTM3U") || trimmed.includes("#EXTINF") || trimmed.includes("#EXT-X-")) {
          res.setHeader("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache");

          // Keep headers param string for nested requests
          const headersParam = req.query.headers ? `&headers=${encodeURIComponent(req.query.headers as string)}` : "";
          const refererParam = headers["Referer"] ? `&referer=${encodeURIComponent(headers["Referer"])}` : "";

          const rewritten = text
            .split("\n")
            .map((line) => {
              const lineTrimmed = line.trim();
              if (!lineTrimmed) return line;

              // Handle URI attributes in tags like #EXT-X-MEDIA, #EXT-X-KEY, #EXT-X-MAP
              if (lineTrimmed.startsWith("#") && lineTrimmed.includes('URI="')) {
                return lineTrimmed.replace(/URI="([^"]+)"/g, (_match, uri) => {
                  try {
                    const resolved = new URL(uri, targetUrl).href;
                    return `URI="/api/stream-proxy?url=${encodeURIComponent(resolved)}${headersParam}${refererParam}"`;
                  } catch {
                    return `URI="${uri}"`;
                  }
                });
              }

              // Handle playlist / segment URI lines (don't start with #)
              if (!lineTrimmed.startsWith("#")) {
                try {
                  const resolved = new URL(lineTrimmed, targetUrl).href;
                  return `/api/stream-proxy?url=${encodeURIComponent(resolved)}${headersParam}${refererParam}`;
                } catch {
                  return line;
                }
              }

              return line;
            })
            .join("\n");

          return res.status(response.status).send(rewritten);
        }

        // If it was tagged as m3u8 but the upstream returned non-playlist body (e.g. error text or redirect)
        // return the text payload directly without reading the already-consumed response.body stream
        res.setHeader("Content-Type", contentType || "text/plain");
        return res.status(response.status).send(text);
      }

      // For binary media (TS segments, MP4, WebM, audio chunks), stream directly
      res.status(response.status);
      if (
        targetUrl.includes("/video/") ||
        targetUrl.includes("/audio/") ||
        targetUrl.includes(".ts") ||
        targetUrl.includes("tiktokcdn") ||
        targetUrl.includes(".image")
      ) {
        res.setHeader("Content-Type", "video/mp2t");
      } else if (contentType) {
        res.setHeader("Content-Type", contentType);
      } else {
        res.setHeader("Content-Type", "video/mp4");
      }

      const cl = response.headers.get("content-length");
      if (cl) res.setHeader("Content-Length", cl);

      const cr = response.headers.get("content-range");
      if (cr) res.setHeader("Content-Range", cr);

      if (response.body && !response.bodyUsed) {
        const { Readable } = await import("node:stream");
        const nodeStream = Readable.fromWeb(response.body as any);
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        return;
      }
      console.warn(`[Stream Proxy Error] for ${targetUrl}:`, err.message);
      if (!res.headersSent) {
        res.status(502).json({
          error: "Stream proxy failed",
          message: err.message,
          url: targetUrl,
        });
      }
    }
  });

  // Channel logo proxy for JPEG/PNG logos to avoid CORS and mixed-content issues
  app.get("/api/channel-logo", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    const target = req.query.url;
    if (!target || typeof target !== "string") {
      return res.status(400).send("Missing url parameter");
    }
    try {
      const fetchUrl = target.startsWith("http") ? target : `http://logo.huhu.to/logo?c=${target}`;
      const logoResp = await fetch(fetchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(6000),
      });
      if (!logoResp.ok) {
        return res.status(logoResp.status).send("Not found");
      }
      const ct = logoResp.headers.get("content-type") || "image/png";
      res.setHeader("Content-Type", ct);
      res.setHeader("Cache-Control", "public, max-age=86400, immutable");
      const buffer = await logoResp.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (err: any) {
      res.status(502).send("Logo fetch failed");
    }
  });

  // ==========================================
  // VAVOO.TO LIVE TV ENGINE (https://vavoo.to/#/channels)
  // Direct HLS live streaming with zero ads & zero popups
  // ==========================================
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const VAVOO_BASE_SITES = ["https://vavoo.to", "https://kool.to"];
  const VAVOO_PING_URLS = [
    "https://www.vavoo.tv/api/app/ping",
    "https://www.vavoo.to/api/app/ping",
  ];

  let vavooSignature: string | null = null;
  let vavooSignatureExpires = 0;
  let vavooChannelsCache: any[] | null = null;
  let vavooChannelsCacheExpires = 0;
  const vavooStreamCache = new Map<string, { streamUrl: string; rawM3u8: string; expires: number }>();

  function getVavooPingPayload() {
    const currentTimestamp = Date.now();
    return {
      token: "",
      reason: "app-blur",
      locale: "it",
      theme: "dark",
      metadata: {
        device: {
          type: "Handset",
          brand: "google",
          model: "Nexus",
          name: "21081111RG",
          uniqueId: `d10e5d99ab665233-${currentTimestamp}`,
        },
        os: {
          name: "android",
          version: "7.1.2",
          abis: ["arm64-v8a", "armeabi-v7a", "armeabi"],
          host: "android",
        },
        app: {
          platform: "android",
          version: "3.1.20",
          buildId: "289515000",
          engine: "hbc85",
          signatures: ["6e8a975e3cbf07d5de823a760d4c2547f86c1403105020adee5de67ac510999e"],
          installer: "app.revanced.manager.flutter",
        },
        version: {
          package: "tv.vavoo.app",
          binary: "3.1.20",
          js: "3.1.20",
        },
      },
      appFocusTime: 0,
      playerActive: false,
      playDuration: 0,
      devMode: false,
      hasAddon: true,
      castConnected: false,
      package: "tv.vavoo.app",
      version: "3.1.20",
      process: "app",
      firstAppStart: currentTimestamp,
      lastAppStart: currentTimestamp,
      ipLocation: "",
      adblockEnabled: true,
      proxy: {
        supported: ["ss", "openvpn"],
        engine: "ss",
        ssVersion: 1,
        enabled: true,
        autoServer: true,
        id: "pl-waw",
      },
      iap: {
        supported: false,
      },
    };
  }

  async function getVavooSignature(): Promise<string> {
    const now = Date.now();
    if (vavooSignature && vavooSignatureExpires > now) {
      return vavooSignature;
    }

    const payload = getVavooPingPayload();
    for (const url of VAVOO_PING_URLS) {
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "user-agent": "okhttp/4.11.0",
            accept: "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data?.addonSig) {
            vavooSignature = String(data.addonSig);
            vavooSignatureExpires = now + 9 * 60 * 1000;
            return vavooSignature;
          }
        }
      } catch (err: any) {
        console.warn(`[Vavoo Ping Warning] for ${url}:`, err.message);
      }
    }

    if (vavooSignature) return vavooSignature;
    throw new Error("Unable to obtain Vavoo addon signature");
  }

  function getChannelNetwork(rawName: string): { network: string; networkLabel: string } | null {
    const lower = rawName.toLowerCase();

    // 1. DAZN
    if (lower.includes("dazn")) {
      return { network: "dazn", networkLabel: "DAZN" };
    }

    // 2. SPORTITALIA
    if (lower.includes("sportitalia")) {
      return { network: "sportitalia", networkLabel: "Sportitalia" };
    }

    // 3. SKY (including Sky, Primafila, Skyshowtime, and TV8)
    if (lower.includes("sky") || lower.includes("primafila") || lower.includes("skyshowtime") || /\btv\s*8\b/i.test(rawName)) {
      return { network: "sky", networkLabel: "Sky" };
    }

    // 4. RAI (strictly Rai 1, 2, 3, Sport; exclude Rai 4, Rai 4K, Rai 5, Rai News, Rai Movie, Rai Premium, etc.)
    if (/\brai\b/i.test(rawName)) {
      const hasValidNumber = /\b(1|2|3|sport)\b/i.test(rawName);
      if (!hasValidNumber) {
        return null;
      }
      if (
        lower.includes("4") ||
        lower.includes("4k") ||
        lower.includes("5") ||
        lower.includes("movie") ||
        lower.includes("premium") ||
        lower.includes("news") ||
        lower.includes("storia") ||
        lower.includes("scuola") ||
        lower.includes("gulp") ||
        lower.includes("yoyo") ||
        lower.includes("yo yo") ||
        lower.includes("italia")
      ) {
        return null;
      }
      return { network: "rai", networkLabel: "Rai" };
    }

    // 8. MEDIASET (strictly Canale 5, Italia 1, Rete 4; exclude 20, 27, iris, cine34, focus, top crime, extra, mediaset italia, etc.)
    if (
      lower.includes("canale 5") ||
      lower.includes("canale5") ||
      lower.includes("italia 1") ||
      lower.includes("italia1") ||
      lower.includes("rete 4") ||
      lower.includes("rete4")
    ) {
      if (
        lower.includes("20") ||
        lower.includes("27") ||
        lower.includes("twenty") ||
        lower.includes("iris") ||
        lower.includes("cine34") ||
        lower.includes("cine 34") ||
        lower.includes("focus") ||
        lower.includes("top crime") ||
        lower.includes("topcrime") ||
        lower.includes("extra") ||
        lower.includes("italia 2") ||
        lower.includes("italia2")
      ) {
        return null;
      }
      return { network: "mediaset", networkLabel: "Mediaset" };
    }

    return null;
  }

  function getChannelUniqueKey(rawName: string): string {
    let key = rawName.toLowerCase();
    key = key.replace(/\s*\.[a-z0-9]+$/i, "");
    key = key.replace(/\s*\[.*?\]/g, "");
    key = key.replace(/\s*\(backup\)/i, "");
    key = key.replace(/\s*backup/i, "");
    key = key.replace(/\s*fhd\b/i, "");
    key = key.replace(/\s*hd\b/i, "");
    key = key.replace(/\s*sd\b/i, "");
    key = key.replace(/\b20\s*mediaset\b/i, "mediaset20");
    key = key.replace(/\bmediaset\s*20\b/i, "mediaset20");
    key = key.replace(/\bmediaset\s*iris\b/i, "iris");
    key = key.replace(/\bcine\s*34\s*mediaset\b/i, "cine34");
    key = key.replace(/\bcine\s*34\b/i, "cine34");
    key = key.replace(/\b27\s*twenty\s*seven\b/i, "twentyseven");
    key = key.replace(/\b27\s*twentyseven\b/i, "twentyseven");
    key = key.replace(/\bdiscovery\s*focus\b/i, "focus");
    key = key.replace(/\bsky\s*sports\b/i, "skysport");
    key = key.replace(/\brai\s*sport\+\b/i, "raisport");
    key = key.replace(/[^a-z0-9]/g, "");
    return key;
  }

  function cleanVavooChannelName(raw: string): string {
    let name = String(raw || "").trim();
    name = name.replace(/\s*\.[a-zA-Z0-9]+$/i, "");
    name = name.replace(/\s*\[.*?\]/g, "");
    name = name.replace(/\s*\(backup\)/i, "");
    name = name.replace(/\s*backup/i, "");
    name = name.replace(/\bTV\s*8\b/i, "TV8");
    name = name.replace(/\b27\s*TWENTY\s*SEVEN\b/i, "27 TwentySeven");
    name = name.replace(/\b27\s*TWENTYSEVEN\b/i, "27 TwentySeven");
    name = name.replace(/\bCINE\s*34\s*MEDIASET\b/i, "Cine34");
    name = name.replace(/\bCINE\s*34\b/i, "Cine34");
    name = name.replace(/\bMEDIASET\s*IRIS\b/i, "Iris");
    name = name.replace(/\bMEDIASET\s*20\b/i, "20 Mediaset");
    name = name.replace(/\bDISCOVERY\s*FOCUS\b/i, "Focus");
    name = name.replace(/\bSKY\s*SPORTS\b/i, "Sky Sport");
    name = name.replace(/\bRAI\s*SPORT\+\b/i, "Rai Sport");
    name = name.replace(/\bSKY\s*TG\s*24\b/i, "Sky TG24");
    name = name.replace(/\bRAI\s*NEWS\s*24\b/i, "Rai News 24");
    name = name.replace(/\bSPORTITALIA\s*PLUS\b/i, "Sportitalia Plus");
    name = name.replace(/\bSPORTITALIA\s*SOLOCALCIO\b/i, "Sportitalia SoloCalcio");
    name = name.replace(/\bSKY\s*SPORT\s*MOTO\s*GP\b/i, "Sky Sport MotoGP");
    name = name.replace(/\bSKY\s*SPORT\s*MOTOGP\b/i, "Sky Sport MotoGP");
    name = name.replace(/\bPRIMA\s*FILA\b/i, "Primafila");
    name = name.replace(/\bPRIMAFILA\b/i, "Primafila");
    name = name.replace(/\bSKY\s*SHOWTIME\b/i, "Skyshowtime");
    name = name.replace(/\bSKYSHOWTIME\b/i, "Skyshowtime");
    name = name.trim();

    const words = name.split(/\s+/).map((w) => {
      const up = w.toUpperCase();
      if (
        [
          "RAI", "SKY", "DAZN", "HD", "F1", "4K", "FHD", "TV", "TV8", "TG24",
          "TGCOM24", "LA5", "CANALE", "MEDIASET", "NBA", "SPORTITALIA", "PLUS",
          "EXTRA", "SOLOCALCIO", "CINE34", "IRIS", "PRIMAFILA", "SKYSHOWTIME"
        ].includes(up)
      ) {
        if (up === "CANALE") return "Canale";
        if (up === "MEDIASET") return "Mediaset";
        if (up === "SPORTITALIA") return "Sportitalia";
        if (up === "PLUS") return "Plus";
        if (up === "EXTRA") return "Extra";
        if (up === "SOLOCALCIO") return "SoloCalcio";
        if (up === "CINE34") return "Cine34";
        if (up === "IRIS") return "Iris";
        if (up === "RAI") return "Rai";
        if (up === "SKY") return "Sky";
        if (up === "PRIMAFILA") return "Primafila";
        if (up === "SKYSHOWTIME") return "Skyshowtime";
        return up;
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    });
    return words.join(" ");
  }

  function getVavooCategory(rawName: string, network = ""): { category: "sport" | "cinema" | "general"; categoryLabel: "Sport" | "Cinema" | "Intrattenimento" } {
    const lower = rawName.toLowerCase();

    if (
      network === "dazn" ||
      network === "sportitalia" ||
      lower.includes("sport") ||
      lower.includes("calcio") ||
      lower.includes("motogp") ||
      lower.includes("f1") ||
      lower.includes("tennis") ||
      lower.includes("golf") ||
      lower.includes("arena") ||
      lower.includes("nba")
    ) {
      return { category: "sport", categoryLabel: "Sport" };
    }

    if (
      lower.includes("cinema") ||
      lower.includes("movie") ||
      lower.includes("film")
    ) {
      return { category: "cinema", categoryLabel: "Cinema" };
    }

    return { category: "general", categoryLabel: "Intrattenimento" };
  }

  const VAVOO_CURATED_ITALIAN = [
    // RAI
    { id: '875922788627becc98639', name: 'Rai 1', rawTitle: 'RAI 1 .c', network: 'rai', networkLabel: 'Rai', category: 'general', categoryLabel: 'Intrattenimento', vavooUrl: 'https://vavoo.to/vavoo-iptv/play/875922788627becc98639', logo: 'https://logo.huhu.to/logo?c=875922788.png' },
    { id: '1939210164cf0608420d67', name: 'Rai 2', rawTitle: 'RAI 2 .c', network: 'rai', networkLabel: 'Rai', category: 'general', categoryLabel: 'Intrattenimento', vavooUrl: 'https://vavoo.to/vavoo-iptv/play/1939210164cf0608420d67', logo: 'https://logo.huhu.to/logo?c=193921016.png' },
    { id: '1301018318251e6006e89', name: 'Rai 3', rawTitle: 'RAI 3 .s', network: 'rai', networkLabel: 'Rai', category: 'general', categoryLabel: 'Intrattenimento', vavooUrl: 'https://vavoo.to/vavoo-iptv/play/1301018318251e6006e89', logo: 'https://logo.huhu.to/logo?c=130101831.png' },
    { id: '29241350927e983d18bd31', name: 'Rai Sport', rawTitle: 'RAI SPORT .c', network: 'rai', networkLabel: 'Rai', category: 'sport', categoryLabel: 'Sport', vavooUrl: 'https://vavoo.to/vavoo-iptv/play/29241350927e983d18bd31', logo: 'https://logo.huhu.to/logo?c=292413509.png' },
    // MEDIASET
    { id: '15341618078b08a3db572d', name: 'Canale 5', rawTitle: 'CANALE 5 .c', network: 'mediaset', networkLabel: 'Mediaset', category: 'general', categoryLabel: 'Intrattenimento', vavooUrl: 'https://vavoo.to/vavoo-iptv/play/15341618078b08a3db572d', logo: 'https://logo.huhu.to/logo?c=153416180.png' },
    { id: '663536394520458805ef6', name: 'Italia 1', rawTitle: 'ITALIA 1 .c', network: 'mediaset', networkLabel: 'Mediaset', category: 'general', categoryLabel: 'Intrattenimento', vavooUrl: 'https://vavoo.to/vavoo-iptv/play/663536394520458805ef6', logo: 'https://logo.huhu.to/logo?c=663536394.png' },
    { id: '4198218214cee07ebbc292', name: 'Rete 4', rawTitle: 'RETE 4 .c', network: 'mediaset', networkLabel: 'Mediaset', category: 'general', categoryLabel: 'Intrattenimento', vavooUrl: 'https://vavoo.to/vavoo-iptv/play/4198218214cee07ebbc292', logo: 'https://logo.huhu.to/logo?c=4198218214.png' },
    // TV8 (Sky Free-to-Air)
    { id: '40383657201f43ce81681d', name: 'TV8', rawTitle: 'TV 8 .c', network: 'sky', networkLabel: 'Sky', category: 'general', categoryLabel: 'Intrattenimento', vavooUrl: 'https://vavoo.to/vavoo-iptv/play/40383657201f43ce81681d', logo: 'https://logo.huhu.to/logo?c=4038365720.png' },
    // DAZN
    { id: '1376440573d46b3d682e20', name: 'DAZN 1', rawTitle: 'DAZN 1 .c', network: 'dazn', networkLabel: 'DAZN', category: 'sport', categoryLabel: 'Sport', vavooUrl: 'https://vavoo.to/vavoo-iptv/play/1376440573d46b3d682e20', logo: 'https://logo.huhu.to/logo?c=1376440573.png' },
    // SPORTITALIA
    { id: '33428493134b007f2ed197', name: 'Sportitalia Plus', rawTitle: 'SPORTITALIA PLUS .c', network: 'sportitalia', networkLabel: 'Sportitalia', category: 'sport', categoryLabel: 'Sport', vavooUrl: 'https://vavoo.to/vavoo-iptv/play/33428493134b007f2ed197', logo: 'https://logo.huhu.to/logo?c=3342849313.png' },
    { id: '21984103395cacdfaf1d34', name: 'Sportitalia SoloCalcio', rawTitle: 'SPORTITALIA SOLOCALCIO .c', network: 'sportitalia', networkLabel: 'Sportitalia', category: 'sport', categoryLabel: 'Sport', vavooUrl: 'https://vavoo.to/vavoo-iptv/play/21984103395cacdfaf1d34', logo: '' },
    // SKY
    { id: '210669162201ec2365574', name: 'Sky Sport Uno', rawTitle: 'SKY SPORT UNO .c', network: 'sky', networkLabel: 'Sky', category: 'sport', categoryLabel: 'Sport', vavooUrl: 'https://vavoo.to/vavoo-iptv/play/210669162201ec2365574', logo: 'https://logo.huhu.to/logo?c=210669162.png' },
    { id: '1630132338cf4ad0231cfb', name: 'Sky Sport Calcio', rawTitle: 'SKY SPORT CALCIO .c', network: 'sky', networkLabel: 'Sky', category: 'sport', categoryLabel: 'Sport', vavooUrl: 'https://vavoo.to/vavoo-iptv/play/1630132338cf4ad0231cfb', logo: 'https://logo.huhu.to/logo?c=163013233.png' },
    { id: '16147653823e5904d9b6d', name: 'Sky Sport F1', rawTitle: 'SKY SPORT F1 .c', network: 'sky', networkLabel: 'Sky', category: 'sport', categoryLabel: 'Sport', vavooUrl: 'https://vavoo.to/vavoo-iptv/play/16147653823e5904d9b6d', logo: 'https://logo.huhu.to/logo?c=161476538.png' },
    { id: '3028266299b8217bbba9d', name: 'Sky Sport MotoGP', rawTitle: 'SKY SPORT MOTOGP .c', network: 'sky', networkLabel: 'Sky', category: 'sport', categoryLabel: 'Sport', vavooUrl: 'https://vavoo.to/vavoo-iptv/play/3028266299b8217bbba9d', logo: 'https://logo.huhu.to/logo?c=302826629.png' },
    { id: '28721519114f66aff68e22', name: 'Sky Cinema Uno', rawTitle: 'SKY CINEMA UNO .c', network: 'sky', networkLabel: 'Sky', category: 'cinema', categoryLabel: 'Cinema', vavooUrl: 'https://vavoo.to/vavoo-iptv/play/28721519114f66aff68e22', logo: 'https://logo.huhu.to/logo?c=287215191.png' },
  ].map((c) => ({
    ...c,
    group: 'Italy',
    streamUrl: `/api/live-stream?id=${c.id}`,
    playerUrl: `/api/live-stream?id=${c.id}`,
    watchUrl: 'https://vavoo.to/#/channels',
  }));

  const VAVOO_NETWORKS = [
    { id: 'all', name: 'Tutti' },
    { id: 'sky', name: 'Sky' },
    { id: 'dazn', name: 'DAZN' },
    { id: 'rai', name: 'Rai' },
    { id: 'mediaset', name: 'Mediaset' },
    { id: 'sportitalia', name: 'Sportitalia' },
  ];

  const NETWORK_ORDER: Record<string, number> = {
    sky: 1,
    dazn: 2,
    rai: 3,
    mediaset: 4,
    sportitalia: 5,
  };

  function sortChannelsByNetworkOrder(list: any[]): any[] {
    const collator = new Intl.Collator("it", { numeric: true, sensitivity: "base" });
    return [...list].sort((a, b) => {
      const orderA = NETWORK_ORDER[String(a.network || "").toLowerCase()] || 99;
      const orderB = NETWORK_ORDER[String(b.network || "").toLowerCase()] || 99;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return collator.compare(String(a.name || ""), String(b.name || ""));
    });
  }

  const vavooGroupCache = new Map<string, { channels: any[]; expires: number }>();

  async function fetchVavooChannels(targetGroup = 'Italy'): Promise<any[]> {
    const now = Date.now();
    const groupKey = targetGroup.toLowerCase();
    const cached = vavooGroupCache.get(groupKey);
    if (cached && cached.expires > now) {
      return cached.channels;
    }

    try {
      const sig = await getVavooSignature();
      const deduplicatedMap = new Map<string, any>();
      let cursor: string | null = null;

      for (const baseSite of VAVOO_BASE_SITES) {
        try {
          while (true) {
            const resp: Response = await fetch(`${baseSite}/mediahubmx-catalog.json`, {
              method: "POST",
              headers: {
                "content-type": "application/json; charset=utf-8",
                "mediahubmx-signature": sig,
                "user-agent": "MediaHubMX/2",
                accept: "*/*",
                "Accept-Language": "it",
              },
              body: JSON.stringify({
                language: "it",
                region: "IT",
                catalogId: "iptv",
                id: "iptv",
                adult: false,
                search: "",
                sort: "name",
                filter: { group: targetGroup },
                cursor,
                clientVersion: "3.0.2",
              }),
              signal: AbortSignal.timeout(9000),
            });

            if (!resp.ok) break;

            const data: any = await resp.json();
            const items = Array.isArray(data?.items) ? data.items : [];

            for (const item of items) {
              if (item?.type !== "iptv" || !item?.url) continue;

              // Strictly filter to user-requested networks:
              // DAZN, Sky, Cartoon Network, Disney, Sportitalia, Rai, Mediaset, TV8
              const networkInfo = getChannelNetwork(item.name);
              if (!networkInfo) continue;

              const uniqueKey = getChannelUniqueKey(item.name);
              const isDotC = item.name.toLowerCase().endsWith(".c");
              const hasLogo = Boolean(item.logo);
              const channelId = String(item.ids?.id || item.url.split("/").pop() || item.name);

              if (deduplicatedMap.has(uniqueKey)) {
                const existing = deduplicatedMap.get(uniqueKey);
                const existingIsDotC = String(existing.rawTitle || "").toLowerCase().endsWith(".c");
                // Prefer .c stream, or prefer stream with logo
                if (!existingIsDotC && isDotC) {
                  const { category, categoryLabel } = getVavooCategory(item.name, networkInfo.network);
                  const displayName = cleanVavooChannelName(item.name);
                  deduplicatedMap.set(uniqueKey, {
                    id: channelId,
                    name: displayName,
                    rawTitle: item.name,
                    network: networkInfo.network,
                    networkLabel: networkInfo.networkLabel,
                    logo: item.logo || existing.logo || "",
                    group: "Italy",
                    vavooUrl: item.url,
                    category,
                    categoryLabel,
                    streamUrl: `/api/live-stream?id=${channelId}`,
                    playerUrl: `/api/live-stream?id=${channelId}`,
                    watchUrl: "https://vavoo.to/#/channels",
                  });
                } else if (!existing.logo && hasLogo) {
                  existing.logo = item.logo;
                }
              } else {
                const { category, categoryLabel } = getVavooCategory(item.name, networkInfo.network);
                const displayName = cleanVavooChannelName(item.name);
                deduplicatedMap.set(uniqueKey, {
                  id: channelId,
                  name: displayName,
                  rawTitle: item.name,
                  network: networkInfo.network,
                  networkLabel: networkInfo.networkLabel,
                  logo: item.logo || "",
                  group: "Italy",
                  vavooUrl: item.url,
                  category,
                  categoryLabel,
                  streamUrl: `/api/live-stream?id=${channelId}`,
                  playerUrl: `/api/live-stream?id=${channelId}`,
                  watchUrl: "https://vavoo.to/#/channels",
                });
              }
            }

            if (!data?.nextCursor || deduplicatedMap.size > 500) {
              break;
            }
            cursor = data.nextCursor;
          }

          if (deduplicatedMap.size > 0) {
            const allChannels = sortChannelsByNetworkOrder(Array.from(deduplicatedMap.values()));
            vavooGroupCache.set(groupKey, {
              channels: allChannels,
              expires: now + 30 * 60 * 1000,
            });
            return allChannels;
          }
        } catch (baseErr: any) {
          console.warn(`[Vavoo Catalog Error for ${targetGroup}] from ${baseSite}:`, baseErr.message);
        }
      }

      if (deduplicatedMap.size > 0) {
        const allChannels = sortChannelsByNetworkOrder(Array.from(deduplicatedMap.values()));
        vavooGroupCache.set(groupKey, {
          channels: allChannels,
          expires: now + 30 * 60 * 1000,
        });
        return allChannels;
      }
    } catch (err: any) {
      console.warn(`[Vavoo Channels Fetch Error for ${targetGroup}]:`, err.message);
    }

    const sortedCurated = sortChannelsByNetworkOrder([...VAVOO_CURATED_ITALIAN]);
    return sortedCurated;
  }

  // Resolves direct HLS stream URL for a given Vavoo channel
  async function resolveVavooStream(channelIdOrUrl: string, forceFresh = false): Promise<string> {
    const cached = vavooStreamCache.get(channelIdOrUrl);
    const now = Date.now();
    if (!forceFresh && cached && cached.expires > now) {
      return cached.rawM3u8;
    }

    // Determine target Vavoo URL
    let targetVavooUrl = channelIdOrUrl;
    if (!targetVavooUrl.startsWith("http")) {
      targetVavooUrl = `https://vavoo.to/vavoo-iptv/play/${channelIdOrUrl}`;
    }

    const sig = await getVavooSignature();

    for (const baseSite of VAVOO_BASE_SITES) {
      try {
        const resp = await fetch(`${baseSite}/mediahubmx-resolve.json`, {
          method: "POST",
          headers: {
            "content-type": "application/json; charset=utf-8",
            "mediahubmx-signature": sig,
            "user-agent": "MediaHubMX/2",
            accept: "*/*",
            "Accept-Language": "it",
          },
          body: JSON.stringify({
            language: "it",
            region: "IT",
            url: targetVavooUrl,
            clientVersion: "3.0.2",
          }),
          signal: AbortSignal.timeout(9000),
        });

        if (!resp.ok) continue;

        const body = await resp.json();
        const upstreamUrl =
          (Array.isArray(body) && body[0]?.url) ||
          body?.url ||
          body?.streamUrl;

        if (upstreamUrl && typeof upstreamUrl === "string") {
          vavooStreamCache.set(channelIdOrUrl, {
            streamUrl: upstreamUrl,
            rawM3u8: upstreamUrl,
            expires: now + 4 * 60 * 1000,
          });
          return upstreamUrl;
        }
      } catch (err: any) {
        console.warn(`[Vavoo Resolve Error] from ${baseSite}:`, err.message);
      }
    }

    throw new Error(`Impossibile risolvere il flusso Vavoo per ${channelIdOrUrl}`);
  }

  // API: Get Vavoo Live TV Channels (Strictly DAZN, Sky, Cartoon Network, Disney, Sportitalia, Rai, Mediaset, TV8)
  app.get("/api/live-channels", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Content-Type", "application/json");

    const networkFilter = (req.query.network as string || "").toLowerCase();

    try {
      let channels = await fetchVavooChannels("Italy");
      if (!channels || channels.length === 0) {
        channels = VAVOO_CURATED_ITALIAN;
      }

      if (networkFilter && networkFilter !== "all") {
        channels = channels.filter((c) => c.network === networkFilter);
      }

      return res.json({
        success: true,
        provider: "vavoo.to",
        source: "https://vavoo.to/#/channels",
        networks: VAVOO_NETWORKS,
        channels,
      });
    } catch (err: any) {
      console.warn("[API Live Channels Error]:", err.message);
      let channels = VAVOO_CURATED_ITALIAN;
      if (networkFilter && networkFilter !== "all") {
        channels = channels.filter((c) => c.network === networkFilter);
      }
      return res.json({
        success: true,
        provider: "vavoo.to",
        source: "https://vavoo.to/#/channels",
        networks: VAVOO_NETWORKS,
        channels,
        isFallback: true,
      });
    }
  });

  // API: Get Direct Clean M3U8 Stream from Vavoo.to (Ad-free, zero popups, native HLS player)
  app.get("/api/live-stream", async (req, res) => {
    const channelId = (req.query.id as string) || (req.query.url as string) || "";
    const forceFresh = req.query.refresh === "1" || req.query.fresh === "1";
    if (!channelId) {
      return res.status(400).json({ success: false, error: "Missing channel id or url" });
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Content-Type", "application/json");

    try {
      const upstreamM3u8 = await resolveVavooStream(channelId, forceFresh);
      const customHeaders = JSON.stringify({ "User-Agent": "VAVOO/2.6" });
      const proxiedUrl = `/api/stream-proxy?url=${encodeURIComponent(upstreamM3u8)}&headers=${encodeURIComponent(customHeaders)}`;

      return res.json({
        success: true,
        provider: "vavoo.to",
        channelId,
        streamUrl: proxiedUrl,
        rawM3u8: upstreamM3u8,
        cleanPlayer: true,
      });
    } catch (err: any) {
      console.warn(`[API Live Stream Error] for ${channelId}:`, err.message);
      return res.status(502).json({
        success: false,
        error: "Flusso live momentaneamente non disponibile su Vavoo.to",
        message: err.message,
      });
    }
  });

  // API: Dedicated Clean HTML5 Player Endpoint for Vavoo Streams
  app.get("/api/live-proxy", async (req, res) => {
    const channelId = (req.query.id as string) || (req.query.url as string) || "";
    if (!channelId) {
      return res.status(400).send("Missing channel id or url");
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

    try {
      const upstreamM3u8 = await resolveVavooStream(channelId);
      const customHeaders = JSON.stringify({ "User-Agent": "VAVOO/2.6" });
      const proxiedUrl = `/api/stream-proxy?url=${encodeURIComponent(upstreamM3u8)}&headers=${encodeURIComponent(customHeaders)}`;

      const playerHtml = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Vavoo Live TV</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; background:#000; }
    html, body { width:100%; height:100%; overflow:hidden; background:#000; display:flex; align-items:center; justify-content:center; }
    video { width:100%; height:100%; object-fit:contain; background:#000; outline:none; }
    #overlay-banner {
      position: absolute;
      top: 10px;
      right: 12px;
      z-index: 100;
      background: rgba(235, 43, 88, 0.9);
      color: #fff;
      font: bold 11px system-ui, -apple-system, sans-serif;
      padding: 4px 10px;
      border-radius: 20px;
      letter-spacing: 0.5px;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      backdrop-filter: blur(8px);
      transition: opacity 1s ease;
    }
  </style>
  <script src="/hls.min.js"></script>
  <script>
    if (typeof Hls === 'undefined') {
      document.write('<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"><\\/script>');
    }
  </script>
</head>
<body>
  <div id="overlay-banner">Vavoo.to Live • Zero Pubblicità</div>
  <video id="v" playsinline webkit-playsinline controls autoplay x5-video-player-type="h5" x5-video-player-fullscreen="true"></video>
  <script>
    setTimeout(() => {
      const b = document.getElementById('overlay-banner');
      if (b) b.style.opacity = '0';
    }, 4500);

    const v = document.getElementById('v');
    const src = "${proxiedUrl}";

    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        capLevelToPlayerSize: true,
        maxBufferLength: 20,
        maxMaxBufferLength: 40,
      });
      hls.loadSource(src);
      hls.attachMedia(v);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
      });
    } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = src;
      v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
    }
  </script>
</body>
</html>`;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(playerHtml);
    } catch (err: any) {
      console.warn(`[Live Proxy Error] for id ${channelId}:`, err.message);
      return res.status(502).send("Impossibile caricare il canale live in questo momento.");
    }
  });

  // API: High-Precision Trailer Finder (TMDB & Invidious Proxy)
  const trailerCache = new Map<string, { videoId: string; title: string; expires: number }>();

  app.get("/api/youtube-trailer", async (req, res) => {
    const title = (req.query.title as string) || "";
    const type = (req.query.type as string) || "movie";
    const imdbId = (req.query.imdbId as string) || "";

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Content-Type", "application/json");

    if (!title && !imdbId) {
      return res.status(400).json({ error: "Missing title or imdbId" });
    }

    const cacheKey = `trailer_${imdbId}_${title}_${type}`;
    const cached = trailerCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expires > now) {
      return res.json({ success: true, videoId: cached.videoId, title: cached.title });
    }

    try {
      let tmdbId: number | null = null;
      let mediaType = type === "series" ? "tv" : "movie";

      // Method 1: Find via IMDb ID on TMDB API
      if (imdbId && imdbId.startsWith("tt")) {
        const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=15d2fb673961e6702c2a9255b1230013&external_source=imdb_id`;
        const findResp = await fetch(findUrl, { signal: AbortSignal.timeout(3500) }).catch(() => null);
        if (findResp && findResp.ok) {
          const findData = await findResp.json();
          if (type === "movie" && findData.movie_results?.length > 0) {
            tmdbId = findData.movie_results[0].id;
            mediaType = "movie";
          } else if (type === "series" && findData.tv_results?.length > 0) {
            tmdbId = findData.tv_results[0].id;
            mediaType = "tv";
          } else if (findData.movie_results?.length > 0) {
            tmdbId = findData.movie_results[0].id;
            mediaType = "movie";
          } else if (findData.tv_results?.length > 0) {
            tmdbId = findData.tv_results[0].id;
            mediaType = "tv";
          }
        }
      }

      // Method 2: If no tmdbId found by imdbId, search TMDB by title
      if (!tmdbId && title) {
        const searchUrl = `https://api.themoviedb.org/3/search/${mediaType}?api_key=15d2fb673961e6702c2a9255b1230013&query=${encodeURIComponent(title)}&language=it-IT`;
        const searchResp = await fetch(searchUrl, { signal: AbortSignal.timeout(3500) }).catch(() => null);
        if (searchResp && searchResp.ok) {
          const searchData = await searchResp.json();
          if (searchData.results?.length > 0) {
            tmdbId = searchData.results[0].id;
          }
        }
      }

      if (tmdbId) {
        // Fetch Italian and English trailers concurrently for instant response
        const [vRespIt, vRespEn] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/videos?api_key=15d2fb673961e6702c2a9255b1230013&language=it-IT`, { signal: AbortSignal.timeout(3500) }).catch(() => null),
          fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/videos?api_key=15d2fb673961e6702c2a9255b1230013&language=en-US`, { signal: AbortSignal.timeout(3500) }).catch(() => null),
        ]);

        const vDataIt = vRespIt && vRespIt.ok ? await vRespIt.json() : null;
        let trailerItem = vDataIt?.results?.find(
          (v: any) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser")
        );

        if (!trailerItem && vRespEn && vRespEn.ok) {
          const vDataEn = await vRespEn.json();
          trailerItem = vDataEn?.results?.find(
            (v: any) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser")
          );
        }

        if (trailerItem && trailerItem.key) {
          trailerCache.set(cacheKey, {
            videoId: trailerItem.key,
            title: trailerItem.name || title,
            expires: now + 7 * 24 * 60 * 60 * 1000,
          });
          return res.json({
            success: true,
            videoId: trailerItem.key,
            title: trailerItem.name || title,
          });
        }
      }

      // Method 3: Direct YouTube search fallback (high reliability, zero external API key needed)
      if (title) {
        const searchQueries = [
          `${title} trailer ufficiale italiano`,
          `${title} trailer italiano`,
          `${title} official trailer`,
        ];

        for (const query of searchQueries) {
          try {
            const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
            const ytResp = await fetch(ytUrl, {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
              },
              signal: AbortSignal.timeout(5000),
            });

            if (ytResp.ok) {
              const html = await ytResp.text();
              const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
              if (match && match[1]) {
                const videoId = match[1];
                trailerCache.set(cacheKey, {
                  videoId,
                  title: `${title} - Trailer`,
                  expires: now + 7 * 24 * 60 * 60 * 1000,
                });
                return res.json({
                  success: true,
                  videoId,
                  title: `${title} - Trailer`,
                });
              }
            }
          } catch (scrapeErr: any) {
            console.warn(`[YouTube Search Scrape Fail for query "${query}"]:`, scrapeErr.message);
          }
        }
      }

      return res.json({ success: false, error: "Trailer non disponibile" });
    } catch (e: any) {
      console.warn('[Trailer API Error]', e.message);
      return res.json({ success: false, error: e.message || "Trailer non disponibile" });
    }
  });

  // Dedicated hidden official Cinemeta catalog route with high-performance bounded in-memory cache
  const INTERNAL_CATALOG_BASE = "https://v3-cinemeta.strem.io";
  const catalogMemoryCache = new Map<string, { body: string; contentType: string; expires: number }>();

  // Helper to ensure in-memory caches never leak RAM (LRU bounded cap)
  function cacheSetBounded<K, V>(map: Map<K, V>, key: K, val: V, maxEntries = 250) {
    if (map.size >= maxEntries) {
      const firstKey = map.keys().next().value;
      if (firstKey !== undefined) map.delete(firstKey);
    }
    map.set(key, val);
  }

  // Periodic background sweep to free expired cache memory
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of catalogMemoryCache.entries()) {
      if (v.expires < now) catalogMemoryCache.delete(k);
    }
    for (const [k, v] of topStreamingMemoryCache.entries()) {
      if (v.expires < now) topStreamingMemoryCache.delete(k);
    }
  }, 5 * 60 * 1000);

  app.use("/api/addon/catalog", async (req, res) => {
    try {
      let subPath = req.url; // e.g. /manifest.json, /catalog/..., /meta/...
      if (!subPath.startsWith("/")) subPath = `/${subPath}`;
      const cacheKey = `cat_${subPath}`;
      const cached = catalogMemoryCache.get(cacheKey);
      const now = Date.now();

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Content-Type", "application/json");

      if (req.method === "OPTIONS") {
        return res.sendStatus(200);
      }

      if (cached && cached.expires > now) {
        res.setHeader("X-Cache", "HIT");
        res.setHeader("Cache-Control", "public, max-age=1800");
        return res.send(cached.body);
      }

      const targetUrl = `${INTERNAL_CATALOG_BASE}${subPath}`;

      // Robust retry fetcher to survive transient Cinemeta network timeouts
      async function fetchWithRetry(url: string, retriesLeft = 2): Promise<Response> {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout per attempt
          const resp = await fetch(url, {
            method: "GET",
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              Accept: "application/json, text/plain, */*",
              "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
            },
            redirect: "follow",
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (resp.ok) return resp;
          if (retriesLeft > 0) {
            return await fetchWithRetry(url, retriesLeft - 1);
          }
          return resp;
        } catch (err: any) {
          if (retriesLeft > 0) {
            return await fetchWithRetry(url, retriesLeft - 1);
          }
          throw err;
        }
      }

      const response = await fetchWithRetry(targetUrl);

      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to fetch from catalog" });
      }

      if (subPath === "/manifest.json" || subPath.startsWith("/manifest.json")) {
        const text = await response.text();
        try {
          const json = JSON.parse(text);
          json.id = "official.catalog";
          json.name = "Cinemeta (Ufficiale)";
          json.description = "Catalogo ufficiale Stremio (Cinemeta) per film, serie TV e generi.";
          const modifiedText = JSON.stringify(json);
          catalogMemoryCache.set(cacheKey, {
            body: modifiedText,
            contentType: "application/json",
            expires: now + 24 * 60 * 60 * 1000,
          });
          res.setHeader("Cache-Control", "public, max-age=86400");
          return res.send(modifiedText);
        } catch {
          return res.send(text);
        }
      }

      let data = await response.text();
      // Automatically upgrade low-res posters to crystal-clear HD
      if (data.includes('images.metahub.space/poster/small/')) {
        data = data.replaceAll('images.metahub.space/poster/small/', 'images.metahub.space/poster/medium/');
      }
      if (data.includes('images.metahub.space/background/small/')) {
        data = data.replaceAll('images.metahub.space/background/small/', 'images.metahub.space/background/medium/');
      }
      if (data.includes('image.tmdb.org/t/p/')) {
        data = data
          .replaceAll('/t/p/w185/', '/t/p/w500/')
          .replaceAll('/t/p/w200/', '/t/p/w500/')
          .replaceAll('/t/p/w300/', '/t/p/w500/')
          .replaceAll('/t/p/w342/', '/t/p/w500/');
      }

      // Cache meta and catalog responses
      const ttl = subPath.includes("/meta/") ? 24 * 60 * 60 * 1000 : 30 * 60 * 1000;
      catalogMemoryCache.set(cacheKey, {
        body: data,
        contentType: "application/json",
        expires: now + ttl,
      });

      res.setHeader("Cache-Control", "public, max-age=1800");
      res.send(data);
    } catch (err: any) {
      console.warn(`[Catalog Proxy Error] for ${req.url}:`, err.message);
      res.status(502).json({ error: "Catalog fetch failed", message: err.message });
    }
  });

  // Dedicated official TOP Streaming Italia addon route with caching
  const TOP_STREAMING_BASE = "https://top-streaming.stream/1ce8a581-8ed8-49fa-9700-f10dd5e4b5bb";
  const topStreamingMemoryCache = new Map<string, { body: string; contentType: string; expires: number }>();

  app.use("/api/addon/topstreaming", async (req, res) => {
    try {
      let subPath = req.url;
      if (!subPath.startsWith("/")) subPath = `/${subPath}`;
      const cacheKey = `top_${subPath}`;
      const cached = topStreamingMemoryCache.get(cacheKey);
      const now = Date.now();

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Content-Type", "application/json");

      if (req.method === "OPTIONS") {
        return res.sendStatus(200);
      }

      if (cached && cached.expires > now) {
        res.setHeader("X-Cache", "HIT");
        res.setHeader("Cache-Control", "public, max-age=1800");
        return res.send(cached.body);
      }

      const targetUrl = `${TOP_STREAMING_BASE}${subPath}`;
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(18000),
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to fetch from top-streaming" });
      }

      let data = await response.text();
      // Automatically upgrade low-res posters to HD
      if (data.includes('image.tmdb.org/t/p/')) {
        data = data
          .replaceAll('/t/p/w185/', '/t/p/w500/')
          .replaceAll('/t/p/w200/', '/t/p/w500/')
          .replaceAll('/t/p/w300/', '/t/p/w500/')
          .replaceAll('/t/p/w342/', '/t/p/w500/');
      }
      if (data.includes('images.metahub.space/poster/small/')) {
        data = data.replaceAll('images.metahub.space/poster/small/', 'images.metahub.space/poster/medium/');
      }

      topStreamingMemoryCache.set(cacheKey, {
        body: data,
        contentType: "application/json",
        expires: now + 60 * 60 * 1000,
      });

      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(data);
    } catch (err: any) {
      console.warn(`[TopStreaming Proxy Error] for ${req.url}:`, err.message);
      res.status(502).json({ error: "TopStreaming fetch failed", message: err.message });
    }
  });

  // Dedicated FlixPatrol Popular Italy Top 10 Endpoint (https://flixpatrol.com/top10/streaming/italy/)
  const flixpatrolMemoryCache = new Map<string, { body: string; expires: number }>();

  const FLIXPATROL_CURATED_ITALY: Record<string, string[]> = {
    movie: [
      "tt9218128",  // Il Gladiatore II
      "tt6263850",  // Deadpool & Wolverine
      "tt17526714", // The Substance
      "tt22022452", // Inside Out 2
      "tt18412256", // Alien: Romulus
      "tt21966540", // C'è ancora domani
      "tt15239678", // Dune - Parte Due
      "tt11573032", // Ferrari
      "tt16426418", // Challengers
      "tt1745960",  // Top Gun: Maverick
    ],
    series: [
      "tt15435876", // The Penguin
      "tt6638726",  // L'amica geniale (My Brilliant Friend)
      "tt2788316",  // Shōgun
      "tt14452776", // The Bear
      "tt17677860", // Presumed Innocent
      "tt13207736", // Monsters: The Lyle and Erik Menendez Story
      "tt11152062", // Mare Fuori
      "tt12637874", // Fallout
      "tt1190634",  // The Boys
      "tt22776856", // Suburræterna
    ],
  };

  app.get("/api/flixpatrol-popular", async (req, res) => {
    const type = req.query.type === "series" ? "series" : "movie";
    const cacheKey = `flixpatrol_italy_${type}`;
    const now = Date.now();
    const cached = flixpatrolMemoryCache.get(cacheKey);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Content-Type", "application/json");

    if (cached && cached.expires > now) {
      res.setHeader("X-Cache", "HIT");
      return res.send(cached.body);
    }

    try {
      const imdbIds = FLIXPATROL_CURATED_ITALY[type] || [];
      const metas = await Promise.all(
        imdbIds.map(async (id) => {
          try {
            const r = await fetch(`https://v3-cinemeta.strem.io/meta/${type}/${id}.json`, {
              signal: AbortSignal.timeout(6000),
            });
            if (!r.ok) return null;
            const data = await r.json();
            if (!data || !data.meta) return null;
            const m = data.meta;
            return {
              id: m.id || id,
              type: m.type || type,
              name: m.name,
              poster: m.poster,
              background: m.background,
              logo: m.logo,
              genres: m.genres || (m.genre ? (Array.isArray(m.genre) ? m.genre : [m.genre]) : []),
              releaseInfo: m.releaseInfo || m.year,
              imdbRating: m.imdbRating,
              description: m.description,
            };
          } catch {
            return null;
          }
        })
      );

      const validMetas = metas.filter(Boolean);
      const payload = JSON.stringify({ metas: validMetas });

      flixpatrolMemoryCache.set(cacheKey, {
        body: payload,
        expires: now + 6 * 60 * 60 * 1000, // 6 hours cache for FlixPatrol
      });

      res.setHeader("Cache-Control", "public, max-age=21600");
      res.send(payload);
    } catch (e: any) {
      console.warn("[FlixPatrol Endpoint Error]", e);
      res.status(500).json({ metas: [] });
    }
  });

  // Dedicated hidden official stream addon route with in-memory caching
  const INTERNAL_STREAM_BASE = "https://toastflix.stremio-italia.eu/eyJhaW9zdHJlYW1zTW9kZSI6dHJ1ZX0";
  const streamMemoryCache = new Map<string, { body: string; expires: number }>();

  // Server-Side direct extractor for Vixsrc (StreamingCommunity) HD Italian streams
  // Bypasses the need for Stremio Desktop local proxy (127.0.0.1:11470)
  async function resolveVixsrcStream(type: string, id: string): Promise<any | null> {
    try {
      let apiPath = "";
      if (type === "series") {
        const parts = id.split(":");
        const imdbId = parts[0];
        const season = parts[1] || "1";
        const episode = parts[2] || "1";
        apiPath = `/api/tv/${imdbId}/${season}/${episode}?lang=it`;
      } else {
        const imdbId = id.split(":")[0];
        apiPath = `/api/movie/${imdbId}?lang=it`;
      }

      const headers = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
        Referer: "https://vixsrc.to/",
        Origin: "https://vixsrc.to",
      };

      const r1 = await fetch(`https://vixsrc.to${apiPath}`, {
        headers,
        signal: AbortSignal.timeout(9000),
      });
      if (!r1.ok) return null;
      const data = await r1.json();
      if (!data.src) return null;

      const r2 = await fetch(`https://vixsrc.to${data.src}`, {
        headers,
        signal: AbortSignal.timeout(9000),
      });
      if (!r2.ok) return null;
      const html = await r2.text();

      let tokenV: string | null = null;
      let expiresV: string | null = null;
      let urlV: string | null = null;

      const mp = html.match(
        /window\.masterPlaylist\s*=\s*\{[\s\S]*?params\s*:\s*\{([\s\S]*?)\}\s*,\s*url\s*:\s*['"]([^'"]+)['"]/
      );
      if (mp) {
        const params = mp[1];
        urlV = mp[2].replace(/\\/g, "");
        const tM = params.match(/['"]token['"]\s*:\s*['"]([^'"]+)['"]/);
        const eM = params.match(/['"]expires['"]\s*:\s*['"]([^'"]+)['"]/);
        if (tM) tokenV = tM[1];
        if (eM) expiresV = eM[1];
      }

      if (!tokenV) {
        const t = html.match(/'token'\s*:\s*'([^']+)'/) || html.match(/"token"\s*:\s*"([^"]+)"/);
        if (t) tokenV = t[1];
      }
      if (!expiresV) {
        const e = html.match(/'expires'\s*:\s*'([^']+)'/) || html.match(/"expires"\s*:\s*"([^"]+)"/);
        if (e) expiresV = e[1];
      }
      if (!urlV) {
        const u = html.match(/url\s*:\s*'([^']+)'/) || html.match(/url\s*:\s*"([^"]+)"/);
        if (u) urlV = u[1].replace(/\\/g, "");
      }

      const canPlayFHD = /window\.canPlayFHD\s*=\s*true/.test(html);

      if (!urlV || !tokenV || !expiresV) {
        return null;
      }

      let playlistUrl = urlV.includes("?")
        ? `${urlV}&token=${tokenV}&expires=${expiresV}${canPlayFHD ? "&h=1" : ""}`
        : `${urlV}?token=${tokenV}&expires=${expiresV}${canPlayFHD ? "&h=1" : ""}`;
      playlistUrl = playlistUrl.replace("?", ".m3u8?");

      return {
        name: "ToastFlix HD 1080p",
        title: "🎬 Streaming HD 1080p • Audio Italiano 🇮🇹",
        url: playlistUrl,
        behaviorHints: {
          notWebReady: true,
          proxyHeaders: {
            request: {
              "User-Agent": headers["User-Agent"],
              Accept: "*/*",
              "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
              Referer: "https://vixsrc.to/",
              Origin: "https://vixsrc.to",
            },
          },
        },
      };
    } catch (err: any) {
      console.warn(`[Vixsrc Resolver Error] for ${type}/${id}:`, err.message);
      return null;
    }
  }

  app.use("/api/addon/stream", async (req, res) => {
    try {
      let subPath = req.url;
      if (!subPath.startsWith("/")) subPath = `/${subPath}`;

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Content-Type", "application/json");

      if (req.method === "OPTIONS") {
        return res.sendStatus(200);
      }

      if (subPath === "/manifest.json" || subPath.startsWith("/manifest.json")) {
        return res.json({
          id: "official.stream",
          version: "3.0.0",
          name: "Flussi Video Ufficiali",
          description: "Flussi di riproduzione video in lingua italiana",
          types: ["movie", "series"],
          catalogs: [],
          resources: ["stream"],
          idPrefixes: ["tt", "kitsu", "tmdb"]
        });
      }

      const cacheKey = `str_${subPath}`;
      const cached = streamMemoryCache.get(cacheKey);
      const now = Date.now();
      if (cached && cached.expires > now) {
        res.setHeader("X-Cache", "HIT");
        return res.send(cached.body);
      }

      const streamMatch = subPath.match(/^\/stream\/([^/]+)\/([^.]+)\.json$/);
      let targetType = "";
      let targetId = "";
      if (streamMatch) {
        targetType = streamMatch[1];
        targetId = streamMatch[2];
      }

      const targetUrl = `${INTERNAL_STREAM_BASE}${subPath}`;

      // Start Vixsrc resolution immediately
      const vixsrcPromise = targetType && targetId ? resolveVixsrcStream(targetType, targetId) : Promise.resolve(null);

      // Fetch upstream ToastFlix with a fast 2500ms timeout
      const upstreamPromise = fetch(targetUrl, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
        },
        signal: AbortSignal.timeout(2500),
      }).catch(() => null);

      // Race/settle: If Vixsrc resolves quickly, or when both settle
      const [vixsrcResult, upstreamResult] = await Promise.allSettled([
        vixsrcPromise,
        upstreamPromise,
      ]);

      const streams: any[] = [];

      // 1. If direct Vixsrc stream resolved, place it as primary high-priority stream
      if (vixsrcResult.status === "fulfilled" && vixsrcResult.value) {
        streams.push(vixsrcResult.value);
      }

      // 2. Parse upstream ToastFlix streams if available
      if (upstreamResult.status === "fulfilled" && upstreamResult.value && upstreamResult.value.ok) {
        try {
          const upstreamData = await upstreamResult.value.json();
          if (Array.isArray(upstreamData.streams)) {
            for (const s of upstreamData.streams) {
              if (s.url && s.url.length > 0) {
                streams.push(s);
              } else if (s.externalUrl && !s.externalUrl.includes("/extractor/css")) {
                streams.push(s);
              }
            }
          }
        } catch {
          // ignore json parse error
        }
      }

      const responsePayload = JSON.stringify({ streams });

      if (streams.length > 0) {
        streamMemoryCache.set(cacheKey, {
          body: responsePayload,
          expires: now + 30 * 60 * 1000,
        });
      }

      res.send(responsePayload);
    } catch (err: any) {
      console.warn(`[Stream Proxy Error] for ${req.url}:`, err.message);
      res.json({ streams: [] });
    }
  });

  // API: Stremio Add-on Server-Side Proxy
  // Bypasses browser CORS restrictions, Cloudflare preflight 405s, and rate limits
  app.get("/api/stremio-proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).json({ error: "Missing 'url' query parameter" });
    }

    try {
      // Validate that it's an HTTP/HTTPS URL
      const parsed = new URL(targetUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return res.status(400).json({ error: "Invalid protocol" });
      }

      const headers: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Stremio/4.4.168",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
      };

      // Auto-spoof client IP to bypass addon and provider IP rate limiting
      const spoofedIp = getSpoofedIpForUrl(targetUrl);
      headers["X-Forwarded-For"] = spoofedIp;
      headers["X-Real-IP"] = spoofedIp;
      headers["Client-IP"] = spoofedIp;
      headers["CF-Connecting-IP"] = spoofedIp;
      headers["True-Client-IP"] = spoofedIp;
      headers["X-Client-IP"] = spoofedIp;
      headers["X-Cluster-Client-IP"] = spoofedIp;

      const response = await fetch(targetUrl, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(20000),
      });

      // Forward status and CORS headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      const contentType = response.headers.get("content-type") || "application/json";
      res.setHeader("Content-Type", contentType);

      if (!response.ok) {
        return res.status(response.status).json({
          error: `Upstream returned status ${response.status}`,
          url: targetUrl,
        });
      }

      const data = await response.text();
      res.send(data);
    } catch (err: any) {
      const isTimeout = err.name === "TimeoutError" || err.message?.includes("timeout") || err.name === "AbortError";
      if (isTimeout) {
        console.warn(`[Proxy Timeout] for ${targetUrl} (Upstream took > 25s): Returning empty streams`);
        // If an add-on times out on /stream/ queries, return empty streams array with 200 OK so client doesn't crash or trigger 502 error
        if (targetUrl.includes("/stream/")) {
          return res.status(200).json({ streams: [] });
        }
      } else {
        console.warn(`[Proxy Error] for ${targetUrl}:`, err.message);
      }

      if (!res.headersSent) {
        res.status(504).json({
          error: "Failed to fetch from addon upstream",
          message: err.message,
          url: targetUrl,
        });
      }
    }
  });

  // Vite middleware in dev mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[IStream] Full-stack server running on http://0.0.0.0:${PORT}`);

    // Background cache pre-warming to ensure first client requests respond in 1ms
    setTimeout(async () => {
      try {
        const warmEndpoints = [
          "https://top-streaming.stream/1ce8a581-8ed8-49fa-9700-f10dd5e4b5bb/catalog/movie/popular-movie-global.json",
          "https://top-streaming.stream/1ce8a581-8ed8-49fa-9700-f10dd5e4b5bb/catalog/series/popular-series-global.json",
          "https://top-streaming.stream/1ce8a581-8ed8-49fa-9700-f10dd5e4b5bb/catalog/movie/netflix-movies-italy.json",
          "https://top-streaming.stream/1ce8a581-8ed8-49fa-9700-f10dd5e4b5bb/catalog/series/netflix-series-italy.json",
          "https://v3-cinemeta.strem.io/catalog/movie/top.json",
          "https://v3-cinemeta.strem.io/catalog/series/top.json",
        ];
        await Promise.all(
          warmEndpoints.map(async (url) => {
            try {
              const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0" } });
              if (resp.ok) {
                const text = await resp.text();
                const subPath = new URL(url).pathname.replace("/1ce8a581-8ed8-49fa-9700-f10dd5e4b5bb", "");
                if (url.includes("top-streaming.stream")) {
                  topStreamingMemoryCache.set(`top_${subPath}`, { body: text, contentType: "application/json", expires: Date.now() + 60 * 60 * 1000 });
                } else {
                  catalogMemoryCache.set(`cat_${subPath}`, { body: text, contentType: "application/json", expires: Date.now() + 60 * 60 * 1000 });
                }
              }
            } catch {}
          })
        );
      } catch {}
    }, 1000);
  });
}

startServer();
