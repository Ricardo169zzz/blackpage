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

function extractVideoId(url) {
  const m = String(url || "").match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
  );
  return m ? m[1] : null;
}

async function fetchOembedMeta(videoId) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const d = await res.json();
      return {
        title: d.title || "YouTube Video",
        channel: d.author_name || "YouTube",
        thumbnail: d.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      };
    }
  } catch {}
  return {
    title: "YouTube Video",
    channel: "YouTube",
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };
}

async function fetchViaConvert1s(youtubeUrl, type, quality) {
  const headers = {
    Origin: "https://media.ytmp3.gg",
    Referer: "https://media.ytmp3.gg/",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Content-Type": "application/json",
  };
  const initRes = await fetch("https://hub.convert1s.com/api/download", {
    method: "POST",
    headers,
    body: JSON.stringify({
      url: youtubeUrl,
      os: "macos",
      output: {
        type: type === "audio" ? "audio" : "video",
        format: type === "audio" ? "mp3" : "mp4",
        quality: type === "audio" ? "" : quality,
      },
      audio: { bitrate: "128k" },
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!initRes.ok) throw new Error(`Convert1s HTTP ${initRes.status}`);
  const conv = await initRes.json();
  if (!conv?.statusUrl) throw new Error("Convert1s tidak mengembalikan statusUrl");

  for (let i = 0; i < 16; i++) {
    await new Promise((r) => setTimeout(r, 1400));
    const pollRes = await fetch(conv.statusUrl, { headers, signal: AbortSignal.timeout(6000) });
    if (!pollRes.ok) continue;
    const poll = await pollRes.json();
    if (poll?.status === "completed" && poll?.downloadUrl) {
      return {
        title: conv.title || poll.title || null,
        duration: conv.duration
          ? `${String(Math.floor(conv.duration / 60)).padStart(2, "0")}:${String(conv.duration % 60).padStart(2, "0")}`
          : null,
        quality: conv.selectedQuality || quality,
        downloadUrl: poll.downloadUrl,
      };
    }
    if (poll?.status === "error" || poll?.status === "failed") {
      throw new Error(poll?.message || "Convert1s gagal memproses video");
    }
  }
  throw new Error("Convert1s timeout menunggu file siap");
}

async function fetchViaYtmp3Mobi(videoId, type) {
  const format = type === "audio" ? "mp3" : "mp4";
  const headers = {
    Origin: "https://ytmp3.mobi",
    Referer: "https://ytmp3.mobi/en8/",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    Accept: "*/*",
  };
  const initRes = await fetch(
    `https://a.ymcdn.org/api/v1/init?p=y&23=1llum1n471&_=${Math.random()}`,
    { headers, signal: AbortSignal.timeout(10000) }
  );
  const initData = await initRes.json();
  if (!initData?.convertURL) throw new Error("ytmp3.mobi init gagal");

  let convData = await (
    await fetch(`${initData.convertURL}&v=${videoId}&f=${format}&_=${Math.random()}`, {
      headers,
      signal: AbortSignal.timeout(10000),
    })
  ).json();

  let redirGuard = 0;
  while (convData && convData.redirect > 0 && convData.redirectURL && redirGuard < 3) {
    redirGuard += 1;
    convData = await (
      await fetch(`${convData.redirectURL}&v=${videoId}&f=${format}&_=${Math.random()}`, {
        headers,
        signal: AbortSignal.timeout(10000),
      })
    ).json();
  }

  if (!convData || convData.error) throw new Error("ytmp3.mobi convert gagal");

  let progress = 0;
  let finalUrl = convData.downloadURL;
  for (let i = 0; i < 10 && progress < 3; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const progData = await (
      await fetch(`${convData.progressURL}&_=${Math.random()}`, {
        headers,
        signal: AbortSignal.timeout(6000),
      })
    ).json();
    progress = progData?.progress ?? 0;
    if (progData?.downloadURL) finalUrl = progData.downloadURL;
    if (progress === 4) break;
  }

  if (!finalUrl || progress < 3) throw new Error("ytmp3.mobi belum siap");
  return {
    downloadUrl: finalUrl.startsWith("//") ? `https:${finalUrl}` : finalUrl,
  };
}

async function fetchYouTube(youtubeUrl, opts = {}) {
  if (!isValidYouTubeUrl(youtubeUrl)) {
    const err = new Error("URL YouTube tidak valid");
    err.statusCode = 400;
    throw err;
  }

  const type = ALLOWED_TYPES.has(opts.type) ? opts.type : "video";
  const quality = ALLOWED_QUALITIES.has(opts.quality) ? opts.quality : "720p";
  const videoId = extractVideoId(youtubeUrl);

  try {
    const [meta, conv] = await Promise.all([
      videoId ? fetchOembedMeta(videoId) : Promise.resolve({}),
      fetchViaConvert1s(youtubeUrl, type, quality),
    ]);
    return {
      status: "success",
      url: youtubeUrl,
      id: videoId,
      title: conv.title || meta.title || "YouTube Video",
      channel: meta.channel || "YouTube",
      thumbnail: meta.thumbnail || null,
      duration: conv.duration || null,
      views: null,
      publish: null,
      type,
      quality: type === "audio" ? "128kbps" : conv.quality || quality,
      size: null,
      extension: type === "audio" ? "mp3" : "mp4",
      filename: null,
      downloadUrl: conv.downloadUrl,
    };
  } catch {
    if (videoId) {
      try {
        const [meta, mobi] = await Promise.all([
          fetchOembedMeta(videoId),
          fetchViaYtmp3Mobi(videoId, type),
        ]);
        return {
          status: "success",
          url: youtubeUrl,
          id: videoId,
          title: meta.title || "YouTube Video",
          channel: meta.channel || "YouTube",
          thumbnail: meta.thumbnail || null,
          duration: null,
          views: null,
          publish: null,
          type,
          quality: type === "audio" ? "320kbps" : "720p",
          size: null,
          extension: type === "audio" ? "mp3" : "mp4",
          filename: null,
          downloadUrl: mobi.downloadUrl,
        };
      } catch {}
    }
  }

  const params = new URLSearchParams({ url: youtubeUrl, type, quality });
  const raw = await getJson(`${YT_ENDPOINT}?${params.toString()}`);

  if (!raw || raw.status !== true || !raw.data?.url) {
    throw new Error(raw?.message || "Gagal mengambil video YouTube");
  }
  if (/secure-signed\.pages\.dev/i.test(raw.data.url)) {
    throw new Error("Video YouTube ini dibatasi/hak cipta sehingga stream tidak tersedia.");
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
