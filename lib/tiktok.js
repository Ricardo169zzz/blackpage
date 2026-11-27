const https = require("https");
const http = require("http");
const { URLSearchParams } = require("url");

const BASE = "https://ssstik.io";
const UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

const REQUEST_TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 5;

function req(url, opts = {}, body = null, redirectsLeft = MAX_REDIRECTS) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const r = lib.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: opts.method || "GET",
        headers: opts.headers || {},
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) {
            return reject(new Error("Too many redirects"));
          }
          const loc = res.headers.location.startsWith("http")
            ? res.headers.location
            : `https://${u.hostname}${res.headers.location}`;
          return resolve(req(loc, opts, body, redirectsLeft - 1));
        }
        let d = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
      }
    );
    r.on("timeout", () => {
      r.destroy(new Error("Request timeout"));
    });
    r.on("error", reject);
    if (body) r.write(body);
    r.end();
  });
}

async function getToken() {
  const res = await req(`${BASE}/id`, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,*/*;q=0.9",
      "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
      Referer: "https://www.google.com/",
    },
  });
  if (res.status !== 200) throw new Error(`GET /id gagal: HTTP ${res.status}`);

  const tt = (res.body.match(/s_tt\s*=\s*['"]([^'"]+)['"]/) || [])[1] || "";
  const furl = (res.body.match(/s_furl\s*=\s*['"]([^'"]+)['"]/) || [])[1] || "abc";
  const cookie = (res.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");

  return { tt, furl, cookie };
}

async function fetchData(tiktokUrl, { tt, furl, cookie }) {
  const body = new URLSearchParams({ id: tiktokUrl, locale: "id", tt }).toString();

  const res = await req(
    `${BASE}/${furl}?url=dl`,
    {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Content-Length": Buffer.byteLength(body).toString(),
        Accept: "text/html, */*; q=0.01",
        "Accept-Language": "id-ID,id;q=0.9",
        Referer: `${BASE}/id`,
        Origin: BASE,
        "HX-Request": "true",
        "HX-Current-URL": `${BASE}/id`,
        "HX-Target": "target",
        "HX-Trigger": "main_page_text",
        ...(cookie ? { Cookie: cookie } : {}),
      },
    },
    body
  );

  if (res.status !== 200) throw new Error(`POST gagal: HTTP ${res.status}`);
  return res.body;
}

function strip(s) {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function classify(label, href) {
  const l = label.toLowerCase();
  if (/tanpa.?tanda.?air.*(hd|high)|no.?watermark.*(hd|high)/i.test(label)) return "video_hd_no_watermark";
  if (/tanpa.?tanda.?air|no.?watermark/i.test(label)) return "video_no_watermark";
  if (/unduh mp3|mp3|audio|musik|music/i.test(l) || /\.mp3/i.test(href)) return "audio_mp3";
  if (/foto|photo|slide|gambar|image/i.test(l) || /\.(jpe?g|png|webp)(\?|$)/i.test(href)) return "image";
  if (/\bhd\b/i.test(l)) return "video_hd";
  if (/watermark/i.test(l)) return "video_watermark";
  if (/\.mp4/i.test(href)) return "video";
  return "video";
}

function parse(html, url) {
  let status = "unknown";
  if (html.includes("ssssuccess")) status = "success";
  else if (html.includes("ssstterror")) status = "tt_error";
  else if (html.includes("sssinvalidlink")) status = "invalid_link";
  else if (html.includes("sssblockedclient")) status = "blocked";
  else if (html.includes("ssserror")) status = "error";

  const authorM =
    html.match(/class="[^"]*ssr-author[^"]*"[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/i) ||
    html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  const author = authorM ? strip(authorM[1]) : null;

  const titleM =
    html.match(/<p[^>]*class="[^"]*ssr-caption[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
    html.match(/<h2[\s\S]*?<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/i) ||
    html.match(/class="[^"]*maintext[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
  const title = titleM ? strip(titleM[1]) : null;

  const avatarM =
    html.match(/<img[^>]*class="[^"]*ssr-ava[^"]*"[^>]*src="([^"]+)"/i) ||
    html.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*ssr-ava[^"]*"/i);
  const avatar = avatarM ? avatarM[1] : null;

  const thumbM =
    html.match(/class="[^"]*ssr-poster[^"]*"[^>]*style="[^"]*url\(['"]?(https:\/\/[^'")]+)['"]?\)/i) ||
    html.match(/<img[^>]+src="(https:\/\/[^"]+tiktokcdn[^"]+)"/) ||
    html.match(/<img[^>]+src="(https:\/\/[^"]+\.(?:jpe?g|png|webp)[^"]*)"[^>]*class="[^"]*result/i);
  const thumbnail = thumbM ? thumbM[1] : null;

  const downloads = [];
  const seen = new Set();
  const aReg = /<a\s([^>]*href="([^"]+)"[^>]*)>([\s\S]*?)<\/a>/gi;
  let m;

  while ((m = aReg.exec(html)) !== null) {
    const attrs = m[1];
    const href = m[2];
    const label = strip(m[3]);

    if (!href.startsWith("http") || seen.has(href)) continue;

    const isDownload =
      href.includes("/d/") ||
      attrs.includes(" download") ||
      /\.(mp4|mp3|webm|jpe?g|png|webp)(\?|$)/i.test(href) ||
      /tanpa.?tanda|no.?watermark|unduh|download|mp3|mp4|audio|hd|foto|photo|slide|gambar/i.test(label);

    if (!isDownload) continue;
    if (/watch.?ads|fitur.?pro|aplikasi/i.test(label)) continue;

    seen.add(href);
    downloads.push({
      type: classify(label, href),
      label: label || "Download",
      url: href,
      quality: (attrs.match(/data-quality="([^"]+)"/i) || [])[1] || null,
    });
  }

  const musicM =
    html.match(/class="[^"]*music[^"]*"[\s\S]{0,400}?href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i) ||
    html.match(/href="([^"]+\.mp3[^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
  const music = musicM ? { label: strip(musicM[2]), url: musicM[1] } : null;

  const stats = {};
  const sp = {
    likes: /([0-9][0-9.,KMB]*)\s*(?:like|suka)/i,
    views: /([0-9][0-9.,KMB]*)\s*(?:view|tayangan)/i,
    comments: /([0-9][0-9.,KMB]*)\s*(?:comment|komentar)/i,
    shares: /([0-9][0-9.,KMB]*)\s*(?:share|bagikan)/i,
  };
  for (const [k, p] of Object.entries(sp)) {
    const s = html.match(p);
    if (s) stats[k] = s[1];
  }

  if (status === "unknown") status = downloads.length > 0 || title ? "success" : "empty";

  return {
    status,
    url,
    author,
    avatar,
    title,
    thumbnail,
    music,
    downloads,
    stats: Object.keys(stats).length ? stats : null,
  };
}

function isValidTikTokUrl(raw) {
  try {
    const u = new URL(raw);
    return (
      (u.protocol === "https:" || u.protocol === "http:") &&
      /(^|\.)tiktok\.com$/i.test(u.hostname)
    );
  } catch {
    return false;
  }
}

async function fetchTikTok(tiktokUrl) {
  if (!isValidTikTokUrl(tiktokUrl)) {
    const err = new Error("URL TikTok tidak valid");
    err.statusCode = 400;
    throw err;
  }
  const token = await getToken();
  const html = await fetchData(tiktokUrl, token);
  return parse(html, tiktokUrl);
}

module.exports = { fetchTikTok, parse, isValidTikTokUrl };
