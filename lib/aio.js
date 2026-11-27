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

const SC_DEFAULT_CLIENT_ID = "Hpp4j7peQTPimFlKMjTX3y3mK2946b7y";

async function fetchTwitterDirect(targetUrl) {
  const idMatch = targetUrl.match(/status(?:es)?\/(\d+)/i);
  if (!idMatch) throw new Error("URL Twitter/X tidak valid.");
  const res = await fetch(`https://api.fxtwitter.com/status/${idMatch[1]}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(12000),
  });
  const data = await res.json();
  if (data?.code !== 200 || !data?.tweet) {
    throw new Error(data?.message || "Tweet tidak ditemukan.");
  }
  const tw = data.tweet;
  const author = tw.author?.name || tw.author?.screen_name || "Twitter/X";
  const title = (tw.text || "").replace(/https:\/\/t\.co\/\S+/g, "").trim() || `${author}'s Post`;
  const downloads = [];
  for (const v of tw.media?.videos || []) {
    downloads.push({
      type: "video",
      label: `Unduh Video (${v.width ? `${v.width}x${v.height}` : "HD"})`,
      url: v.url,
    });
  }
  (tw.media?.photos || []).forEach((p, idx) => {
    downloads.push({ type: "image", label: `Unduh Foto #${idx + 1}`, url: p.url });
  });
  if (!downloads.length && tw.media?.all?.length) {
    tw.media.all.forEach((m, idx) => {
      downloads.push({
        type: m.type === "photo" ? "image" : "video",
        label: m.type === "photo" ? `Unduh Foto #${idx + 1}` : `Unduh Video #${idx + 1}`,
        url: m.url,
      });
    });
  }
  if (!downloads.length) throw new Error("Tidak ada media pada postingan Twitter/X ini.");
  return {
    status: "success",
    url: targetUrl,
    title: title.slice(0, 140),
    author: tw.author?.screen_name ? `@${tw.author.screen_name}` : author,
    thumbnail: tw.media?.videos?.[0]?.thumbnail_url || tw.media?.photos?.[0]?.url || null,
    downloads,
  };
}

async function fetchSoundCloudDirect(targetUrl) {
  const cleanUrl = targetUrl.trim().split("?")[0];
  const r = await fetch(
    `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(cleanUrl)}&client_id=${SC_DEFAULT_CLIENT_ID}`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(12000),
    }
  );
  if (!r.ok) throw new Error(`SoundCloud HTTP ${r.status}`);
  const data = await r.json();
  if (!data) throw new Error("Track SoundCloud tidak ditemukan.");

  const transcodings = data.media?.transcodings || [];
  const ordered = [
    ...transcodings.filter((t) => t.format?.protocol === "progressive"),
    ...transcodings.filter((t) => t.format?.protocol !== "progressive"),
  ];
  const downloads = [];
  for (const t of ordered) {
    if (!t.url) continue;
    try {
      const sr = await fetch(`${t.url}?client_id=${SC_DEFAULT_CLIENT_ID}`, {
        signal: AbortSignal.timeout(6000),
      });
      const sj = await sr.json();
      if (sj?.url && !downloads.some((d) => d.url === sj.url)) {
        const isHls = t.format?.protocol === "hls";
        downloads.push({
          type: "audio",
          label: isHls ? "Stream Audio (HLS)" : "Unduh MP3 (128kbps)",
          url: sj.url,
        });
      }
    } catch {}
  }
  if (!downloads.length) {
    throw new Error("Stream audio SoundCloud tidak tersedia untuk lagu ini.");
  }
  return {
    status: "success",
    url: targetUrl,
    title: data.title || "SoundCloud Track",
    author: data.user?.username || data.user?.name || "SoundCloud",
    thumbnail: data.artwork_url || data.user?.avatar_url || null,
    downloads,
  };
}

async function fetchAio(targetUrl) {
  if (!isValidHttpUrl(targetUrl)) {
    const err = new Error("URL tidak valid");
    err.statusCode = 400;
    throw err;
  }

  const host = new URL(targetUrl).hostname.toLowerCase();
  if (/(^|\.)(x\.com|twitter\.com)$/i.test(host)) {
    return fetchTwitterDirect(targetUrl);
  }
  if (/(^|\.)soundcloud\.com$/i.test(host)) {
    return fetchSoundCloudDirect(targetUrl);
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
