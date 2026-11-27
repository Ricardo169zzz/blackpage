const https = require("https");
const http = require("http");

const IG_ENDPOINT = "https://api.nexadev.my.id/api/ig/";
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
            reject(new Error("Respons API Instagram tidak valid"));
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("Request timeout")));
    req.on("error", reject);
  });
}

function isValidInstagramUrl(raw) {
  try {
    const u = new URL(raw);
    return (
      (u.protocol === "https:" || u.protocol === "http:") &&
      /^(www\.|m\.)?(instagram\.com|instagr\.am)$/i.test(u.hostname)
    );
  } catch {
    return false;
  }
}

async function fetchInstagram(igUrl) {
  if (!isValidInstagramUrl(igUrl)) {
    const err = new Error("URL Instagram tidak valid");
    err.statusCode = 400;
    throw err;
  }

  const params = new URLSearchParams({ url: igUrl });
  const raw = await getJson(`${IG_ENDPOINT}?${params.toString()}`);

  const list = Array.isArray(raw?.data) ? raw.data.filter((x) => x && x.url) : [];
  if (!raw || raw.status !== true || !list.length) {
    const rawMsg = String(raw?.message || raw?.msg || "");
    if (/private|akun pribadi|is_private|login required|not authorized/i.test(rawMsg)) {
      throw new Error(
        "Akun Instagram ini bersifat private. Server tidak dapat mengambil foto/video dari akun private."
      );
    }
    throw new Error(rawMsg || "Media Instagram tidak ditemukan");
  }

  return {
    status: "success",
    url: igUrl,
    items: list.map((item) => ({
      type: (item.type || "mp4").toLowerCase(),
      url: item.url,
    })),
  };
}

module.exports = { fetchInstagram, isValidInstagramUrl };
