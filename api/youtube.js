const https = require("https");
const http = require("http");

const YT_ENDPOINT = "https://api.nexadev.my.id/api/ytmp4/";
const YT_PLAYLIST_ENDPOINT = "https://api.nexadev.my.id/api/ytplaylist/";
const ALLOWED_TYPES = new Set(["video", "audio"]);
const ALLOWED_QUALITIES = new Set(["360p", "480p", "720p", "1080p"]);
const REQUEST_TIMEOUT_MS = 30000;

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
            reject(new Error("Respons API YouTube tidak valid"));
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("Request timeout")));
    req.on("error", reject);
  });
}

function isValidYouTubeUrl(raw) {
  try {
    const u = new URL(raw);
    return (
      (u.protocol === "https:" || u.protocol === "http:") &&
      /^(www\.|m\.|music\.)?(youtube\.com|youtu\.be)$/i.test(u.hostname)
    );
  } catch {
    return false;
  }
}

async function fetchYouTube(youtubeUrl, opts = {}) {
  if (!isValidYouTubeUrl(youtubeUrl)) {
    const err = new Error("URL YouTube tidak valid");
    err.statusCode = 400;
    throw err;
  }

  const type = ALLOWED_TYPES.has(opts.type) ? opts.type : "video";
  const quality = ALLOWED_QUALITIES.has(opts.quality) ? opts.quality : "720p";

  const params = new URLSearchParams({ url: youtubeUrl, type, quality });
  const raw = await getJson(`${YT_ENDPOINT}?${params.toString()}`);

  if (!raw || raw.status !== true || !raw.data?.url) {
    throw new Error(raw?.message || "Gagal mengambil video YouTube");
  }

  return {
    status: "success",
    url: youtubeUrl,
    id: raw.id || null,
    title: raw.title || "YouTube Video",
    channel: raw.channel || "YouTube",
    thumbnail: raw.thumbnail || null,
    duration: raw.fduration || raw.duration || null,
    views: raw.views || null,
    publish: raw.publish || null,
    type,
    quality: raw.data.quality || quality,
    size: raw.data.size || null,
    extension: raw.data.extension || (type === "audio" ? "mp3" : "mp4"),
    filename: raw.data.filename || null,
    downloadUrl: raw.data.url,
  };
}

async function fetchYouTubePlaylist(playlistUrl) {
  if (!isValidYouTubeUrl(playlistUrl)) {
    const err = new Error("URL Playlist YouTube tidak valid");
    err.statusCode = 400;
    throw err;
  }

  const params = new URLSearchParams({ url: playlistUrl });
  const raw = await getJson(`${YT_PLAYLIST_ENDPOINT}?${params.toString()}`);

  const list = Array.isArray(raw?.data)
    ? raw.data
    : Array.isArray(raw?.data?.items)
      ? raw.data.items
      : Array.isArray(raw?.data?.videos)
        ? raw.data.videos
        : Array.isArray(raw?.items)
          ? raw.items
          : [];

  if (!raw || raw.status !== true || !list.length) {
    throw new Error(raw?.message || "Playlist YouTube tidak ditemukan atau server provider sedang bermasalah");
  }

  return {
    status: "success",
    url: playlistUrl,
    title: raw.title || raw.data?.title || "YouTube Playlist",
    items: list
      .map((item) => {
        const videoUrl =
          item.url ||
          item.videoUrl ||
          item.link ||
          (item.id || item.videoId ? `https://youtu.be/${item.id || item.videoId}` : null);
        if (!videoUrl) return null;
        return {
          title: item.title || "YouTube Video",
          url: videoUrl,
          thumbnail: item.thumbnail || item.thumb || null,
          duration: item.duration || item.timestamp || null,
          channel: item.channel || item.author || null,
        };
      })
      .filter(Boolean),
  };
}

module.exports = { fetchYouTube, fetchYouTubePlaylist, isValidYouTubeUrl };
