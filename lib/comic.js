// Zero-dependency Multi-Server Comic Scraper (Indonesian-first + MangaDex fallback)
// Adapted from SCRAPER_COFLYN/lib/comic/*

const https = require("https");

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const MD_UA = "blackpage/1.3.0 (https://github.com/Ricardo169zzz/blackpage)";

const COMIC_SERVERS = [
  { id: "auto", label: "Auto (ID)", lang: "ID" },
  { id: "komikindo", label: "Komikindo", lang: "ID" },
  { id: "bacakomik", label: "Bacakomik", lang: "ID" },
  { id: "komiku", label: "Komiku", lang: "ID" },
  { id: "komikcast", label: "Komikcast", lang: "ID" },
  { id: "kiryuu", label: "Kiryuu", lang: "ID" },
  { id: "manhwaindo", label: "Manhwaindo", lang: "ID" },
  { id: "mangadex", label: "MangaDex", lang: "ID/EN" },
];

function stripTags(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function absUrl(href, base) {
  const val = String(href || "").trim();
  if (!val || val.startsWith("data:")) return "";
  if (/^https?:\/\//i.test(val)) return val;
  if (val.startsWith("//")) return `https:${val}`;
  try {
    return new URL(val, base).href;
  } catch {
    return "";
  }
}

async function fetchHtml(url, referer) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": CHROME_UA,
      Referer: referer,
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8",
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (/just a moment|cf-browser-verification/i.test(text)) {
    throw new Error("Diblokir Cloudflare");
  }
  return text;
}

function getJsonV4(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        family: 4,
        timeout: 15000,
        headers: { "User-Agent": MD_UA, Accept: "application/json" },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`MangaDex HTTP ${res.statusCode}`));
          }
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error("Respons MangaDex tidak valid"));
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("MangaDex timeout")));
    req.on("error", reject);
  });
}

async function fetchJson(url, retriesLeft = 2) {
  try {
    return await getJsonV4(url);
  } catch (err) {
    if (retriesLeft > 0 && !/MangaDex HTTP 4\d\d/.test(err?.message || "")) {
      await new Promise((r) => setTimeout(r, 350));
      return fetchJson(url, retriesLeft - 1);
    }
    throw err;
  }
}

function sliceBetween(html, startRe, endRe) {
  const startMatch = startRe.exec(html);
  if (!startMatch) return "";
  const sub = html.slice(startMatch.index);
  if (!endRe) return sub;
  const endMatch = endRe.exec(sub.slice(startMatch[0].length));
  return endMatch ? sub.slice(0, startMatch[0].length + endMatch.index) : sub.slice(0, 120000);
}

function extractImages(html, baseUrl) {
  const pages = [];
  const seen = new Set();
  const imgRe = /<img[^>]+(?:data-lazy-src|data-src|src)=["']([^"']+)["']/gi;
  let m;
  while ((m = imgRe.exec(html)) !== null) {
    const src = absUrl(m[1], baseUrl);
    if (
      !src ||
      /promosi|\/asset\/img\/opening\.|\.gif(?:\?|$)|avatar|banner|logo|iklan|ads|blogger\.googleusercontent|wp-content\/themes/i.test(
        src
      ) ||
      seen.has(src)
    ) {
      continue;
    }
    seen.add(src);
    pages.push(src);
  }
  return pages;
}

const WP_SERVERS = {
  komikindo: {
    base: "https://komikindo.ch",
    latestUrl: (p = 1) => (p > 1 ? `https://komikindo.ch/komik-terbaru/page/${p}/` : "https://komikindo.ch/komik-terbaru/"),
    searchUrl: (q, p = 1) =>
      p > 1 ? `https://komikindo.ch/page/${p}/?s=${encodeURIComponent(q)}` : `https://komikindo.ch/?s=${encodeURIComponent(q)}`,
    cardSplit: /<div[^>]+class=["'][^"']*\banimepost\b[^"']*["'][^>]*>/i,
    hrefRe: /<a[^>]+href=["']([^"']*\/(?:komik|manga)\/[^"']+)["']/i,
    titleRe:
      /<h4[^>]*>([\s\S]*?)<\/h4>|<div[^>]+class=["'][^"']*\btt\b[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>|title=["']([^"']+)["']/i,
    chapterStart: /id=["']Daftar_Chapter["']|class=["'][^"']*episodelst[^"']*["']/i,
    chapterEnd: /id=["']comments["']|<\/article>/i,
    readerStart: /id=["']chimg-auh["']|id=["']Baca_Komik["']/i,
    readerEnd: /class=["'][^"']*(?:\bnavig\b|\bnextprev\b|\bnxpr\b)|id=["']comments["']|<\/article>/i,
  },
  bacakomik: {
    base: "https://bacakomik.my",
    latestUrl: (p = 1) => (p > 1 ? `https://bacakomik.my/komik-terbaru/page/${p}/` : "https://bacakomik.my/komik-terbaru/"),
    searchUrl: (q, p = 1) =>
      p > 1 ? `https://bacakomik.my/page/${p}/?s=${encodeURIComponent(q)}` : `https://bacakomik.my/?s=${encodeURIComponent(q)}`,
    cardSplit: /<div[^>]+class=["'][^"']*\banimepost\b[^"']*["'][^>]*>/i,
    hrefRe: /<a[^>]+href=["']([^"']*\/(?:komik|manga)\/[^"']+)["']/i,
    titleRe:
      /<h4[^>]*>([\s\S]*?)<\/h4>|<div[^>]+class=["'][^"']*\btt\b[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>|title=["']([^"']+)["']/i,
    chapterStart: /class=["'][^"']*eps_lst[^"']*["']|id=["']chapter_list["']|id=["']Daftar_Chapter["']/i,
    chapterEnd: /id=["']comments["']|class=["'][^"']*komik-lain|<\/article>/i,
    readerStart: /id=["']chimg-auh["']|id=["']Baca_Komik["']|id=["']readerarea["']/i,
    readerEnd: /class=["'][^"']*(?:\bnextprev\b|\bnavig\b)|id=["']comments["']|<\/article>/i,
  },
  komiku: {
    base: "https://komiku.org",
    latestUrl: (p = 1) =>
      p > 1 ? `https://api.komiku.org/manga/page/${p}/?post_type=manga` : "https://api.komiku.org/?post_type=manga",
    searchUrl: (q, p = 1) =>
      p > 1
        ? `https://api.komiku.org/page/${p}/?post_type=manga&s=${encodeURIComponent(q)}`
        : `https://api.komiku.org/?post_type=manga&s=${encodeURIComponent(q)}`,
    cardSplit: /<div[^>]+class=["'][^"']*\bbge\b[^"']*["'][^>]*>/i,
    hrefRe: /<a[^>]+href=["']([^"']*\/manga\/[^"']+)["']/i,
    titleRe: /<h3[^>]*>([\s\S]*?)<\/h3>/i,
    chapterStart: /id=["']Daftar_Chapter["']|class=["'][^"']*judulseries[^"']*["']/i,
    chapterEnd: /<\/table>/i,
    readerStart: /id=["']Baca_Komik["']/i,
    readerEnd: /id=["']Komik_Lain["']|class=["'][^"']*\bnxpr\b|<\/section>/i,
  },
  kiryuu: {
    base: "https://v7.kiryuu.to",
    latestUrl: (p = 1) => (p > 1 ? `https://v7.kiryuu.to/page/${p}/` : "https://v7.kiryuu.to/"),
    searchUrl: (q, p = 1) =>
      p > 1 ? `https://v7.kiryuu.to/page/${p}/?s=${encodeURIComponent(q)}` : `https://v7.kiryuu.to/?s=${encodeURIComponent(q)}`,
    chapterStart: /id=["']chapterlist["']|class=["'][^"']*eplister[^"']*["']|<main\b/i,
    chapterEnd: /id=["']comments["']|<\/main>/i,
    readerStart: /data-image-data|id=["']readerarea["']|<main\b/i,
    readerEnd: /id=["']comments["']|<\/main>/i,
  },
  manhwaindo: {
    base: "https://www.manhwaindo.my",
    latestUrl: (p = 1) => (p > 1 ? `https://www.manhwaindo.my/page/${p}/` : "https://www.manhwaindo.my/"),
    searchUrl: (q, p = 1) =>
      p > 1 ? `https://www.manhwaindo.my/page/${p}/?s=${encodeURIComponent(q)}` : `https://www.manhwaindo.my/?s=${encodeURIComponent(q)}`,
    chapterStart: /class=["'][^"']*eplister[^"']*["']|id=["']chapterlist["']/i,
    chapterEnd: /id=["']comments["']|<\/article>/i,
    readerStart: /id=["']readerarea["']|id=["']content["']/i,
    readerEnd: /class=["'][^"']*\bnextprev\b|id=["']comments["']|<\/article>/i,
  },
  komikcast: {
    base: "https://komikcast.info",
    latestUrl: () => "https://komikcast.info/",
    searchUrl: (q) => `https://komikcast.info/?s=${encodeURIComponent(q)}`,
  },
};

function pickImgAttr(html, base) {
  const raw =
    html.match(/<img[^>]+data-lazy-src=["']([^"']+)["']/i)?.[1] ||
    html.match(/<img[^>]+data-src=["']([^"']+)["']/i)?.[1] ||
    html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ||
    "";
  return absUrl(raw, base);
}

function parseWpCards(html, cfg, serverId) {
  if (!cfg.cardSplit) {
    // Generic card extractor for Kiryuu / Manhwaindo
    const items = [];
    const seen = new Set();
    const linkRe = /<a[^>]+href=["'](https?:\/\/[^"']*\/(?:manga|series)\/[^"'#?]+\/?)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = linkRe.exec(html)) !== null) {
      const href = absUrl(m[1], cfg.base);
      if (!href || seen.has(href)) continue;
      const windowHtml = html.slice(Math.max(0, m.index - 200), m.index + m[0].length + 450);
      const titleAttr = m[0].match(/title=["']([^"']+)["']/i)?.[1];
      const hTitle = m[2].match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1] || m[2];
      const title = stripTags(titleAttr || hTitle).replace(/^Komik\s+/i, "").trim();
      const thumb = pickImgAttr(windowHtml, cfg.base);
      if (!title || title.length < 2 || /chapter|bookmark|home|daftar/i.test(title)) continue;
      seen.add(href);
      items.push({
        title,
        type: serverId.toUpperCase(),
        server: serverId,
        referer: `${cfg.base}/`,
        url: href,
        thumbnail: thumb,
      });
      if (items.length >= 20) break;
    }
    return items;
  }

  const blocks = html.split(cfg.cardSplit).slice(1);
  const items = [];
  const seen = new Set();

  for (const block of blocks) {
    const href = absUrl(block.match(cfg.hrefRe)?.[1], cfg.base);
    const tm = block.match(cfg.titleRe);
    const rawTitle = tm?.[1] || tm?.[2] || tm?.[3] || "";
    const title = stripTags(rawTitle).replace(/^Komik\s+/i, "").trim();
    const thumb = pickImgAttr(block, cfg.base);
    const chLabel = stripTags(
      block.match(/class=["'][^"']*(?:\bepxs\b|\blchx\b|\bchapter\b)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|a)>/i)?.[1] ||
        ""
    );

    if (!href || !title || seen.has(href)) continue;
    seen.add(href);
    items.push({
      title,
      type: chLabel || serverId.toUpperCase(),
      server: serverId,
      referer: `${cfg.base}/`,
      url: href,
      thumbnail: thumb,
    });
    if (items.length >= 20) break;
  }
  return items;
}

async function searchWpServer(serverId, query, page = 1) {
  const cfg = WP_SERVERS[serverId];
  if (!cfg) throw new Error("Server tidak dikenal");
  const p = Math.max(1, Number(page) || 1);
  const url = query && serverId !== "komikcast" ? cfg.searchUrl(query, p) : cfg.latestUrl(p);
  const html = await fetchHtml(url, `${cfg.base}/`);

  if (serverId === "komikcast") {
    const dp = html.match(/id=["']app["'][^>]*data-page=["']([^"']+)["']/i)?.[1];
    if (dp) {
      try {
        const pageData = JSON.parse(dp.replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
        const combined = [
          ...(pageData?.props?.latestUpdates || []),
          ...(pageData?.props?.latestMangaUpdates || []),
          ...(pageData?.props?.popularManga || []),
        ];
        const seenSlug = new Set();
        const items = [];
        for (const m of combined) {
          const slug = m.slug || "";
          if (!slug || seenSlug.has(slug)) continue;
          seenSlug.add(slug);
          const title = m.title || m.name || "Komik";
          if (query && !title.toLowerCase().includes(query.toLowerCase())) continue;
          items.push({
            title,
            type: m.type || "Komikcast",
            server: "komikcast",
            url: absUrl(`/manga/${slug}`, cfg.base),
            thumbnail: absUrl(m.poster || m.cover || "", cfg.base),
          });
        }
        return { query, source: "komikcast", page: p, items: items.slice(0, 20) };
      } catch {}
    }
  }

  const items = parseWpCards(html, cfg, serverId).slice(0, 20);
  return { query, source: serverId, page: p, items };
}

function detectWpServerByUrl(targetUrl) {
  for (const [id, cfg] of Object.entries(WP_SERVERS)) {
    const host = new URL(cfg.base).hostname.replace(/^www\./, "");
    if (targetUrl.includes(host)) return [id, cfg];
  }
  return null;
}

async function getWpDetail(serverId, cfg, comicUrl) {
  const html = await fetchHtml(comicUrl, `${cfg.base}/`);

  if (serverId === "komikcast") {
    const dp = html.match(/id=["']app["'][^>]*data-page=["']([^"']+)["']/i)?.[1];
    if (dp) {
      try {
        const page = JSON.parse(dp.replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
        const manga = page?.props?.manga || {};
        const chs = page?.props?.chapters || manga?.chapters || [];
        if (manga.title && Array.isArray(chs) && chs.length) {
          return {
            title: manga.title,
            url: comicUrl,
            source: "komikcast",
            thumbnail: absUrl(manga.poster || "", cfg.base),
            synopsis: stripTags(manga.synopsis || "").slice(0, 400),
            chapters: chs.map((c) => ({
              title: c.title || `Chapter ${c.chapter_number || ""}`,
              url: absUrl(c.slug ? `/manga/${manga.slug}/chapter/${c.slug}` : c.url || "", cfg.base),
            })),
          };
        }
      } catch {}
    }
  }

  const titleRaw =
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ||
    "Komik";
  const title = stripTags(titleRaw)
    .replace(/\s*[-|—]\s*(?:Komik|Komiku|KomikIndo|BacaKomik|Kiryuu|ManhwaIndo|Komikcast).*$/i, "")
    .replace(/^Komik\s+/i, "")
    .trim();

  const cover = absUrl(
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/class=["'][^"']*(?:\bthumb\b|\bims\b)[^"']*["'][\s\S]*?<img[^>]+src=["']([^"']+)["']/i)?.[1] ||
      "",
    comicUrl
  );

  const synopsis = stripTags(
    html.match(/<p[^>]+class=["'][^"']*\bdesc\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ||
      html.match(/itemprop=["']description["'][^>]*>([\s\S]*?)<\/(?:div|p)>/i)?.[1] ||
      ""
  ).slice(0, 400);

  const tableHtml = (cfg.chapterStart && sliceBetween(html, cfg.chapterStart, cfg.chapterEnd)) || html;
  const chapters = [];
  const seen = new Set();
  const linkRe = /<a[^>]+href=["']([^"']*(?:chapter|ch-)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = linkRe.exec(tableHtml)) !== null) {
    const chUrl = absUrl(m[1], comicUrl);
    const chTitle = stripTags(m[2]);
    if (!chUrl || !chTitle || /chapter\s+awal|chapter\s+terbaru/i.test(chTitle) || seen.has(chUrl)) continue;
    seen.add(chUrl);
    chapters.push({ title: chTitle, url: chUrl });
  }
  chapters.reverse();

  return { title, url: comicUrl, source: serverId, referer: `${cfg.base}/`, thumbnail: cover, synopsis, chapters };
}

async function getWpChapter(serverId, cfg, chapterUrl) {
  const html = await fetchHtml(chapterUrl, `${cfg.base}/`);

  if (serverId === "komikcast") {
    const dp = html.match(/id=["']app["'][^>]*data-page=["']([^"']+)["']/i)?.[1];
    if (dp) {
      try {
        const page = JSON.parse(dp.replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
        const imgs = page?.props?.chapter?.images || [];
        if (imgs.length) {
          return {
            title: page?.props?.chapter?.title || "Chapter",
            url: chapterUrl,
            pages: imgs.map((img) => img.r2_url || img.image_path).filter(Boolean),
          };
        }
      } catch {}
    }
  }

  const titleRaw =
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ||
    "Chapter";
  const title = stripTags(titleRaw)
    .replace(/\s*[-|—]\s*(?:Komik|Komiku|KomikIndo|BacaKomik|Kiryuu|ManhwaIndo|Komikcast).*$/i, "")
    .trim();

  let pages = [];
  if (serverId === "manhwaindo") {
    const uploaded = [];
    const upRe = /<img[^>]+alt=["']uploaded image["'][^>]+(?:data-src|src)=["']([^"']+)["']/gi;
    let m;
    while ((m = upRe.exec(html)) !== null) {
      const s = absUrl(m[1], chapterUrl);
      if (s && !uploaded.includes(s)) uploaded.push(s);
    }
    if (uploaded.length) pages = uploaded;
  }

  if (!pages.length) {
    const readerHtml = (cfg.readerStart && sliceBetween(html, cfg.readerStart, cfg.readerEnd)) || html;
    pages = extractImages(readerHtml, chapterUrl);
  }
  if (!pages.length) {
    throw new Error("Halaman gambar chapter tidak ditemukan.");
  }

  return { title, url: chapterUrl, source: serverId, referer: `${cfg.base}/`, pages };
}

// --- MangaDex (Global + ID/EN prioritized) ---
function pickMdText(obj = {}, lang = "id") {
  if (lang === "en") {
    return obj.en || obj.id || obj["ja-ro"] || Object.values(obj)[0] || "";
  }
  return obj.id || obj.en || obj["ja-ro"] || Object.values(obj)[0] || "";
}

async function searchMangaDex(query = "", page = 1, lang = "id") {
  const cleanQuery = String(query || "").trim();
  const p = Math.max(1, Number(page) || 1);
  const prefLang = lang === "en" ? "en" : "id";
  const params = new URLSearchParams({
    limit: "20",
    offset: String((p - 1) * 20),
    "includes[]": "cover_art",
    "contentRating[]": "safe",
  });
  params.append("contentRating[]", "suggestive");
  if (cleanQuery) {
    params.set("title", cleanQuery);
  } else {
    params.set("hasAvailableChapters", "true");
    params.set("availableTranslatedLanguage[]", prefLang);
    params.set("order[latestUploadedChapter]", "desc");
  }
  const data = await fetchJson(`https://api.mangadex.org/manga?${params.toString()}`);
  const items = (data?.data || []).map((m) => {
    const coverRel = m.relationships?.find((r) => r.type === "cover_art");
    const fileName = coverRel?.attributes?.fileName;
    const thumbnail = fileName ? `https://uploads.mangadex.org/covers/${m.id}/${fileName}.256.jpg` : "";
    return {
      title: pickMdText(m.attributes?.title, prefLang) || "Manga",
      type: "MANGADEX",
      server: "mangadex",
      url: `mangadex:${m.id}`,
      thumbnail,
    };
  });
  return { query: cleanQuery, source: "mangadex", page: p, hasNext: items.length >= 20, items };
}

async function getMangaDexDetail(mangaId, lang = "id") {
  const prefLang = lang === "en" ? "en" : "id";
  const [mangaRes, chPrefRes] = await Promise.all([
    fetchJson(`https://api.mangadex.org/manga/${mangaId}?includes[]=cover_art`),
    fetchJson(
      `https://api.mangadex.org/chapter?manga=${mangaId}&limit=100&translatedLanguage[]=${prefLang}&includeExternalUrl=0&order[chapter]=asc`
    ),
  ]);
  const m = mangaRes?.data;
  if (!m) throw new Error("Komik MangaDex tidak ditemukan.");
  const coverRel = m.relationships?.find((r) => r.type === "cover_art");
  const fileName = coverRel?.attributes?.fileName;
  const thumbnail = fileName ? `https://uploads.mangadex.org/covers/${m.id}/${fileName}.512.jpg` : "";

  let allCh = (chPrefRes?.data || []).filter(
    (c) => !c.attributes?.externalUrl && Number(c.attributes?.pages ?? 1) > 0
  );
  if (!allCh.length) {
    const anyRes = await fetchJson(
      `https://api.mangadex.org/chapter?manga=${mangaId}&limit=100&includeExternalUrl=0&order[chapter]=asc`
    );
    allCh = (anyRes?.data || []).filter(
      (c) => !c.attributes?.externalUrl && Number(c.attributes?.pages ?? 1) > 0
    );
  }
  const prefCh = allCh.filter((c) => c.attributes?.translatedLanguage === prefLang);
  const picked = prefCh.length ? prefCh : allCh;

  const chapters = picked.map((c) => {
    const num = c.attributes?.chapter ? `Ch. ${c.attributes.chapter}` : "Chapter";
    const sub = c.attributes?.title ? ` — ${c.attributes.title}` : "";
    const chLang = (c.attributes?.translatedLanguage || "").toUpperCase();
    return {
      title: `${num}${sub}${chLang ? ` [${chLang}]` : ""}`,
      url: `mangadex-ch:${c.id}`,
    };
  });

  return {
    title: pickMdText(m.attributes?.title, prefLang) || "Manga",
    url: `mangadex:${mangaId}`,
    source: "mangadex",
    thumbnail,
    synopsis: pickMdText(m.attributes?.description, prefLang).slice(0, 400),
    chapters,
  };
}

async function getMangaDexChapter(chId) {
  let atHome;
  try {
    atHome = await fetchJson(`https://api.mangadex.org/at-home/server/${chId}`);
  } catch {
    const e = new Error("Chapter ini tidak tersedia di server MangaDex (terhapus/DMCA). Coba chapter atau server lain.");
    e.statusCode = 404;
    throw e;
  }
  const hash = atHome?.chapter?.hash;
  const dataFiles = Array.isArray(atHome?.chapter?.data) ? atHome.chapter.data : [];
  const saverFiles = Array.isArray(atHome?.chapter?.dataSaver) ? atHome.chapter.dataSaver : [];
  const useSaver = !dataFiles.length && saverFiles.length > 0;
  const files = useSaver ? saverFiles : dataFiles;
  if (!atHome?.baseUrl || !hash || !files.length) {
    throw new Error("Halaman chapter MangaDex tidak tersedia.");
  }
  const mode = useSaver ? "data-saver" : "data";
  return {
    title: "Chapter",
    url: `mangadex-ch:${chId}`,
    source: "mangadex",
    referer: "https://mangadex.org/",
    pages: files.map((file) => `${atHome.baseUrl}/${mode}/${hash}/${file}`),
  };
}

// --- Public API ---
async function searchComics(query = "", server = "auto", page = 1, lang = "id") {
  const cleanQuery = String(query || "").trim();
  const target = String(server || "auto").toLowerCase();
  const p = Math.max(1, Number(page) || 1);

  if (target === "mangadex") {
    return searchMangaDex(cleanQuery, p, lang);
  }
  if (WP_SERVERS[target]) {
    const res = await searchWpServer(target, cleanQuery, p);
    return { ...res, hasNext: res.items.length >= 20 };
  }

  // Auto: query ALL servers in parallel and combine results (Indonesian servers first, then MangaDex)
  const wpIds = ["komikindo", "bacakomik", "komiku", "kiryuu", "manhwaindo", "komikcast"];
  const serverPage = cleanQuery ? 1 : p;
  const tasks = [
    ...wpIds.map((id) => searchWpServer(id, cleanQuery, serverPage)),
    searchMangaDex(cleanQuery, serverPage, lang),
  ];
  const settled = await Promise.allSettled(tasks);

  const merged = [];
  const seenUrls = new Set();
  const activeSources = [];

  for (const r of settled) {
    if (r.status !== "fulfilled" || !r.value?.items?.length) continue;
    if (r.value.source && !activeSources.includes(r.value.source)) {
      activeSources.push(r.value.source);
    }
    for (const item of r.value.items) {
      if (!item.url || seenUrls.has(item.url)) continue;
      seenUrls.add(item.url);
      merged.push({
        ...item,
        type: (item.server || r.value.source || "KOMIK").toUpperCase(),
      });
    }
  }

  if (cleanQuery) {
    const start = (p - 1) * 20;
    const paged = merged.slice(start, start + 20);
    return {
      query: cleanQuery,
      source: activeSources.length ? `${activeSources.length} SERVER` : "AUTO",
      page: p,
      hasNext: merged.length > start + 20,
      items: paged,
    };
  }

  return {
    query: cleanQuery,
    source: activeSources.length ? `${activeSources.length} SERVER` : "AUTO",
    page: p,
    hasNext: merged.length >= 20,
    items: merged.slice(0, 20),
  };
}

async function getComicDetail(comicUrl, lang = "id") {
  const raw = String(comicUrl || "").trim();
  if (raw.startsWith("mangadex:")) {
    return getMangaDexDetail(raw.slice("mangadex:".length), lang);
  }
  const match = detectWpServerByUrl(raw);
  if (!match) throw new Error("URL komik tidak valid atau server belum didukung.");
  return getWpDetail(match[0], match[1], raw);
}

async function getComicChapter(chapterUrl) {
  const raw = String(chapterUrl || "").trim();
  if (raw.startsWith("mangadex-ch:")) {
    return getMangaDexChapter(raw.slice("mangadex-ch:".length));
  }
  const match = detectWpServerByUrl(raw);
  if (!match) throw new Error("URL chapter tidak valid atau server belum didukung.");
  return getWpChapter(match[0], match[1], raw);
}

module.exports = { COMIC_SERVERS, searchComics, getComicDetail, getComicChapter };
