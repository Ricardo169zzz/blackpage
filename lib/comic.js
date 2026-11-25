// Zero-dependency Comic scraper: Komiku (ID) primary + MangaDex API fallback for datacenter/Vercel IPs
// Adapted from SCRAPER_COFLYN/lib/comic/komiku and SCRAPER_COFLYN/lib/comic/mangadex

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const MD_UA = "blackpage/1.3.0 (https://github.com/Ricardo169zzz/blackpage)";

function stripTags(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function absKomikuUrl(href, base = "https://komiku.org") {
  const val = String(href || "").trim();
  if (!val) return "";
  if (/^https?:\/\//i.test(val)) return val;
  try {
    return new URL(val, base).href;
  } catch {
    return "";
  }
}

async function fetchKomikuHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": CHROME_UA,
      Referer: "https://komiku.org/",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8",
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) {
    throw new Error(`Komiku merespons HTTP ${res.status}`);
  }
  return res.text();
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": MD_UA, Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`MangaDex HTTP ${res.status}`);
  return res.json();
}

function pickMdText(obj = {}) {
  return obj.id || obj.en || obj["ja-ro"] || Object.values(obj)[0] || "";
}

async function searchMangaDex(query = "") {
  const cleanQuery = String(query || "").trim();
  const params = new URLSearchParams({
    limit: "16",
    "includes[]": "cover_art",
    "contentRating[]": "safe",
    hasAvailableChapters: "true",
  });
  params.append("contentRating[]", "suggestive");
  if (cleanQuery) {
    params.set("title", cleanQuery);
  } else {
    params.set("order[followedCount]", "desc");
  }
  const data = await fetchJson(`https://api.mangadex.org/manga?${params.toString()}`);
  const items = (data?.data || []).map((m) => {
    const coverRel = m.relationships?.find((r) => r.type === "cover_art");
    const fileName = coverRel?.attributes?.fileName;
    const thumbnail = fileName ? `https://uploads.mangadex.org/covers/${m.id}/${fileName}.256.jpg` : "";
    return {
      title: pickMdText(m.attributes?.title) || "Manga",
      type: "MangaDex",
      url: `mangadex:${m.id}`,
      thumbnail,
      summary: pickMdText(m.attributes?.description).slice(0, 140),
    };
  });
  return { query: cleanQuery, source: "mangadex", items };
}

async function getMangaDexDetail(mangaId) {
  const [mangaRes, chIdRes] = await Promise.all([
    fetchJson(`https://api.mangadex.org/manga/${mangaId}?includes[]=cover_art`),
    fetchJson(
      `https://api.mangadex.org/chapter?manga=${mangaId}&limit=100&translatedLanguage[]=id&translatedLanguage[]=en&includeExternalUrl=0&order[chapter]=asc`
    ),
  ]);
  const m = mangaRes?.data;
  if (!m) throw new Error("Komik MangaDex tidak ditemukan.");
  const coverRel = m.relationships?.find((r) => r.type === "cover_art");
  const fileName = coverRel?.attributes?.fileName;
  const thumbnail = fileName ? `https://uploads.mangadex.org/covers/${m.id}/${fileName}.512.jpg` : "";

  let allCh = (chIdRes?.data || []).filter(
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
  const idCh = allCh.filter((c) => c.attributes?.translatedLanguage === "id");
  const picked = idCh.length ? idCh : allCh;

  const chapters = picked.map((c) => {
    const num = c.attributes?.chapter ? `Ch. ${c.attributes.chapter}` : "Chapter";
    const sub = c.attributes?.title ? ` — ${c.attributes.title}` : "";
    const lang = (c.attributes?.translatedLanguage || "").toUpperCase();
    return {
      title: `${num}${sub}${lang ? ` [${lang}]` : ""}`,
      url: `mangadex-ch:${c.id}`,
    };
  });

  return {
    title: pickMdText(m.attributes?.title) || "Manga",
    url: `mangadex:${mangaId}`,
    thumbnail,
    synopsis: pickMdText(m.attributes?.description).slice(0, 400),
    chapters,
  };
}

async function getMangaDexChapter(chId) {
  let atHome;
  try {
    atHome = await fetchJson(`https://api.mangadex.org/at-home/server/${chId}`);
  } catch (err) {
    const e = new Error("Chapter ini tidak tersedia di server MangaDex (terhapus/DMCA). Coba chapter atau komik lain.");
    e.statusCode = 404;
    throw e;
  }
  const hash = atHome?.chapter?.hash;
  const dataFiles = Array.isArray(atHome?.chapter?.data) ? atHome.chapter.data : [];
  const saverFiles = Array.isArray(atHome?.chapter?.dataSaver) ? atHome.chapter.dataSaver : [];
  const useSaver = !dataFiles.length && saverFiles.length > 0;
  const files = useSaver ? saverFiles : dataFiles;
  if (!atHome?.baseUrl || !hash || !files.length) {
    throw new Error("Halaman chapter MangaDex tidak tersedia (kemungkinan chapter eksternal).");
  }
  const mode = useSaver ? "data-saver" : "data";
  const pages = files.map((file) => `${atHome.baseUrl}/${mode}/${hash}/${file}`);
  return {
    title: "Chapter",
    url: `mangadex-ch:${chId}`,
    pages,
  };
}

async function searchComics(query = "") {
  const cleanQuery = String(query || "").trim();
  const url = cleanQuery
    ? `https://api.komiku.org/?post_type=manga&s=${encodeURIComponent(cleanQuery)}`
    : `https://api.komiku.org/?post_type=manga`;

  try {
    const html = await fetchKomikuHtml(url);
    const blocks = html.split(/<div[^>]+class=["'][^"']*\bbge\b[^"']*["'][^>]*>/i).slice(1);
    const results = [];
    const seen = new Set();

    for (const block of blocks) {
      const hrefMatch =
        block.match(/<div[^>]+class=["'][^"']*\bkan\b[^"']*["'][\s\S]*?<a[^>]+href=["']([^"']+)["']/i) ||
        block.match(/<a[^>]+href=["']([^"']*\/manga\/[^"']+)["']/i);
      const titleMatch = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
      const thumbMatch = block.match(/<img[^>]+(?:data-src|src)=["']([^"']+)["']/i);
      const typeMatch = block.match(
        /class=["'][^"']*\btpe1_inf\b[^"']*["'][^>]*>[\s\S]*?<b[^>]*>([\s\S]*?)<\/b>/i
      );
      const descMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);

      const comicUrl = absKomikuUrl(hrefMatch?.[1]);
      const title = stripTags(titleMatch?.[1] || "");
      if (!comicUrl || !title || seen.has(comicUrl)) continue;
      seen.add(comicUrl);

      results.push({
        title,
        type: stripTags(typeMatch?.[1] || "Manga") || "Manga",
        url: comicUrl,
        thumbnail: absKomikuUrl(thumbMatch?.[1] || ""),
        summary: stripTags(descMatch?.[1] || "").slice(0, 140),
      });
    }
    if (results.length) {
      return { query: cleanQuery, source: "komiku", items: results };
    }
  } catch {
    // Fallback to MangaDex if Komiku blocks datacenter IP (HTTP 403)
  }

  return searchMangaDex(cleanQuery);
}

async function getComicDetail(comicUrl) {
  const raw = String(comicUrl || "").trim();
  if (raw.startsWith("mangadex:")) {
    return getMangaDexDetail(raw.slice("mangadex:".length));
  }

  const cleanUrl = absKomikuUrl(raw);
  if (!cleanUrl || !/komiku\./i.test(cleanUrl)) {
    throw new Error("URL komik tidak valid.");
  }

  const html = await fetchKomikuHtml(cleanUrl);
  const titleRaw =
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ||
    "Komik";
  const title = stripTags(titleRaw)
    .replace(/\s*[-|]\s*Komiku.*$/i, "")
    .replace(/^Komik\s+/i, "")
    .trim();

  const cover =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/class=["'][^"']*\bims\b[^"']*["'][\s\S]*?<img[^>]+src=["']([^"']+)["']/i)?.[1] ||
    "";

  const synopsis = stripTags(
    html.match(/<p[^>]+class=["'][^"']*\bdesc\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ||
      html.match(/itemprop=["']description["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ||
      ""
  );

  const tableHtml =
    html.match(/id=["']Daftar_Chapter["'][\s\S]*?<\/table>/i)?.[0] ||
    html.match(/class=["'][^"']*judulseries[^"']*["'][\s\S]*?<\/table>/i)?.[0] ||
    html;

  const chapters = [];
  const seen = new Set();
  const linkRe = /<a[^>]+href=["']([^"']*(?:chapter|ch-)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = linkRe.exec(tableHtml)) !== null) {
    const chUrl = absKomikuUrl(m[1], cleanUrl);
    const chTitle = stripTags(m[2]);
    if (!chUrl || !chTitle || seen.has(chUrl)) continue;
    seen.add(chUrl);
    chapters.push({ title: chTitle, url: chUrl });
  }
  chapters.reverse();

  return {
    title,
    url: cleanUrl,
    thumbnail: absKomikuUrl(cover, cleanUrl),
    synopsis,
    chapters,
  };
}

async function getComicChapter(chapterUrl) {
  const raw = String(chapterUrl || "").trim();
  if (raw.startsWith("mangadex-ch:")) {
    return getMangaDexChapter(raw.slice("mangadex-ch:".length));
  }

  const cleanUrl = absKomikuUrl(raw);
  if (!cleanUrl || !/komiku\./i.test(cleanUrl)) {
    throw new Error("URL chapter tidak valid.");
  }

  const html = await fetchKomikuHtml(cleanUrl);
  const titleRaw =
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ||
    "Chapter";
  const title = stripTags(titleRaw).replace(/\s*[-|]\s*Komiku.*$/i, "").trim();

  const bacaSection =
    html.match(/id=["']Baca_Komik["'][\s\S]*?(?:<\/section>|<div[^>]+class=["'][^"']*nxpr)/i)?.[0] || html;
  const pages = [];
  const seen = new Set();
  const imgRe = /<img[^>]+(?:data-src|data-lazy-src|src)=["']([^"']+)["']/gi;
  let m;
  while ((m = imgRe.exec(bacaSection)) !== null) {
    const src = absKomikuUrl(m[1], cleanUrl);
    if (!src || /promosi|\/asset\/img\/opening\.|\.gif(?:\?|$)/i.test(src) || seen.has(src)) continue;
    seen.add(src);
    pages.push(src);
  }

  if (!pages.length) {
    throw new Error("Halaman gambar chapter tidak ditemukan.");
  }

  return {
    title,
    url: cleanUrl,
    pages,
  };
}

module.exports = { searchComics, getComicDetail, getComicChapter };
