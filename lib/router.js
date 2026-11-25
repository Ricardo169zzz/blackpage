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

const MAX_BODY_BYTES = 64 * 1024;
const MEDIA_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

function sendJson(res, status, data) {
  const payload = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Range",
    "Cache-Control": "no-store",
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
    const host = u.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
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

function proxyMedia(req, res, targetUrl, { download = false, filename = "" }, redirectsLeft = 5) {
  if (!isAllowedRemoteUrl(targetUrl)) {
    return sendJson(res, 400, { status: "error", message: "URL media tidak valid" });
  }

  const u = new URL(targetUrl);
  const lib = u.protocol === "https:" ? https : http;
  const headers = {
    "User-Agent": MEDIA_UA,
    Referer: "https://ssstik.io/",
  };
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
      if ([301, 302, 303, 307, 308].includes(upRes.statusCode) && upRes.headers.location) {
        upRes.resume();
        if (redirectsLeft <= 0) {
          return sendJson(res, 502, { status: "error", message: "Terlalu banyak redirect" });
        }
        const nextUrl = upRes.headers.location.startsWith("http")
          ? upRes.headers.location
          : `${u.protocol}//${u.host}${upRes.headers.location}`;
        return proxyMedia(req, res, nextUrl, { download, filename }, redirectsLeft - 1);
      }

      let contentType = upRes.headers["content-type"] || "application/octet-stream";
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
      "Access-Control-Allow-Origin": "*",
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
    sendJson(res, 200, { ok: true, service: "blackpage", version: "1.0.0" });
    return true;
  }

  if (pathname === "/api/media" && req.method === "GET") {
    const targetUrl = searchParams.get("url") || "";
    const download = searchParams.get("download") === "1";
    const filename = searchParams.get("filename") || "";
    proxyMedia(req, res, targetUrl, { download, filename });
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
    "/api/aio": async (body) => fetchAio(typeof body.url === "string" ? body.url.trim() : ""),
  };

  if (postRoutes[pathname] && req.method === "POST") {
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
