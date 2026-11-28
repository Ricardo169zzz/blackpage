const https = require("https");
const http = require("http");

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const ANIME_AGENT = new https.Agent({ keepAlive: false, maxSockets: 4 });
const htmlCache = new Map();
const CACHE_TTL_MS = 120 * 1000;

function stripTags(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

const ANIMASU_API = "https://api.nexadev.my.id/animasu";

function isValidOtakudesuUrl(raw) {
  try {
    const u = new URL(raw);
    return (u.protocol === "https:" || u.protocol === "http:") && /(?:otakudesu|animasu)\./i.test(u.hostname);
  } catch {
    return false;
  }
}

function isAnimasuUrl(raw) {
  try {
    return /animasu\./i.test(new URL(raw).hostname);
  } catch {
    return false;
  }
}

async function fetchAnimasu(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${ANIMASU_API}?${qs}`, {
    headers: { "User-Agent": CHROME_UA, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Animasu HTTP ${res.status}`);
  const json = await res.json();
  if (!json?.success || !json?.data) throw new Error(json?.message || "Animasu error");
  return json.data;
}

function mapAnimasuList(list = []) {
  return (Array.isArray(list) ? list : [])
    .map((it) => ({
      title: stripTags(it.title || ""),
      url: it.link || it.url || "",
      thumbnail: it.image || "",
      episode: stripTags(it.latestEpisode || it.type || ""),
      day: it.rating ? `★ ${it.rating}` : stripTags(it.type || ""),
    }))
    .filter((x) => x.url && x.title);
}

function getRawHtml(url, referer = "https://otakudesu.blog/", redirectsLeft = 4) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.get(
      {
        hostname: u.hostname,
        port: u.port || undefined,
        path: u.pathname + u.search,
        family: 4,
        agent: u.protocol === "https:" ? ANIME_AGENT : undefined,
        timeout: 15000,
        headers: {
          "User-Agent": CHROME_UA,
          Referer: referer,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        },
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) return reject(new Error("Too many redirects"));
          const next = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, url).toString();
          return resolve(getRawHtml(next, referer, redirectsLeft - 1));
        }
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            if (res.statusCode === 403) {
              const err = new Error(
                "Otakudesu memblokir IP server cloud/Vercel (HTTP 403). Jalankan server lokal (npm start) lalu arahkan API Base ke IP lokal."
              );
              err.statusCode = 403;
              return reject(err);
            }
            return reject(new Error(`Otakudesu HTTP ${res.statusCode}`));
          }
          resolve(body);
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("Koneksi ke Otakudesu timeout")));
    req.on("error", reject);
  });
}

async function fetchHtml(url, referer = "https://otakudesu.blog/") {
  const cached = htmlCache.get(url);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.html;
  }
  let lastErr;
  for (let i = 0; i < 2; i++) {
    try {
      const html = await getRawHtml(url, referer);
      htmlCache.set(url, { html, at: Date.now() });
      if (htmlCache.size > 40) {
        const firstKey = htmlCache.keys().next().value;
        if (firstKey) htmlCache.delete(firstKey);
      }
      return html;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

function parseDetpost(html) {
  const items = [];
  const blocks = html.split(/<div class=['"]detpost['"]>/i).slice(1);
  for (const block of blocks) {
    const href = block.match(/<a[^>]+href=["'](https?:\/\/[^"']+\/anime\/[^"']+)["']/i)?.[1];
    const title = stripTags(block.match(/<h2[^>]*class=["']jdlflm["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1] || "");
    const thumb = block.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || "";
    const ep = stripTags(block.match(/<div[^>]*class=['"]epz['"][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "");
    const day = stripTags(block.match(/<div[^>]*class=['"]epztipe['"][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "");
    if (href && title) {
      items.push({ title, url: href, thumbnail: thumb, episode: ep, day });
    }
  }
  return items;
}

function parseGenreAnime(html) {
  const items = [];
  const blocks = html.split(/<div class=['"]col-anime['"]>/i).slice(1);
  for (const block of blocks) {
    const href = block.match(/<div[^>]*class=["']col-anime-title["'][^>]*>\s*<a[^>]+href=["']([^"']+)["']/i)?.[1];
    const title = stripTags(block.match(/<div[^>]*class=["']col-anime-title["'][^>]*>\s*<a[^>]+>([\s\S]*?)<\/a>/i)?.[1] || "");
    const thumb = block.match(/<div[^>]*class=["']col-anime-cover["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i)?.[1] || "";
    const eps = stripTags(block.match(/<div[^>]*class=["']col-anime-eps["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "");
    const rating = stripTags(block.match(/<div[^>]*class=["']col-anime-rating["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "");
    if (href && title) {
      items.push({
        title,
        url: href,
        thumbnail: thumb,
        episode: eps,
        day: rating ? `★ ${rating}` : "",
      });
    }
  }
  return items;
}

async function getOngoingAnime(page = 1) {
  const p = Math.max(1, Number(page) || 1);
  try {
    const data = await fetchAnimasu({ ongoing: 1, page: p });
    const items = mapAnimasuList(data.animeList);
    if (items.length) return { status: "success", page: p, items };
  } catch { }
  const url = p === 1 ? "https://otakudesu.blog/ongoing-anime/" : `https://otakudesu.blog/ongoing-anime/page/${p}/`;
  const html = await fetchHtml(url);
  return { status: "success", page: p, items: parseDetpost(html) };
}

async function getAnimeCategory(category = "populer", page = 1) {
  const p = Math.max(1, Number(page) || 1);
  const cat = String(category || "populer").toLowerCase();
  try {
    if (cat === "populer") {
      const data = await fetchAnimasu({ popular: 1, page: p });
      const items = mapAnimasuList(data.animeList);
      if (items.length) return { status: "success", category: cat, page: p, items };
    } else if (cat === "top") {
      const data = await fetchAnimasu({ completed: 1, page: p });
      const items = mapAnimasuList(data.animeList);
      if (items.length) return { status: "success", category: cat, page: p, items };
    } else {
      const data = await fetchAnimasu({ search: cat });
      const items = mapAnimasuList(data.results || data.animeList);
      if (items.length) return { status: "success", category: cat, page: p, items };
    }
  } catch { }
  if (cat === "populer") {
    return getOngoingAnime(p);
  }
  if (cat === "top") {
    const url = p === 1 ? "https://otakudesu.blog/complete-anime/" : `https://otakudesu.blog/complete-anime/page/${p}/`;
    const html = await fetchHtml(url);
    return { status: "success", category: cat, page: p, items: parseDetpost(html) };
  }
  const genreMap = {
    action: "action",
    fantasy: "fantasy",
    romance: "romance",
  };
  const slug = genreMap[cat] || "action";
  const url = p === 1 ? `https://otakudesu.blog/genres/${slug}/` : `https://otakudesu.blog/genres/${slug}/page/${p}/`;
  const html = await fetchHtml(url);
  return { status: "success", category: cat, page: p, items: parseGenreAnime(html) };
}

async function searchAnime(q) {
  const query = String(q || "").trim();
  if (!query || query.length > 150) {
    const err = new Error("Masukkan judul anime untuk mencari");
    err.statusCode = 400;
    throw err;
  }

  try {
    const data = await fetchAnimasu({ search: query });
    const items = mapAnimasuList(data.results || data.animeList);
    return { status: "success", query, items };
  } catch { }

  const html = await fetchHtml(`https://otakudesu.blog/?s=${encodeURIComponent(query)}&post_type=anime`);
  const items = [];
  const ulMatch = html.match(/<ul[^>]*class=["']chivsrc["'][^>]*>([\s\S]*?)<\/ul>/i)?.[1] || "";
  const liBlocks = ulMatch.split(/<li[^>]*>/i).slice(1);
  for (const li of liBlocks) {
    const href = li.match(/<h2[^>]*>\s*<a[^>]+href=["']([^"']+)["']/i)?.[1];
    const title = stripTags(li.match(/<h2[^>]*>\s*<a[^>]+>([\s\S]*?)<\/a>/i)?.[1] || "");
    const thumb = li.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || "";
    const status = stripTags(li.match(/<b>Status<\/b>\s*:\s*([^<]+)/i)?.[1] || "");
    const rating = stripTags(li.match(/<b>Rating<\/b>\s*:\s*([^<]+)/i)?.[1] || "");
    if (href && title) {
      items.push({ title, url: href, thumbnail: thumb, episode: status, day: rating ? `★ ${rating}` : "" });
    }
  }

  return { status: "success", query, items };
}

async function getAnimeDetail(url) {
  if (!isValidOtakudesuUrl(url)) {
    const err = new Error("URL anime tidak valid");
    err.statusCode = 400;
    throw err;
  }

  if (isAnimasuUrl(url)) {
    const d = await fetchAnimasu({ details: url });
    const info = Object.entries(d.info || {})
      .filter(([, v]) => v && v !== "Unknown")
      .map(([k, v]) => `${k}: ${stripTags(v)}`)
      .slice(0, 8);
    const episodes = (Array.isArray(d.episodes) ? d.episodes : [])
      .map((ep) => ({
        title: stripTags(ep.title || `Episode ${ep.episode || ""}`),
        url: ep.episodeUrl || ep.url || "",
      }))
      .filter((ep) => ep.url);
    return {
      status: "success",
      url,
      title: stripTags(d.title || "Anime"),
      thumbnail: d.image || "",
      synopsis: stripTags(d.sinopsis || d.synopsis || ""),
      info,
      episodes,
    };
  }

  const html = await fetchHtml(url);
  const title = stripTags(
    html.match(/<div[^>]*class=["']jdlrx["'][^>]*>[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
      html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
      "Anime"
  ).replace(/\s*Subtitle Indonesia$/i, "");

  const thumbnail =
    html.match(/<div[^>]*class=["']fotoanime["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i)?.[1] ||
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    "";

  const synopsis = stripTags(html.match(/<div[^>]*class=["']sinopc["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "");
  const infoHtml = html.match(/<div[^>]*class=["']infozingle["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
  const info = [];
  for (const m of infoHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const line = stripTags(m[1]);
    if (line) info.push(line);
  }

  const episodes = [];
  const seen = new Set();
  for (const a of html.matchAll(/<a[^>]+href=["'](https?:\/\/[^"']+\/episode\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const epUrl = a[1];
    const epTitle = stripTags(a[2]);
    if (epUrl && epTitle && !seen.has(epUrl)) {
      seen.add(epUrl);
      episodes.push({ title: epTitle, url: epUrl });
    }
  }

  return {
    status: "success",
    url,
    title,
    thumbnail,
    synopsis,
    info: info.slice(0, 8),
    episodes,
  };
}

async function extractDirectMp4(playerUrl) {
  if (!playerUrl) return null;
  try {
    const pHtml = await getRawHtml(playerUrl, "https://otakudesu.blog/");
    let src =
      pHtml.match(/<video[^>]*>[\s\S]*?<source[^>]+src=["']([^"']+)["']/i)?.[1] ||
      pHtml.match(/<video[^>]+src=["']([^"']+)["']/i)?.[1] ||
      pHtml.match(/<source[^>]+src=["']([^"']+)["']/i)?.[1] ||
      pHtml.match(/(?:file|src)\s*:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i)?.[1] ||
      pHtml.match(/https?:\/\/[^"'\s<>]+\.mp4(?:\?[^"'\s<>]*)?/i)?.[0] ||
      pHtml.match(/https?:\/\/[^"'\s<>]*(?:googlevideo\.com\/videoplayback|cdn\.odcloud\.net\/[^"'\s<>]+)/i)?.[0];
    if (src) {
      return src.replace(/&amp;/g, "&");
    }
  } catch {}
  return null;
}

async function getAnimeEpisode(url) {
  if (!isValidOtakudesuUrl(url)) {
    const err = new Error("URL episode tidak valid");
    err.statusCode = 400;
    throw err;
  }

  if (isAnimasuUrl(url)) {
    const d = await fetchAnimasu({ stream: url });
    const downloads = (Array.isArray(d.alternativeLinks) ? d.alternativeLinks : [])
      .map((alt) => ({
        quality: stripTags(alt.quality || alt.label || "Stream"),
        host: stripTags(alt.server || alt.host || "Alt"),
        url: alt.url || alt.link || "",
      }))
      .filter((x) => x.url);
    const rawStream = d.streamUrl || downloads[0]?.url || "";
    const isDirectMp4 = /\.mp4(?:\?|$)/i.test(rawStream) || /(?:googlevideo\.com\/videoplayback|cdn\.odcloud\.net)/i.test(rawStream);
    let extractedMp4 = isDirectMp4 ? rawStream : null;
    if (!extractedMp4 && /blogger\.com\/video\.g/i.test(rawStream)) {
      try {
        const bHtml = await fetch(rawStream, { headers: { "User-Agent": CHROME_UA }, signal: AbortSignal.timeout(10000) }).then((r) => r.text());
        const m = bHtml.match(/https?:\/\/[^"'\s<>&;]*googlevideo\.com\/videoplayback[^"'\s<>]*/i)?.[0];
        if (m) {
          extractedMp4 = m.replace(/&quot;.*$/i, "").replace(/\\u003d/gi, "=").replace(/\\u0026/gi, "&").replace(/\\\//g, "/").replace(/&amp;/g, "&");
        }
      } catch { }
    }
    return {
      status: "success",
      url,
      title: stripTags(d.episodeInfo?.heading || d.episodeInfo?.title || "Episode"),
      streamUrl: extractedMp4,
      embedUrl: !extractedMp4 && rawStream ? rawStream : null,
      prevUrl: null,
      nextUrl: null,
      downloads: downloads.slice(0, 6),
    };
  }

  const html = await fetchHtml(url);
  const title = stripTags(
    html.match(/<h1[^>]*class=["']posttl["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
      html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
      "Episode"
  );

  const iframeUrl = html.match(/<div[^>]*class=["']responsive-embed-stream["'][^>]*>[\s\S]*?<iframe[^>]+src=["']([^"']+)["']/i)?.[1] ||
    html.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1] || "";

  const directMp4 = iframeUrl && !/google|ads/i.test(iframeUrl) ? await extractDirectMp4(iframeUrl) : null;

  const prevUrl = html.match(/<a[^>]+href=["']([^"']+\/episode\/[^"']+)["'][^>]*>\s*(?:Previous|Prev|Sebelumnya)/i)?.[1] || null;
  const nextUrl = html.match(/<a[^>]+href=["']([^"']+\/episode\/[^"']+)["'][^>]*>\s*(?:Next|Selanjutnya)/i)?.[1] || null;

  const downloads = [];
  const dlSection = html.match(/<div[^>]*class=["']download["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
  for (const li of dlSection.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    const quality = stripTags(li[1].match(/<strong[^>]*>([\s\S]*?)<\/strong>/i)?.[1] || "");
    const firstLink = li[1].match(/<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (quality && firstLink) {
      downloads.push({ quality, host: stripTags(firstLink[2]), url: firstLink[1] });
    }
  }

  return {
    status: "success",
    url,
    title,
    streamUrl: directMp4 || null,
    embedUrl: iframeUrl || null,
    prevUrl,
    nextUrl,
    downloads: downloads.slice(0, 6),
  };
}

module.exports = {
  getOngoingAnime,
  getAnimeCategory,
  searchAnime,
  getAnimeDetail,
  getAnimeEpisode,
};
