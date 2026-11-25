const https = require("https");
const http = require("http");

const AIO_ENDPOINT = "https://api.nexadev.my.id/api/aio/";
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
            reject(new Error("Respons API AIO tidak valid"));
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("Request timeout")));
    req.on("error", reject);
  });
}

function isValidHttpUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

async function fetchAio(targetUrl) {
  if (!isValidHttpUrl(targetUrl)) {
    const err = new Error("URL tidak valid");
    err.statusCode = 400;
    throw err;
  }

  const params = new URLSearchParams({ url: targetUrl });
  const raw = await getJson(`${AIO_ENDPOINT}?${params.toString()}`);

  if (!raw || raw.status !== true || !raw.data) {
    throw new Error(raw?.msg || raw?.message || "Konten tidak ditemukan atau private");
  }

  const d = raw.data;
  const downloads = [];

  if (typeof d.video === "string" && d.video.startsWith("http")) {
    downloads.push({ type: "video", label: "Unduh Video (MP4)", url: d.video });
  }
  if (typeof d.videoWM === "string" && d.videoWM.startsWith("http") && d.videoWM !== d.video) {
    downloads.push({ type: "video", label: "Unduh Video (WM)", url: d.videoWM });
  }
  if (typeof d.audio === "string" && d.audio.startsWith("http")) {
    downloads.push({ type: "audio", label: "Unduh Audio (MP3)", url: d.audio });
  }
  if (typeof d.url === "string" && d.url.startsWith("http") && !downloads.length) {
    const isAudio = /\.mp3(\?|$)/i.test(d.url);
    downloads.push({ type: isAudio ? "audio" : "video", label: isAudio ? "Unduh MP3" : "Unduh Media", url: d.url });
  }
  if (Array.isArray(d.images)) {
    d.images.forEach((imgUrl, idx) => {
      if (typeof imgUrl === "string" && imgUrl.startsWith("http")) {
        downloads.push({ type: "image", label: `Unduh Foto #${idx + 1}`, url: imgUrl });
      }
    });
  } else if (typeof d.photo === "string" && d.photo.startsWith("http")) {
    downloads.push({ type: "image", label: "Unduh Foto", url: d.photo });
  }

  if (!downloads.length) {
    throw new Error(raw?.msg || "Media tidak tersedia untuk link ini");
  }

  return {
    status: "success",
    url: targetUrl,
    title: d.title || null,
    author: d.author || new URL(targetUrl).hostname.replace(/^www\./, ""),
    thumbnail: d.thumbnail || d.cover || null,
    downloads,
  };
}

module.exports = { fetchAio, isValidHttpUrl };
