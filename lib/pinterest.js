const https = require("https");
const http = require("http");

const PIN_ENDPOINT = "https://api.nexadev.my.id/api/pin/";
const REQUEST_TIMEOUT_MS = 25000;

function getJson(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.get(
      {
        hostname: u.hostname,
        port: u.port || undefined,
        path: u.pathname + u.search,
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          "User-Agent": "Blackpage/1.0",
          Accept: "application/json",
        },
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) return reject(new Error("Too many redirects"));
          const next = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, url).toString();
          return resolve(getJson(next, redirectsLeft - 1));
        }

        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`Provider HTTP ${res.statusCode}`));
          }
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error("Respons API Pinterest tidak valid"));
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("Request timeout")));
    req.on("error", reject);
  });
}

function isValidPinterestUrl(raw) {
  try {
    const u = new URL(raw);
    return (
      (u.protocol === "https:" || u.protocol === "http:") &&
      /^(www\.|id\.)?(pin\.it|pinterest\.[a-z.]+)$/i.test(u.hostname)
    );
  } catch {
    return false;
  }
}

async function fetchPinterest(pinUrl) {
  if (!isValidPinterestUrl(pinUrl)) {
    const err = new Error("URL Pinterest tidak valid");
    err.statusCode = 400;
    throw err;
  }

  const params = new URLSearchParams({ url: pinUrl });
  const raw = await getJson(`${PIN_ENDPOINT}?${params.toString()}`);

  const list = Array.isArray(raw?.data) ? raw.data.filter((x) => x && x.url) : [];
  if (!raw || raw.status !== true || !list.length) {
    throw new Error(raw?.message || "Media Pinterest tidak ditemukan");
  }

  return {
    status: "success",
    url: pinUrl,
    items: list.map((item) => ({
      url: item.url,
      width: item.width || null,
      height: item.height || null,
      isVideo: /\.(mp4|webm|m3u8)(\?|$)/i.test(item.url),
    })),
  };
}

module.exports = { fetchPinterest, isValidPinterestUrl };
