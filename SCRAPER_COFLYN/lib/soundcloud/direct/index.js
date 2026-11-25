const axios = require("axios");
const cheerio = require("cheerio");

const DEFAULT_CLIENT_ID = "Hpp4j7peQTPimFlKMjTX3y3mK2946b7y";
let cachedClientId = null;
let lastClientFetch = 0;

async function getSoundcloudClientId() {
  if (cachedClientId && Date.now() - lastClientFetch < 3600000) {
    return cachedClientId;
  }
  try {
    const res = await axios.get("https://soundcloud.com", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      timeout: 8000,
    });
    const $ = cheerio.load(res.data);
    const scriptSrcs = $("script[src]")
      .map((_, el) => $(el).attr("src"))
      .get()
      .filter((s) => s && s.includes("sndcdn.com"));

    for (const src of scriptSrcs.slice(-5)) {
      const sr = await axios.get(src, { timeout: 6000 });
      const match = sr.data?.match(/client_id[:=]["']([a-zA-Z0-9]{32})["']/);
      if (match && match[1]) {
        cachedClientId = match[1];
        lastClientFetch = Date.now();
        return cachedClientId;
      }
    }
  } catch (_) {}

  cachedClientId = DEFAULT_CLIENT_ID;
  return cachedClientId;
}

async function scrape(url) {
  try {
    if (!url || typeof url !== "string") {
      throw new Error("Invalid SoundCloud URL.");
    }
    const cleanUrl = url.trim().split("?")[0];
    const clientId = await getSoundcloudClientId();

    const resolveRes = await axios.get(
      `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(
        cleanUrl,
      )}&client_id=${clientId}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        timeout: 12000,
      },
    );

    const data = resolveRes.data;
    if (!data) throw new Error("Could not resolve SoundCloud track metadata.");

    const title = data.title || "SoundCloud Track";
    const author =
      data.user?.username || data.user?.name || "SoundCloud Artist";
    const thumbnail =
      data.artwork_url ||
      data.user?.avatar_url ||
      "";
    const transcodings = data.media?.transcodings || [];

    const downloads = [];
    const seen = new Set();

    for (const t of transcodings) {
      if (t.url) {
        try {
          const sRes = await axios.get(`${t.url}?client_id=${clientId}`, {
            timeout: 6000,
          });
          const streamUrl = sRes.data?.url;
          if (streamUrl && !seen.has(streamUrl)) {
            seen.add(streamUrl);
            const isHls = t.format?.protocol === "hls";
            const quality = t.preset || (isHls ? "HLS Stream" : "128kbps MP3");
            downloads.push({
              type: "audio",
              quality,
              url: streamUrl,
            });
          }
        } catch (_) {}
      }
    }

    // Fallback stream via soundcloudtomp3download if track is Go+ / transcodings empty
    if (downloads.length === 0) {
      const fallbackUrl = `https://soundcloudtomp3download.com/download.php?sc=${encodeURIComponent(
        cleanUrl,
      )}&title=${encodeURIComponent(title)}&artist=${encodeURIComponent(author)}`;
      downloads.push({
        type: "audio",
        quality: "MP3 (128kbps)",
        url: fallbackUrl,
      });
    }

    return {
      status: true,
      result: {
        title,
        author: { name: author },
        thumbnail,
        type: "audio",
        downloads,
      },
    };
  } catch (error) {
    return {
      status: false,
      message: error.message || "Failed to resolve SoundCloud track.",
    };
  }
}

module.exports = { scrape };
