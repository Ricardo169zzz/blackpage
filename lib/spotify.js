const https = require("https");
const http = require("http");

const SPOTIFY_ENDPOINT = "https://api.nexadev.my.id/api/spotifyplay/";
const SPOTIFY_PLAYLIST_ENDPOINT = "https://api.nexadev.my.id/api/spotifypl/";
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
            reject(new Error("Respons API Spotify tidak valid"));
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("Request timeout")));
    req.on("error", reject);
  });
}

async function resolveSpotifyQuery(q) {
  if (!/^https?:\/\/(open\.)?spotify\.com\//i.test(q)) return q;
  try {
    const meta = await getJson(`https://open.spotify.com/oembed?url=${encodeURIComponent(q)}`);
    if (meta && typeof meta.title === "string" && meta.title.trim()) {
      return meta.title.trim();
    }
  } catch {
    // Fallback to raw query if oEmbed fails
  }
  return q;
}

async function fetchSpotify(query) {
  const rawQ = typeof query === "string" ? query.trim() : "";
  if (!rawQ || rawQ.length > 300) {
    const err = new Error("Masukkan judul lagu atau link Spotify");
    err.statusCode = 400;
    throw err;
  }

  const q = await resolveSpotifyQuery(rawQ);
  const params = new URLSearchParams({ q });
  const raw = await getJson(`${SPOTIFY_ENDPOINT}?${params.toString()}`);

  if (!raw || raw.status !== true || !raw.data?.mp3_url) {
    throw new Error(raw?.message || "Lagu Spotify tidak ditemukan");
  }

  const d = raw.data;
  return {
    status: "success",
    query: q,
    title: d.title || "Spotify Track",
    artist: d.artist || "Unknown Artist",
    album: d.album || null,
    duration: d.duration || null,
    year: d.year || null,
    cover: d.cover || null,
    spotifyUrl: d.spotify_url || null,
    mp3Url: d.mp3_url,
  };
}

function isValidSpotifyPlaylistUrl(raw) {
  try {
    const u = new URL(raw);
    return (
      (u.protocol === "https:" || u.protocol === "http:") &&
      /^(open\.)?spotify\.com$/i.test(u.hostname) &&
      /\/playlist\//i.test(u.pathname)
    );
  } catch {
    return false;
  }
}

async function fetchSpotifyPlaylist(playlistUrl) {
  if (!isValidSpotifyPlaylistUrl(playlistUrl)) {
    const err = new Error("URL Playlist Spotify tidak valid");
    err.statusCode = 400;
    throw err;
  }

  const params = new URLSearchParams({ url: playlistUrl });
  const raw = await getJson(`${SPOTIFY_PLAYLIST_ENDPOINT}?${params.toString()}`);

  const tracks = Array.isArray(raw?.tracks) ? raw.tracks.filter((x) => x && x.title) : [];
  if (!raw || raw.status !== true || !tracks.length) {
    throw new Error(raw?.message || "Playlist Spotify tidak ditemukan");
  }

  return {
    status: "success",
    url: playlistUrl,
    title: raw.data?.title || "Spotify Playlist",
    cover: raw.data?.cover || null,
    tracks: tracks.map((t) => ({
      title: t.title,
      artists: t.artists || "",
      album: t.album || "",
      duration: t.duration || "",
      cover: t.cover || null,
      url: t.url || "",
    })),
  };
}

module.exports = { fetchSpotify, fetchSpotifyPlaylist, isValidSpotifyPlaylistUrl };
