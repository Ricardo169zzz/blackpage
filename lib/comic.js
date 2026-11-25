// Zero-dependency Komiku comic scraper adapted from SCRAPER_COFLYN/lib/comic/komiku

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`Komiku merespons HTTP ${res.status}`);
  }
  return res.text();
}

async function searchComics(query = "") {
  const cleanQuery = String(query || "").trim();
  const url = cleanQuery
    ? `https://api.komiku.org/?post_type=manga&s=${encodeURIComponent(cleanQuery)}`
    : `https://api.komiku.org/?post_type=manga`;
  const html = await fetchKomikuHtml(url);

  const blocks = html.split(/<div[^>]+class=["'][^"']*\bbge\b[^"']*["'][^>]*>/i).slice(1);
  const results = [];
  const seen = new Set();

  for (const block of blocks) {
    const hrefMatch = block.match(/<div[^>]+class=["'][^"']*\bkan\b[^"']*["'][\s\S]*?<a[^>]+href=["']([^"']+)["']/i)
      || block.match(/<a[^>]+href=["']([^"']*\/manga\/[^"']+)["']/i);
    const titleMatch = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const thumbMatch = block.match(/<img[^>]+(?:data-src|src)=["']([^"']+)["']/i);
    const typeMatch = block.match(/class=["'][^"']*\btpe1_inf\b[^"']*["'][^>]*>[\s\S]*?<b[^>]*>([\s\S]*?)<\/b>/i);
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

  return {
    query: cleanQuery,
    items: results,
  };
}

async function getComicDetail(comicUrl) {
  const cleanUrl = absKomikuUrl(comicUrl);
  if (!cleanUrl || !/komiku\./i.test(cleanUrl)) {
    throw new Error("URL komik Komiku tidak valid.");
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

  // Latest-first is usually rendered on Komiku; reverse so Chapter 1 is at the top or keep order toggleable
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
  const cleanUrl = absKomikuUrl(chapterUrl);
  if (!cleanUrl || !/komiku\./i.test(cleanUrl)) {
    throw new Error("URL chapter Komiku tidak valid.");
  }

  const html = await fetchKomikuHtml(cleanUrl);
  const titleRaw =
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ||
    "Chapter";
  const title = stripTags(titleRaw).replace(/\s*[-|]\s*Komiku.*$/i, "").trim();

  const bacaSection = html.match(/id=["']Baca_Komik["'][\s\S]*?(?:<\/section>|<div[^>]+class=["'][^"']*nxpr)/i)?.[0] || html;
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
