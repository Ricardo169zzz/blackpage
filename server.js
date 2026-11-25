const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { fetchTikTok } = require("./api/tiktok");
const { fetchYouTube, fetchYouTubePlaylist } = require("./api/youtube");
const { fetchSpotify, fetchSpotifyPlaylist } = require("./api/spotify");
const { fetchInstagram } = require("./api/instagram");
const { fetchFacebook } = require("./api/facebook");
const { fetchCapCut } = require("./api/capcut");
const { fetchPinterest } = require("./api/pinterest");
const { fetchAio } = require("./api/aio");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const MAX_BODY_BYTES = 64 * 1024;
const MEDIA_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

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

function serveStatic(req, res, pathname) {
  const relPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(relPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end("Not Found");
      }
      res.writeHead(500);
      return res.end("Internal Server Error");
    }

    const ext = path.extname(filePath).toLowerCase();
    const isCode = ext === ".html" || ext === ".css" || ext === ".js";
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": isCode ? "no-store" : "public, max-age=3600",
    });
    res.end(content);
  });
}

function createServer() {
  return http.createServer(async (req, res) => {
    const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const { pathname, searchParams } = urlObj;

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Range",
      });
      return res.end();
    }

    if (pathname === "/favicon.ico" && req.method === "GET") {
      res.writeHead(204);
      return res.end();
    }

    if (pathname === "/api/health" && req.method === "GET") {
      return sendJson(res, 200, { ok: true, service: "blackpage", version: "1.0.0" });
    }

    if (pathname === "/api/media" && req.method === "GET") {
      const targetUrl = searchParams.get("url") || "";
      const download = searchParams.get("download") === "1";
      const filename = searchParams.get("filename") || "";
      return proxyMedia(req, res, targetUrl, { download, filename });
    }

    if (pathname === "/api/tiktok" && req.method === "POST") {
      try {
        const body = await readJsonBody(req);
        const targetUrl = typeof body.url === "string" ? body.url.trim() : "";
        const result = await fetchTikTok(targetUrl);
        return sendJson(res, 200, result);
      } catch (err) {
        const code = err.statusCode || 500;
        return sendJson(res, code, {
          status: "error",
          message: err.message || "Gagal memproses permintaan",
        });
      }
    }

    if (pathname === "/api/youtube" && req.method === "POST") {
      try {
        const body = await readJsonBody(req);
        const targetUrl = typeof body.url === "string" ? body.url.trim() : "";
        const result = await fetchYouTube(targetUrl, {
          type: body.type,
          quality: body.quality,
        });
        return sendJson(res, 200, result);
      } catch (err) {
        const code = err.statusCode || 500;
        return sendJson(res, code, {
          status: "error",
          message: err.message || "Gagal memproses permintaan YouTube",
        });
      }
    }

    if (pathname === "/api/youtube/playlist" && req.method === "POST") {
      try {
        const body = await readJsonBody(req);
        const targetUrl = typeof body.url === "string" ? body.url.trim() : "";
        const result = await fetchYouTubePlaylist(targetUrl);
        return sendJson(res, 200, result);
      } catch (err) {
        const code = err.statusCode || 500;
        return sendJson(res, code, {
          status: "error",
          message: err.message || "Gagal memproses playlist YouTube",
        });
      }
    }

    if (pathname === "/api/spotify" && req.method === "POST") {
      try {
        const body = await readJsonBody(req);
        const query = typeof body.q === "string" ? body.q.trim() : "";
        const result = await fetchSpotify(query);
        return sendJson(res, 200, result);
      } catch (err) {
        const code = err.statusCode || 500;
        return sendJson(res, code, {
          status: "error",
          message: err.message || "Gagal memproses permintaan Spotify",
        });
      }
    }

    if (pathname === "/api/spotify/playlist" && req.method === "POST") {
      try {
        const body = await readJsonBody(req);
        const targetUrl = typeof body.url === "string" ? body.url.trim() : "";
        const result = await fetchSpotifyPlaylist(targetUrl);
        return sendJson(res, 200, result);
      } catch (err) {
        const code = err.statusCode || 500;
        return sendJson(res, code, {
          status: "error",
          message: err.message || "Gagal memproses playlist Spotify",
        });
      }
    }

    if (pathname === "/api/instagram" && req.method === "POST") {
      try {
        const body = await readJsonBody(req);
        const targetUrl = typeof body.url === "string" ? body.url.trim() : "";
        const result = await fetchInstagram(targetUrl);
        return sendJson(res, 200, result);
      } catch (err) {
        const code = err.statusCode || 500;
        return sendJson(res, code, {
          status: "error",
          message: err.message || "Gagal memproses permintaan Instagram",
        });
      }
    }

    if (pathname === "/api/facebook" && req.method === "POST") {
      try {
        const body = await readJsonBody(req);
        const targetUrl = typeof body.url === "string" ? body.url.trim() : "";
        const result = await fetchFacebook(targetUrl);
        return sendJson(res, 200, result);
      } catch (err) {
        const code = err.statusCode || 500;
        return sendJson(res, code, {
          status: "error",
          message: err.message || "Gagal memproses permintaan Facebook",
        });
      }
    }

    if (pathname === "/api/capcut" && req.method === "POST") {
      try {
        const body = await readJsonBody(req);
        const targetUrl = typeof body.url === "string" ? body.url.trim() : "";
        const result = await fetchCapCut(targetUrl);
        return sendJson(res, 200, result);
      } catch (err) {
        const code = err.statusCode || 500;
        return sendJson(res, code, {
          status: "error",
          message: err.message || "Gagal memproses permintaan CapCut",
        });
      }
    }

    if (pathname === "/api/pinterest" && req.method === "POST") {
      try {
        const body = await readJsonBody(req);
        const targetUrl = typeof body.url === "string" ? body.url.trim() : "";
        const result = await fetchPinterest(targetUrl);
        return sendJson(res, 200, result);
      } catch (err) {
        const code = err.statusCode || 500;
        return sendJson(res, code, {
          status: "error",
          message: err.message || "Gagal memproses permintaan Pinterest",
        });
      }
    }

    if (pathname === "/api/aio" && req.method === "POST") {
      try {
        const body = await readJsonBody(req);
        const targetUrl = typeof body.url === "string" ? body.url.trim() : "";
        const result = await fetchAio(targetUrl);
        return sendJson(res, 200, result);
      } catch (err) {
        const code = err.statusCode || 500;
        return sendJson(res, code, {
          status: "error",
          message: err.message || "Gagal memproses link",
        });
      }
    }

    if (req.method === "GET") {
      return serveStatic(req, res, pathname);
    }

    sendJson(res, 405, { status: "error", message: "Method Not Allowed" });
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`Blackpage running at http://localhost:${PORT}`);
  });
}

module.exports = { createServer, isAllowedRemoteUrl, sanitizeFilename };
