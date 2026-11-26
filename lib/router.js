const http = require("http");
const https = require("https");
const { fetchTikTok } = require("./tiktok");
const { fetchYouTube, fetchYouTubePlaylist } = require("./youtube");
const { fetchSpotify, fetchSpotifyPlaylist } = require("./spotify");
const { fetchInstagram } = require("./instagram");
const { fetchFacebook } = require("./facebook");
const { fetchCapCut } = require("./capcut");
const { fetchPinterest } = require("./pinterest");
const { fetchAio } = require("./aio");
const {
  fetchDouyin,
  fetchThreads,
  fetchReddit,
  fetchPixiv,
  fetchBilibili,
  fetchRednote,
} = require("./social");
const { synthesizeSpeech } = require("./tts");
const { searchComics, getComicDetail, getComicChapter } = require("./comic");

const MAX_BODY_BYTES = 64 * 1024;
const MEDIA_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

// ponytail: in-memory per-instance rate limiter (resets on serverless cold start; upgrade path: Vercel Firewall / Redis)
const rateBuckets = new Map();

function getClientIp(req) {
  const xff = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xff || req.socket?.remoteAddress || "unknown";
}

function checkRateLimit(req, bucket, limit, windowMs = 60_000) {
  const now = Date.now();
  if (rateBuckets.size > 500) {
    for (const [k, v] of rateBuckets) {
      if (v.resetAt <= now) rateBuckets.delete(k);
    }
  }
  const key = `${bucket}:${getClientIp(req)}`;
  let entry = rateBuckets.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 1, resetAt: now + windowMs };
    rateBuckets.set(key, entry);
    return { allowed: true, retryAfter: 0 };
  }
  entry.count += 1;
  if (entry.count > limit) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfter: 0 };
}

function isAllowedCaller(req) {
  const raw = req.headers.origin || req.headers.referer || "";
  if (!raw) return true; // Native APK / direct browser download
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    return (
      host === "blackpage-eta.vercel.app" ||
      host === "localhost" ||
      host === "127.0.0.1"
    );
  } catch {
    return false;
  }
}

function getCorsOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return "*";
  return isAllowedCaller(req) ? origin : "https://blackpage-eta.vercel.app";
}

function sendJson(res, status, data, extraHeaders = {}) {
  const payload = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Range",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(payload);
}

function readJsonBody(req) {
  if (req.body !== undefined) {
    if (typeof req.body === "string") {
      return Promise.resolve(req.body ? JSON.parse(req.body) : {});
    }
    return Promise.resolve(req.body || {});
  }
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        const err = new Error("Payload terlalu besar");
        err.statusCode = 413;
        return reject(err);
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        const err = new Error("JSON tidak valid");
        err.statusCode = 400;
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function isAllowedRemoteUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (
      host === "localhost" ||
      host === "0.0.0.0" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.") ||
      host.startsWith("fe80:") ||
      host.startsWith("fc00:") ||
      host.startsWith("fd") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function sanitizeFilename(name, fallback = "blackpage-media.mp4") {
  const cleaned = String(name || "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || fallback;
}

function sendSvgPlaceholder(res) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" width="300" height="400"><rect width="300" height="400" fill="#1B1B1F"/><rect x="16" y="16" width="268" height="368" fill="none" stroke="#FAF7F0" stroke-width="4"/><text x="150" y="206" text-anchor="middle" fill="#FAF7F0" font-family="sans-serif" font-weight="800" font-size="28" letter-spacing="4">KOMIK</text></svg>`;
  res.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "public, max-age=300",
  });
  res.end(svg);
}

function proxyMedia(req, res, targetUrl, { download = false, filename = "", ref = "", fallback = false }, redirectsLeft = 5) {
  if (!isAllowedRemoteUrl(targetUrl)) {
    return sendJson(res, 400, { status: "error", message: "URL media tidak valid" });
  }

  const u = new URL(targetUrl);
  const lib = u.protocol === "https:" ? https : http;
  const host = u.hostname.toLowerCase();
  const isMd = /(?:^|\.)mangadex\.(?:org|network)$/i.test(host);
  const REFERER_MAP = [
    [/komiku\./i, "https://komiku.org/"],
    [/komikindo\./i, "https://komikindo.ch/"],
    [/bacakomik\./i, "https://bacakomik.my/"],
    [/kiryuu\./i, "https://v7.kiryuu.to/"],
    [/manhwaindo\./i, "https://www.manhwaindo.my/"],
    [/komikcast\./i, "https://komikcast.info/"],
    [/pximg\.net/i, "https://www.pixiv.net/"],
    [/bilivideo\.|bilibili\.com/i, "https://www.bilibili.com/"],
    [/xhscdn\.|xiaohongshu\.com/i, "https://www.xiaohongshu.com/"],
    [/douyinpic\.|iesdouyin\.com|snssdk\.com/i, "https://www.douyin.com/"],
  ];
  const matchedRef = REFERER_MAP.find(([re]) => re.test(host))?.[1];
  const safeCustomRef = ref && isAllowedRemoteUrl(ref) ? ref : "";
  const referer = isMd ? "https://mangadex.org/" : matchedRef || safeCustomRef || "https://ssstik.io/";
  const headers = {
    "User-Agent": isMd ? "blackpage/1.3.0" : MEDIA_UA,
  };
  if (ref !== "__none__") {
    headers.Referer = referer;
  }
  if (isMd) {
    headers.Accept = "image/avif,image/webp,image/*,*/*;q=0.8";
  }
  if (req.headers.range) headers.Range = req.headers.range;

  const upstream = lib.request(
    {
      hostname: u.hostname,
      port: u.port || undefined,
      path: u.pathname + u.search,
      method: "GET",
      headers,
      timeout: 20000,
    },
    (upRes) => {
      if (upRes.statusCode === 403 && ref !== "__none__" && !isMd) {
        upRes.resume();
        return proxyMedia(req, res, targetUrl, { download, filename, ref: "__none__", fallback }, redirectsLeft);
      }
      if ([301, 302, 303, 307, 308].includes(upRes.statusCode) && upRes.headers.location) {
        upRes.resume();
        if (redirectsLeft <= 0) {
          if (fallback) return sendSvgPlaceholder(res);
          return sendJson(res, 502, { status: "error", message: "Terlalu banyak redirect" });
        }
        const nextUrl = upRes.headers.location.startsWith("http")
          ? upRes.headers.location
          : `${u.protocol}//${u.host}${upRes.headers.location}`;
        return proxyMedia(req, res, nextUrl, { download, filename, ref, fallback }, redirectsLeft - 1);
      }

      let contentType = upRes.headers["content-type"] || "application/octet-stream";
      if (fallback && ((upRes.statusCode || 200) >= 400 || /^text\/html/i.test(contentType))) {
        upRes.resume();
        return sendSvgPlaceholder(res);
      }
      if (!download && contentType === "application/octet-stream") {
        contentType = /\.mp3|\/ssstik\/m\//i.test(targetUrl) ? "audio/mpeg" : "video/mp4";
      }

      const outHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": contentType,
      };
      if (upRes.headers["accept-ranges"]) {
        outHeaders["Accept-Ranges"] = upRes.headers["accept-ranges"];
      } else if (upRes.headers["content-length"]) {
        outHeaders["Accept-Ranges"] = "bytes";
      }
      if (upRes.headers["content-length"]) {
        outHeaders["Content-Length"] = upRes.headers["content-length"];
      }
      if (upRes.headers["content-range"]) {
        outHeaders["Content-Range"] = upRes.headers["content-range"];
      }
      if (download) {
        const safeName = sanitizeFilename(filename);
        outHeaders["Content-Disposition"] = `attachment; filename="${safeName}"`;
      }

      res.writeHead(upRes.statusCode || 200, outHeaders);
      upRes.pipe(res);
    }
  );

  upstream.on("timeout", () => {
    upstream.destroy(new Error("Media timeout"));
  });
  upstream.on("error", (err) => {
    if (!res.headersSent) {
      if (fallback) return sendSvgPlaceholder(res);
      sendJson(res, 502, { status: "error", message: err.message || "Gagal memuat media" });
    } else {
      res.destroy();
    }
  });
  req.on("close", () => upstream.destroy());
  upstream.end();
}

async function handleApiRequest(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const { pathname, searchParams } = urlObj;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": getCorsOrigin(req),
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Range",
    });
    res.end();
    return true;
  }

  if (pathname === "/favicon.ico" && req.method === "GET") {
    res.writeHead(204);
    res.end();
    return true;
  }

  if (pathname === "/api/health" && req.method === "GET") {
    sendJson(res, 200, { ok: true, service: "blackpage", version: "1.4.0" });
    return true;
  }

  if (pathname.startsWith("/api/") && !isAllowedCaller(req)) {
    sendJson(res, 403, { status: "error", message: "Akses ditolak." });
    return true;
  }

  if (pathname === "/api/media" && req.method === "GET") {
    const rl = checkRateLimit(req, "media", 120);
    if (!rl.allowed) {
      sendJson(
        res,
        429,
        { status: "error", message: "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi." },
        { "Retry-After": String(rl.retryAfter) }
      );
      return true;
    }
    const targetUrl = searchParams.get("url") || "";
    const download = searchParams.get("download") === "1";
    const filename = searchParams.get("filename") || "";
    const ref = searchParams.get("ref") || "";
    const fallback = searchParams.get("fallback") === "1";
    proxyMedia(req, res, targetUrl, { download, filename, ref, fallback });
    return true;
  }

  if (pathname === "/api/tts" && req.method === "GET") {
    const rl = checkRateLimit(req, "tts", 20);
    if (!rl.allowed) {
      sendJson(
        res,
        429,
        { status: "error", message: "Terlalu banyak permintaan TTS. Tunggu sebentar." },
        { "Retry-After": String(rl.retryAfter) }
      );
      return true;
    }
    const text = searchParams.get("text") || "";
    const lang = searchParams.get("lang") || "id";
    const download = searchParams.get("download") === "1";
    const filename = sanitizeFilename(searchParams.get("filename") || "blackpage_tts.mp3");
    try {
      const audioBuf = await synthesizeSpeech(text, lang);
      const headers = {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuf.length),
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      };
      if (download) {
        headers["Content-Disposition"] = `attachment; filename="${filename}"`;
      }
      res.writeHead(200, headers);
      res.end(audioBuf);
    } catch (err) {
      sendJson(res, 400, { status: "error", message: err.message || "Gagal membuat audio TTS." });
    }
    return true;
  }

  const postRoutes = {
    "/api/tiktok": async (body) => fetchTikTok(typeof body.url === "string" ? body.url.trim() : ""),
    "/api/youtube": async (body) =>
      fetchYouTube(typeof body.url === "string" ? body.url.trim() : "", {
        type: body.type,
        quality: body.quality,
      }),
    "/api/youtube/playlist": async (body) =>
      fetchYouTubePlaylist(typeof body.url === "string" ? body.url.trim() : ""),
    "/api/spotify": async (body) => fetchSpotify(typeof body.q === "string" ? body.q.trim() : ""),
    "/api/spotify/playlist": async (body) =>
      fetchSpotifyPlaylist(typeof body.url === "string" ? body.url.trim() : ""),
    "/api/instagram": async (body) =>
      fetchInstagram(typeof body.url === "string" ? body.url.trim() : ""),
    "/api/facebook": async (body) =>
      fetchFacebook(typeof body.url === "string" ? body.url.trim() : ""),
    "/api/capcut": async (body) => fetchCapCut(typeof body.url === "string" ? body.url.trim() : ""),
    "/api/pinterest": async (body) =>
      fetchPinterest(typeof body.url === "string" ? body.url.trim() : ""),
    "/api/douyin": async (body) => fetchDouyin(typeof body.url === "string" ? body.url.trim() : ""),
    "/api/threads": async (body) => fetchThreads(typeof body.url === "string" ? body.url.trim() : ""),
    "/api/reddit": async (body) => fetchReddit(typeof body.url === "string" ? body.url.trim() : ""),
    "/api/pixiv": async (body) => fetchPixiv(typeof body.url === "string" ? body.url.trim() : ""),
    "/api/bilibili": async (body) => fetchBilibili(typeof body.url === "string" ? body.url.trim() : ""),
    "/api/rednote": async (body) => fetchRednote(typeof body.url === "string" ? body.url.trim() : ""),
    "/api/aio": async (body) => fetchAio(typeof body.url === "string" ? body.url.trim() : ""),
    "/api/comic/search": async (body) =>
      searchComics(
        typeof body.q === "string" ? body.q : "",
        typeof body.server === "string" ? body.server : "auto",
        body.page
      ),
    "/api/comic/detail": async (body) => getComicDetail(typeof body.url === "string" ? body.url : ""),
    "/api/comic/read": async (body) => getComicChapter(typeof body.url === "string" ? body.url : ""),
  };

  if (postRoutes[pathname] && req.method === "POST") {
    const rl = checkRateLimit(req, "api", 30);
    if (!rl.allowed) {
      sendJson(
        res,
        429,
        { status: "error", message: "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi." },
        { "Retry-After": String(rl.retryAfter) }
      );
      return true;
    }
    try {
      const body = await readJsonBody(req);
      const result = await postRoutes[pathname](body);
      sendJson(res, 200, result);
    } catch (err) {
      const code = err.statusCode || 500;
      sendJson(res, code, {
        status: "error",
        message: err.message || "Gagal memproses permintaan",
      });
    }
    return true;
  }

  if (pathname.startsWith("/api/")) {
    sendJson(res, 404, { status: "error", message: "Endpoint tidak ditemukan" });
    return true;
  }

  return false;
}

module.exports = {
  handleApiRequest,
  sendJson,
  isAllowedRemoteUrl,
  sanitizeFilename,
};
