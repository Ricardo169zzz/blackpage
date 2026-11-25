const https = require("https");
const http = require("http");

const FB_ENDPOINT = "https://api.nexadev.my.id/api/fb/";
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
            reject(new Error("Respons API Facebook tidak valid"));
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("Request timeout")));
    req.on("error", reject);
  });
}

function isValidFacebookUrl(raw) {
  try {
    const u = new URL(raw);
    return (
      (u.protocol === "https:" || u.protocol === "http:") &&
      /^(www\.|m\.|web\.|mbasic\.)?(facebook\.com|fb\.watch)$/i.test(u.hostname)
    );
  } catch {
    return false;
  }
}

async function fetchFacebook(fbUrl) {
  if (!isValidFacebookUrl(fbUrl)) {
    const err = new Error("URL Facebook tidak valid");
    err.statusCode = 400;
    throw err;
  }

  const params = new URLSearchParams({ url: fbUrl });
  const raw = await getJson(`${FB_ENDPOINT}?${params.toString()}`);

  const list = Array.isArray(raw?.data) ? raw.data.filter((x) => x && x.url) : [];
  if (!raw || raw.status !== true || !list.length) {
    throw new Error(raw?.message || "Video Facebook tidak ditemukan");
  }

  return {
    status: "success",
    url: fbUrl,
    downloads: list.map((item) => ({
      quality: item.quality || "MP4",
      url: item.url,
    })),
  };
}

module.exports = { fetchFacebook, isValidFacebookUrl };
