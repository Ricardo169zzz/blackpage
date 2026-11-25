const https = require("https");
const crypto = require("crypto");

const BASE_URL = "https://3bic.com";
const UA = "Mozilla/5.0 (Android 14; Mobile; rv:144.0) Gecko/144.0 Firefox/144.0";
const REQUEST_TIMEOUT_MS = 15000;

function isValidCapCutUrl(raw) {
  try {
    const u = new URL(raw);
    return (
      (u.protocol === "https:" || u.protocol === "http:") &&
      /(^|\.)capcut\.com$/i.test(u.hostname)
    );
  } catch {
    return false;
  }
}

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const sessionId = crypto.randomUUID();
    const deviceId = crypto.randomUUID().replace(/-/g, "");
    const body = JSON.stringify(payload);
    const u = new URL(url);

    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "POST",
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": UA,
          Referer: `${BASE_URL}/`,
          Cookie: `session_id=${sessionId}; device_id=${deviceId}`,
        },
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`Provider HTTP ${res.statusCode}`));
          }
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error("Respons API CapCut tidak valid"));
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("Request timeout")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function fetchCapCut(capcutUrl) {
  if (!isValidCapCutUrl(capcutUrl)) {
    const err = new Error("URL CapCut tidak valid");
    err.statusCode = 400;
    throw err;
  }

  const raw = await postJson(`${BASE_URL}/api/download`, { url: capcutUrl });
  const resolveUrl = (url) => {
    if (!url) return null;
    const match = url.match(/\/api\/cdn\/([A-Za-z0-9+/=_-]+)/);
    if (match) {
      try {
        const decoded = Buffer.from(match[1], "base64").toString("utf8");
        if (decoded.startsWith("http")) return decoded;
      } catch {
        // Fallback to 3bic proxy URL
      }
    }
    return url.startsWith("http") ? url : `${BASE_URL}${url}`;
  };

  const video = resolveUrl(raw?.originalVideoUrl);
  if (!video) {
    throw new Error(raw?.message || "Video CapCut tidak ditemukan");
  }

  return {
    status: "success",
    url: capcutUrl,
    title: raw.title || "CapCut Template",
    author: raw.authorName || "CapCut Creator",
    cover: raw.coverUrl || null,
    video,
  };
}

module.exports = { fetchCapCut, isValidCapCutUrl };
