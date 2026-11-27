const crypto = require("crypto");

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1";

function badRequest(msg) {
  const err = new Error(msg);
  err.statusCode = 400;
  return err;
}

function parseUrl(raw) {
  try {
    const u = new URL(String(raw || "").trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u;
  } catch {
    return null;
  }
}

function extractCleanUrl(text) {
  if (!text || typeof text !== "string") return "";
  const match = text.match(/https?:\/\/[^\s]+/i);
  let clean = match ? match[0] : text.trim();
  if (clean && !/^https?:\/\//i.test(clean)) clean = "https://" + clean;
  return clean;
}

function getSetCookies(res) {
  if (typeof res.headers.getSetCookie === "function") {
    return res.headers.getSetCookie();
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function mergeCookies(jar, res) {
  for (const raw of getSetCookies(res)) {
    const part = raw.split(";")[0];
    const eq = part.indexOf("=");
    if (eq > 0) {
      jar[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
    }
  }
}

function formatCookies(jar) {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = 15000) {
  return fetch(url, {
    ...opts,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function resolveRedirectOnce(url, headers = {}, timeoutMs = 10000) {
  try {
    const res = await fetchWithTimeout(url, { headers, redirect: "manual" }, timeoutMs);
    const loc = res.headers.get("location");
    res.body?.cancel?.();
    if (loc) {
      return loc.startsWith("http") ? loc : new URL(loc, url).toString();
    }
  } catch {}
  return url;
}

function normalizeResult(platform, url, data) {
  const authorName =
    typeof data.author === "string"
      ? data.author
      : data.author?.name || platform.toUpperCase();
  const downloads = (data.downloads || []).map((d, i) => ({
    type: d.type || "video",
    quality: d.quality || (d.type === "audio" ? "Audio" : d.type === "image" ? `Photo ${i + 1}` : "HD"),
    url: d.url,
  }));
  return {
    status: "success",
    platform,
    url,
    title: data.title || `${platform.toUpperCase()} Media`,
    author: authorName,
    thumbnail: data.thumbnail || "",
    type: data.type || (downloads.some((d) => d.type === "video") ? "video" : "image"),
    downloads,
  };
}

// ============================================================================
// 1. DOUYIN
// ============================================================================
function extractDouyinItemId(text) {
  if (!text || typeof text !== "string") return null;
  const match =
    text.match(/(?:video|note|share\/(?:video|slides))\b[\/?](\d{15,22})/i) ||
    text.match(/modal_id=(\d{15,22})/i) ||
    text.match(/group_id=(\d{15,22})/i) ||
    text.match(/aweme_id=(\d{15,22})/i) ||
    text.match(/\/(\d{18,20})\b/);
  return match ? match[1] : null;
}

function solveWafChallenge(html) {
  try {
    const csMatch = html.match(/cs\s*=\s*"([^"]+)"/);
    if (!csMatch) return null;
    const c = JSON.parse(Buffer.from(csMatch[1], "base64").toString("utf8"));
    const prefixBuf = Buffer.from(c.v.a, "base64");
    const expectHex = Buffer.from(c.v.c, "base64").toString("hex");
    for (let i = 0; i <= 1000000; i++) {
      const hash = crypto
        .createHash("sha256")
        .update(Buffer.concat([prefixBuf, Buffer.from(String(i))]))
        .digest("hex");
      if (hash === expectHex) {
        c.d = Buffer.from(String(i)).toString("base64");
        return Buffer.from(JSON.stringify(c)).toString("base64");
      }
    }
  } catch {}
  return null;
}

function parseJSObject(slice) {
  let braceCount = 0;
  let inStr = false;
  let strChar = null;
  let escape = false;
  let endIdx = -1;
  for (let i = 0; i < slice.length; i++) {
    const c = slice[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\") {
      escape = true;
      continue;
    }
    if (inStr) {
      if (c === strChar) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      strChar = c;
      continue;
    }
    if (c === "{") braceCount++;
    else if (c === "}") {
      braceCount--;
      if (braceCount === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }
  if (endIdx !== -1) {
    try {
      return JSON.parse(slice.substring(0, endIdx));
    } catch {}
  }
  return null;
}

function extractDouyinRouterData(htmlStr) {
  if (!htmlStr || typeof htmlStr !== "string") return null;
  const markers = [
    "window._ROUTER_DATA =",
    "window._SSR_DATA =",
    "window._RENDER_DATA =",
    "window.__INIT_PROPS__ =",
    "window.SSR_HYDRATED_DATA =",
  ];
  for (const marker of markers) {
    const idx = htmlStr.indexOf(marker);
    if (idx === -1) continue;
    let slice = htmlStr.substring(idx + marker.length).trim();
    if (slice.startsWith('"') && slice.includes("%7B")) {
      try {
        const m = slice.match(/^"([^"]+)"/);
        if (m) slice = decodeURIComponent(m[1]);
      } catch {}
    } else if (slice.startsWith("%7B")) {
      try {
        slice = decodeURIComponent(slice);
      } catch {}
    }
    const data = parseJSObject(slice);
    if (data) return data;
  }
  const scriptMatches = htmlStr.matchAll(/<script[^>]*id="RENDER_DATA"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of scriptMatches) {
    try {
      return JSON.parse(decodeURIComponent(m[1].trim()));
    } catch {}
  }
  return null;
}

function getDouyinItemFromData(data) {
  if (!data) return null;
  const loaderData = data.loaderData || {};
  for (const key of Object.keys(loaderData)) {
    const list = loaderData[key]?.videoInfoRes?.item_list;
    if (Array.isArray(list) && list.length > 0) return list[0];
  }
  if (data.aweme?.detail) return data.aweme.detail;
  if (Array.isArray(data.item_list) && data.item_list.length > 0) return data.item_list[0];
  if (data.aweme_detail) return data.aweme_detail;
  return null;
}

function buildDouyinResult(item) {
  const title = item.desc || item.share_info?.share_desc || "Douyin Content";
  const author = item.author?.nickname || "Douyin User";
  const thumbnail = item.video?.cover?.url_list?.[0] || item.images?.[0]?.url_list?.[0] || "";
  const downloads = [];

  if (Array.isArray(item.images) && item.images.length > 0) {
    item.images.forEach((img, i) => {
      const imgUrl = img.url_list?.[0] || img.download_url_list?.[0];
      if (imgUrl) {
        downloads.push({
          type: "image",
          quality: `Photo ${i + 1}`,
          url: imgUrl.replace(/^http:/, "https:"),
        });
      }
    });
  } else {
    let videoUrl = item.video?.play_addr?.url_list?.[0] || item.video?.download_addr?.url_list?.[0];
    if (videoUrl) {
      videoUrl = videoUrl.replace(/^http:/, "https:").replace("playwm", "play");
      let videoId = null;
      try {
        videoId = new URL(videoUrl).searchParams.get("video_id");
      } catch {}
      if (!videoId) {
        const m = videoUrl.match(/video_id=([^&]+)/);
        if (m) videoId = m[1];
      }
      const noWatermarkUrl = videoId
        ? `https://aweme.snssdk.com/aweme/v1/play/?video_id=${videoId}`
        : videoUrl;
      downloads.push({ type: "video", quality: "HD No Watermark", url: noWatermarkUrl });
      if (videoUrl !== noWatermarkUrl) {
        downloads.push({ type: "video", quality: "Standard", url: videoUrl });
      }
    }
  }

  const musicUrl = item.music?.play_url?.url_list?.[0] || item.music?.play_url?.uri || null;
  if (musicUrl && typeof musicUrl === "string" && musicUrl.startsWith("http")) {
    downloads.push({
      type: "audio",
      quality: "Original Audio",
      url: musicUrl.replace(/^http:/, "https:"),
    });
  }

  if (!downloads.length) {
    throw new Error("Media Douyin tidak ditemukan.");
  }

  return {
    title,
    author,
    thumbnail: thumbnail.replace(/^http:/, "https:"),
    type: item.images?.length ? "image" : "video",
    downloads,
  };
}

async function fetchDouyinOnce(rawUrl) {
  const cleanUrl = extractCleanUrl(rawUrl);
  const cookieJar = {};

  try {
    const regRes = await fetchWithTimeout(
      "https://ttwid.bytedance.com/ttwid/union/register/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": DESKTOP_UA },
        body: JSON.stringify({
          region: "cn",
          aid: 1768,
          needFparam: "0",
          unionHost: "https://ttwid.bytedance.com",
          service: "www.ixigua.com",
          migrate_info: { ticket: "", src: "ucp" },
          cbUrlProtocol: "https",
        }),
      },
      8000
    );
    mergeCookies(cookieJar, regRes);
    regRes.body?.cancel?.();
  } catch {}

  let targetUrl = cleanUrl;
  let itemId = extractDouyinItemId(cleanUrl);

  if (cleanUrl.includes("v.douyin.com")) {
    try {
      const r1 = await fetchWithTimeout(
        cleanUrl,
        {
          headers: {
            "User-Agent": MOBILE_UA,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            Cookie: formatCookies(cookieJar),
          },
          redirect: "manual",
        },
        10000
      );
      mergeCookies(cookieJar, r1);
      const loc = r1.headers.get("location");
      r1.body?.cancel?.();
      if (loc) targetUrl = loc.startsWith("http") ? loc : new URL(loc, cleanUrl).toString();
    } catch {}
  }

  if (!itemId) itemId = extractDouyinItemId(targetUrl);

  const slidesMatch = targetUrl.match(/share\/slides\/([0-9]{15,22})/i);
  if (slidesMatch?.[1]) {
    targetUrl = `https://www.iesdouyin.com/share/video/${slidesMatch[1]}/`;
    itemId = slidesMatch[1];
  }

  const fetchHtml = async (ua, referer = "https://www.douyin.com/") => {
    const r = await fetchWithTimeout(
      targetUrl,
      {
        headers: {
          "User-Agent": ua,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          Cookie: formatCookies(cookieJar),
          Referer: referer,
        },
      },
      15000
    );
    mergeCookies(cookieJar, r);
    return r.text();
  };

  let htmlStr = "";
  try {
    htmlStr = await fetchHtml(MOBILE_UA);
  } catch {}

  if (htmlStr.includes("_wafchallengeid")) {
    const wafToken = solveWafChallenge(htmlStr);
    if (wafToken) {
      cookieJar._wafchallengeid = wafToken;
      try {
        htmlStr = await fetchHtml(MOBILE_UA, targetUrl);
      } catch {}
    }
  }

  if (!itemId) itemId = extractDouyinItemId(targetUrl) || extractDouyinItemId(htmlStr);

  let item = getDouyinItemFromData(extractDouyinRouterData(htmlStr));

  if (!item) {
    try {
      htmlStr = await fetchHtml(MOBILE_UA);
      item = getDouyinItemFromData(extractDouyinRouterData(htmlStr));
    } catch {}
  }

  if (!item && itemId) {
    try {
      const apiRes = await fetchWithTimeout(
        `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${itemId}`,
        {
          headers: {
            "User-Agent": MOBILE_UA,
            Referer: "https://www.iesdouyin.com/",
            Accept: "application/json",
            Cookie: formatCookies(cookieJar),
          },
        },
        10000
      );
      const d = await apiRes.json();
      if (d?.item_list?.length) item = d.item_list[0];
    } catch {}
  }

  if (!item) {
    try {
      const fallbackHtml = await fetchHtml(DESKTOP_UA);
      item = getDouyinItemFromData(extractDouyinRouterData(fallbackHtml));
    } catch {}
  }

  if (!item) {
    throw new Error("Gagal mengambil data video Douyin.");
  }

  return buildDouyinResult(item);
}

async function fetchDouyin(url) {
  const u = parseUrl(url);
  if (!u || !/(^|\.)(douyin|iesdouyin)\.com$/i.test(u.hostname)) {
    throw badRequest("URL Douyin tidak valid.");
  }
  try {
    const data = await fetchDouyinOnce(u.toString());
    return normalizeResult("douyin", u.toString(), data);
  } catch {
    await new Promise((r) => setTimeout(r, 400));
    const data = await fetchDouyinOnce(u.toString());
    return normalizeResult("douyin", u.toString(), data);
  }
}

// ============================================================================
// 2. THREADS
// ============================================================================
function decodeBase64Url(str) {
  try {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    return Buffer.from(base64, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function stripTags(html) {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchThreads(url) {
  const u = parseUrl(url);
  if (!u || !/(^|\.)threads\.(net|com)$/i.test(u.hostname)) {
    throw badRequest("URL Threads tidak valid.");
  }

  let cleanUrl = u.toString().split("?")[0].trim().replace("threads.com", "threads.net");
  const baseHeaders = {
    "User-Agent": DESKTOP_UA,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    Origin: "https://threadster.app",
    Referer: "https://threadster.app/",
  };

  const jar = {};
  const r1 = await fetchWithTimeout("https://threadster.app/", { headers: baseHeaders }, 10000);
  mergeCookies(jar, r1);
  r1.body?.cancel?.();

  const bodyParams = new URLSearchParams({ url: cleanUrl });
  const r2 = await fetchWithTimeout(
    "https://threadster.app/download",
    {
      method: "POST",
      headers: {
        ...baseHeaders,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: formatCookies(jar),
      },
      body: bodyParams.toString(),
    },
    15000
  );
  const html = await r2.text();

  const downloads = [];
  let detectedThumb = "";

  const hrefMatches = html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi);
  for (const m of hrefMatches) {
    const href = m[1].replace(/&amp;/g, "&");
    if (!href.includes("token=") && !href.includes("acxcdn.com")) continue;

    const finalUrl = href.startsWith("http") ? href : `https://threadster.app${href}`;
    let type = href.includes("/image") ? "image" : "video";

    try {
      const token = new URL(finalUrl).searchParams.get("token");
      if (token) {
        const payloadPart = token.split(".")[1];
        const decodedStr = payloadPart ? decodeBase64Url(payloadPart) : null;
        if (decodedStr) {
          const payload = JSON.parse(decodedStr);
          if (payload.url) {
            const lowerUrl = payload.url.toLowerCase();
            if (/\.(jpe?g|png|webp)/.test(lowerUrl) || href.includes("/image")) {
              type = "image";
            } else if (/\.(mp4|m3u8)/.test(lowerUrl) || href.includes("/video")) {
              type = "video";
            }
            if (!detectedThumb && (type === "image" || /\.(jpe?g|webp)/.test(lowerUrl))) {
              detectedThumb = payload.url;
            }
          }
        }
      }
    } catch {}

    if (!downloads.some((d) => d.url === finalUrl)) {
      downloads.push({
        type,
        quality: type === "video" ? "HD Video" : `Photo ${downloads.length + 1}`,
        url: finalUrl,
      });
    }
  }

  if (!downloads.length) {
    const errMatch = html.match(/class="[^"]*(?:error__msg|alert-danger|alert-warning)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    throw new Error(
      stripTags(errMatch?.[1]) || "Media Threads tidak ditemukan. Postingan mungkin private atau hanya teks."
    );
  }

  const capMatch = html.match(/class="[^"]*(?:download__item__caption__text|download__item__caption)[^"]*"[^>]*>([\s\S]*?)<\//i);
  let caption = stripTags(capMatch?.[1]);
  if (/please enter a valid threads link/i.test(caption) || caption.toLowerCase().includes("download")) {
    caption = "";
  }

  const authorFromHtml = html.match(/download__item__user_info[\s\S]{0,200}@([A-Za-z0-9_.-]+)/i)?.[1];
  const authorFromUrl = cleanUrl.match(/threads\.(?:net|com)\/@([A-Za-z0-9_.-]+)/i)?.[1];
  const username = (authorFromHtml || authorFromUrl || "").replace(/·$/, "");

  let title = caption || (username ? `@${username} - Threads Post` : "Threads Media");
  if (title.length > 140) title = title.slice(0, 137) + "...";

  return normalizeResult("threads", cleanUrl, {
    title,
    author: username ? `@${username}` : "Threads",
    thumbnail: detectedThumb || downloads.find((d) => d.type === "image")?.url || "",
    type: downloads.some((d) => d.type === "video") ? "video" : "image",
    downloads,
  });
}

// ============================================================================
// 3. REDDIT
// ============================================================================
async function fetchReddit(url) {
  const u = parseUrl(url);
  if (!u || !/(^|\.)(reddit\.com|redd\.it)$/i.test(u.hostname)) {
    throw badRequest("URL Reddit tidak valid.");
  }

  let targetUrl = u.toString();
  if (targetUrl.includes("/s/") || u.hostname.endsWith("redd.it")) {
    targetUrl = await resolveRedirectOnce(targetUrl, { "User-Agent": MOBILE_UA });
  }

  // 1. Fast Reddit JSON API (returns direct v.redd.it MP4 + thumbnail in <1s)
  try {
    const cleanBase = targetUrl.split("?")[0].replace(/\/+$/, "");
    const jsonRes = await fetchWithTimeout(
      `${cleanBase}.json?raw_json=1`,
      { headers: { "User-Agent": "Blackpage/1.4 (by /u/blackpage_app)" } },
      8000
    );
    if (jsonRes.ok) {
      const json = await jsonRes.json();
      const post = json?.[0]?.data?.children?.[0]?.data;
      const rv = post?.secure_media?.reddit_video || post?.media?.reddit_video;
      if (rv?.fallback_url) {
        const downloads = [
          { type: "video", quality: "HD Video (Fast Stream)", url: rv.fallback_url },
        ];
        const baseMedia = rv.fallback_url.split("/DASH_")[0].split("/CMAF_")[0];
        if (baseMedia && rv.has_audio !== false) {
          downloads.push({
            type: "audio",
            quality: "Audio Track",
            url: `${baseMedia}/CMAF_AUDIO_128.mp4`,
          });
        }
        return normalizeResult("reddit", targetUrl, {
          title: post.title || "Reddit Video",
          author: post.subreddit_name_prefixed || "Reddit",
          thumbnail: /^https?:\/\//.test(post.thumbnail || "") ? post.thumbnail : "",
          type: "video",
          downloads,
        });
      }
    }
  } catch {}

  const rapidUrl = `https://rapidsave.com/info?url=${encodeURIComponent(targetUrl)}`;
  const res = await fetchWithTimeout(
    rapidUrl,
    {
      headers: {
        "User-Agent": DESKTOP_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Referer: "https://rapidsave.com/",
      },
    },
    15000
  );
  const html = await res.text();

  const dlMatch =
    html.match(/class="downloadbutton"[^>]*href="([^"]+)"/i) ||
    html.match(/href="([^"]*sd\.rapidsave\.com\/download\.php[^"]*)"/i) ||
    html.match(/href="([^"]*download[^"]*)"/i);

  if (!dlMatch) {
    if (html.includes("alert-info") && html.includes("Reddit is limiting")) {
      throw new Error("Reddit membatasi akses upstream di RapidSave.");
    }
    throw new Error("Link download video Reddit tidak ditemukan.");
  }

  let title = "Reddit Video";
  const titleMatch =
    html.match(/class="text-center">([^<]+)<\/p>/i) ||
    html.match(/<h2>([\s\S]*?)<\/h2>/i) ||
    html.match(/<strong>([\s\S]*?)<\/strong>/i);

  if (titleMatch?.[1]?.trim()) {
    title = stripTags(titleMatch[1]);
  } else {
    const slugMatch = targetUrl.match(/comments\/[^\/]+\/([^\/\?#]+)/);
    if (slugMatch?.[1]) title = decodeURIComponent(slugMatch[1].replace(/_/g, " "));
  }

  const thumbMatch = html.match(/<img[^>]+src="([^">]*thumbs\.rapidsave\.com[^">]*)"/i);
  const thumbnail = thumbMatch ? thumbMatch[1] : "";
  const videoUrl = dlMatch[1].replace(/&amp;/g, "&");

  const downloads = [];
  let directVideoUrl = null;
  let audioUrl = null;
  try {
    const parsed = new URL(videoUrl);
    const vParam = parsed.searchParams.get("video_url");
    if (vParam && vParam.startsWith("http")) directVideoUrl = vParam;
    const audioParam = parsed.searchParams.get("audio_url");
    if (audioParam && audioParam.startsWith("http")) audioUrl = audioParam;
  } catch {}

  if (directVideoUrl) {
    downloads.push({ type: "video", quality: "HD Video (Fast Stream)", url: directVideoUrl });
  }
  downloads.push({
    type: "video",
    quality: directVideoUrl ? "HD Video (with Audio)" : "HD Video",
    url: videoUrl,
  });
  if (audioUrl) {
    downloads.push({ type: "audio", quality: "Audio Track", url: audioUrl });
  }

  const subMatch = targetUrl.match(/\/r\/([^\/]+)/i);
  return normalizeResult("reddit", targetUrl, {
    title,
    author: subMatch ? `r/${subMatch[1]}` : "Reddit",
    thumbnail,
    type: "video",
    downloads,
  });
}

// ============================================================================
// 4. PIXIV
// ============================================================================
async function fetchPixiv(url) {
  const u = parseUrl(url);
  if (!u || !/(^|\.)pixiv\.net$/i.test(u.hostname)) {
    throw badRequest("URL Pixiv tidak valid.");
  }

  const illustMatch = u.toString().match(/artworks\/(\d+)/) || u.toString().match(/illust_id=(\d+)/);
  if (!illustMatch) throw badRequest("ID karya Pixiv tidak ditemukan di URL.");
  const illustId = illustMatch[1];

  let illustData = null;

  try {
    const r = await fetchWithTimeout(
      `https://www.pixiv.net/ajax/illust/${illustId}?lang=en`,
      { headers: { "User-Agent": DESKTOP_UA, Referer: "https://www.pixiv.net/" } },
      10000
    );
    const json = await r.json();
    if (json && !json.error && json.body) illustData = json.body;
  } catch {}

  if (!illustData) {
    try {
      const r = await fetchWithTimeout(
        `https://www.pixiv.net/en/artworks/${illustId}`,
        { headers: { "User-Agent": DESKTOP_UA, "Accept-Language": "en-US,en;q=0.9" } },
        10000
      );
      const html = await r.text();
      const m =
        html.match(/id="meta-preload-data"\s+content='([^']+)'/i) ||
        html.match(/id="meta-preload-data"\s+content="([^"]+)"/i);
      if (m?.[1]) {
        const preload = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
        if (preload?.illust?.[illustId]) illustData = preload.illust[illustId];
      }
    } catch {}
  }

  if (!illustData) {
    try {
      const r = await fetchWithTimeout(
        `https://embed.pixiv.net/oembed.php?url=https://www.pixiv.net/artworks/${illustId}`,
        { headers: { "User-Agent": DESKTOP_UA } },
        10000
      );
      const d = await r.json();
      if (d?.title) {
        return normalizeResult("pixiv", u.toString(), {
          title: `${d.title} by ${d.author_name || "Pixiv Artist"}`,
          author: d.author_name || "Pixiv Artist",
          thumbnail: d.thumbnail_url || `https://pixiv.re/${illustId}.jpg`,
          type: d.work_type === "ugoira" ? "video" : "image",
          downloads: [{ type: "image", quality: "Original", url: `https://pixiv.re/${illustId}.jpg` }],
        });
      }
    } catch {}
  }

  if (!illustData) {
    throw new Error("Gagal mengambil data artwork Pixiv.");
  }

  const isUgoira = String(illustData.illustType) === "2" || illustData.type === "ugoira";
  const artist = illustData.userName || illustData.userAccount || "Pixiv Artist";
  const title = illustData.title || illustData.illustTitle || "Pixiv Artwork";
  const downloads = [];

  if (isUgoira) {
    downloads.push({ type: "video", quality: "MP4 Animation", url: `https://ugoira.com/api/mp4/${illustId}` });
    downloads.push({ type: "image", quality: "GIF Animation", url: `https://pixiv.re/${illustId}.gif` });
  } else {
    const pageCount = illustData.pageCount || 1;
    const originalUrl = illustData.urls?.original;
    if (originalUrl) {
      for (let i = 0; i < pageCount; i++) {
        downloads.push({
          type: "image",
          quality: pageCount > 1 ? `Page ${i + 1}` : "Original",
          url: originalUrl.replace("_p0", `_p${i}`).replace("i.pximg.net", "i.pixiv.re"),
        });
      }
    } else {
      downloads.push({ type: "image", quality: "Original", url: `https://pixiv.re/${illustId}.jpg` });
    }
  }

  const thumbnail = isUgoira
    ? `https://pixiv.re/${illustId}.gif`
    : (illustData.urls?.regular || illustData.urls?.original || "").replace("i.pximg.net", "i.pixiv.re") ||
      `https://pixiv.re/${illustId}.jpg`;

  return normalizeResult("pixiv", u.toString(), {
    title,
    author: artist,
    thumbnail,
    type: isUgoira ? "video" : "image",
    downloads,
  });
}

// ============================================================================
// 5. BILIBILI
// ============================================================================
async function fetchBilibili(url) {
  const u = parseUrl(url);
  if (!u || !/(^|\.)(bilibili\.(com|tv)|b23\.tv)$/i.test(u.hostname)) {
    throw badRequest("URL Bilibili tidak valid.");
  }

  let cleanUrl = u.toString();
  if (u.hostname.endsWith("b23.tv")) {
    cleanUrl = await resolveRedirectOnce(cleanUrl, { "User-Agent": DESKTOP_UA });
  }

  if (cleanUrl.includes("bilibili.tv")) {
    const urlObj = new URL(cleanUrl);
    const parts = urlObj.pathname.split("/").filter(Boolean);
    let apiInfo = null;
    let title = "Bilibili.tv Video";
    let thumbnail = "";

    const idxVideo = parts.indexOf("video");
    if (idxVideo !== -1 && /^\d+$/.test(parts[idxVideo + 1] || "")) {
      apiInfo = { tipo: "video", id: parts[idxVideo + 1] };
    }
    const idxPlay = parts.indexOf("play");
    if (idxPlay !== -1) {
      const nums = parts.slice(idxPlay + 1).filter((p) => /^\d+$/.test(p));
      if (nums.length > 1) apiInfo = { tipo: "anime", id: nums[1] };
      else if (nums.length === 1) apiInfo = { tipo: "anime", id: null, seasonId: nums[0] };
    }

    if (!apiInfo) throw new Error("ID video/episode Bilibili.tv tidak ditemukan.");

    if (apiInfo.tipo === "anime" && !apiInfo.id && apiInfo.seasonId) {
      try {
        const epRes = await fetchWithTimeout(
          `https://api.bilibili.tv/intl/gateway/web/v2/ogv/play/episodes?season_id=${apiInfo.seasonId}&platform=web&s_locale=en_US`,
          {},
          8000
        );
        const epData = await epRes.json();
        const firstEp = epData?.data?.sections?.[0]?.episodes?.[0];
        if (firstEp) {
          apiInfo.id = firstEp.episode_id || firstEp.ep_id || firstEp.id;
          title = firstEp.title_display || title;
          thumbnail = firstEp.cover || thumbnail;
        }
      } catch {}
    }

    const downloads = [];
    if (apiInfo.tipo === "anime" && (apiInfo.id || apiInfo.seasonId)) {
      const param = apiInfo.id ? `ep_id=${apiInfo.id}` : `season_id=${apiInfo.seasonId}`;
      const v2Res = await fetchWithTimeout(
        `https://api.bilibili.tv/intl/gateway/v2/ogv/playurl?${param}&platform=web&s_locale=en_US`,
        {},
        8000
      );
      const v2Data = await v2Res.json();
      for (const s of v2Data?.data?.video_info?.stream_list || []) {
        const playUrl =
          s.url || s.url_list?.[0]?.url || s.dash_video?.base_url || s.dash_video?.backup_url?.[0];
        if (playUrl) {
          downloads.push({
            type: "video",
            quality:
              s.stream_info?.display_desc ||
              s.stream_info?.description ||
              (s.quality ? `${s.quality}p` : "720p"),
            url: playUrl.replace(/^http:\/\//, "https://"),
          });
        }
      }
    }

    if (!downloads.length) {
      throw new Error("Stream download Bilibili.tv tidak tersedia.");
    }
    return normalizeResult("bilibili", cleanUrl, {
      title,
      author: "Bilibili.tv",
      thumbnail,
      type: "video",
      downloads,
    });
  }

  const bvid = cleanUrl.match(/(BV[a-zA-Z0-9]+)/i)?.[1] || null;
  const aid = cleanUrl.match(/(?:video\/av|[?&]aid=)(\d+)/i)?.[1] || null;
  if (!bvid && !aid) {
    throw badRequest("URL Bilibili harus mengandung ID BV atau AV.");
  }

  const viewUrl = bvid
    ? `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`
    : `https://api.bilibili.com/x/web-interface/view?aid=${aid}`;
  const headers = { Referer: "https://www.bilibili.com/", "User-Agent": "Bilibili/1.0" };

  const viewRes = await (await fetchWithTimeout(viewUrl, { headers }, 8000)).json();
  if (!viewRes || viewRes.code !== 0 || !viewRes.data) {
    throw new Error(viewRes?.message || "Gagal mengambil detail video Bilibili.");
  }

  const data = viewRes.data;
  const cid = data.cid || data.pages?.[0]?.cid;
  const effectiveBvid = data.bvid || bvid;
  if (!cid) throw new Error("CID video Bilibili tidak ditemukan.");

  const playRes = await (
    await fetchWithTimeout(
      `https://api.bilibili.com/x/player/playurl?bvid=${effectiveBvid}&cid=${cid}&qn=64`,
      { headers },
      8000
    )
  ).json();

  const downloads = (playRes?.data?.durl || []).map((item, idx) => ({
    type: "video",
    quality: idx === 0 ? "720p" : `720p Part ${idx + 1}`,
    url: item.url.replace(/^http:\/\//, "https://"),
  }));

  if (!downloads.length) {
    throw new Error("Stream video Bilibili tidak ditemukan.");
  }

  return normalizeResult("bilibili", cleanUrl, {
    title: data.title || "Bilibili Video",
    author: data.owner?.name || "Bilibili Creator",
    thumbnail: (data.pic || "").replace(/^http:\/\//, "https://"),
    type: "video",
    downloads,
  });
}

// ============================================================================
// 6. REDNOTE (XIAOHONGSHU)
// ============================================================================
function isRednoteLandingPage(title, imgUrl) {
  const invalidTitles = ["你的生活兴趣社区", "你访问的页面不见了", "页面不见了", "404 Not Found", "Page Not Found"];
  if (title && invalidTitles.some((t) => title.includes(t))) return true;
  if (imgUrl && (imgUrl.includes("e6214e4fbfae2cf14d634d4296916e8a5eaefdf4") || imgUrl.includes("fe-platform"))) {
    return true;
  }
  return false;
}

function findRednoteNote(state) {
  if (!state) return null;
  if (state.noteData?.data?.noteData) {
    const nd = state.noteData.data.noteData;
    if (nd.title || nd.desc || nd.imageList || nd.video) return nd;
  }
  if (state.note?.noteDetailMap) {
    for (const k of Object.keys(state.note.noteDetailMap)) {
      const item = state.note.noteDetailMap[k]?.note || state.note.noteDetailMap[k];
      if (item && !Array.isArray(item) && (item.title || item.desc || item.imageList || item.video)) {
        return item;
      }
    }
  }
  const cands = [state.noteData?.note, state.noteData, state.note?.firstNote, state.feed?.note, state.firstNote];
  return cands.find((c) => c && !Array.isArray(c) && (c.title || c.desc || c.imageList || c.video)) || null;
}

function extractRednoteFromHtml(htmlStr) {
  if (typeof htmlStr !== "string" || !htmlStr) return null;
  const matchState =
    htmlStr.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]+?\});?<\/script>/) ||
    htmlStr.match(/window\.__INITIAL_DATA__\s*=\s*(\{[\s\S]+?\});?<\/script>/) ||
    htmlStr.match(/__INITIAL_STATE__\s*=\s*(\{[\s\S]+?\});?<\/script>/) ||
    htmlStr.match(/window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]+?\});?<\/script>/);

  if (matchState) {
    try {
      const rawJson = matchState[1].replace(/;\s*$/, "").replace(/:\s*undefined/g, ":null");
      const noteData = findRednoteNote(JSON.parse(rawJson));
      if (noteData) {
        const title = noteData.title || noteData.desc || "RedNote Post";
        const author = noteData.user?.nickname || noteData.user?.nickName || "RedNote Creator";
        let thumbnail = "";
        const downloads = [];

        if (noteData.imageList?.length) {
          const firstImg =
            noteData.imageList[0].urlDefault || noteData.imageList[0].urlOriginal || noteData.imageList[0].url;
          if (firstImg) thumbnail = firstImg.startsWith("//") ? `https:${firstImg}` : firstImg;
        }

        if (!isRednoteLandingPage(title, thumbnail)) {
          if (noteData.video?.media) {
            const streamObj = noteData.video.media.stream || {};
            let videoUrl = null;
            for (const c of ["h264", "h265", "h266", "av1"]) {
              if (Array.isArray(streamObj[c]) && streamObj[c].length) {
                const s = streamObj[c][0];
                videoUrl = s.masterUrl || s.backupUrls?.[0] || s.url;
                if (videoUrl) break;
              }
            }
            if (!videoUrl && noteData.video.media.video) {
              videoUrl = noteData.video.media.video.masterUrl;
            }
            if (videoUrl) {
              if (videoUrl.startsWith("//")) videoUrl = `https:${videoUrl}`;
              downloads.push({ type: "video", quality: "HD Video", url: videoUrl });
            }
          }

          if (noteData.imageList?.length) {
            noteData.imageList.forEach((img, i) => {
              let u = img.urlOriginal || img.urlDefault || img.url;
              if (u) {
                if (u.startsWith("//")) u = `https:${u}`;
                downloads.push({ type: "image", quality: `Photo ${i + 1}`, url: u });
              }
            });
          }

          if (downloads.length) {
            return {
              title,
              author,
              thumbnail: thumbnail || downloads[0].url,
              type: noteData.video ? "video" : "image",
              downloads,
            };
          }
        }
      }
    } catch {}
  }

  const ogTitle =
    htmlStr.match(/<meta\s+(?:property|name)="og:title"\s+content="([^"]+)"/i)?.[1] ||
    htmlStr.match(/<title>([^<]+)<\/title>/i)?.[1] ||
    "";
  let ogImg = htmlStr.match(/<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/i)?.[1] || "";
  if (ogImg.startsWith("//")) ogImg = `https:${ogImg}`;
  const ogVid =
    htmlStr.match(/<meta\s+property="og:video(?::url)?"\s+content="([^"]+)"/i)?.[1] || "";

  if (!isRednoteLandingPage(ogTitle, ogImg) && (ogImg || ogVid)) {
    const downloads = [];
    if (ogVid) {
      downloads.push({
        type: "video",
        quality: "HD Video",
        url: ogVid.startsWith("//") ? `https:${ogVid}` : ogVid,
      });
    }
    if (ogImg) {
      downloads.push({ type: "image", quality: "Photo", url: ogImg });
    }
    if (downloads.length) {
      return {
        title: ogTitle.replace(/ - (?:小红书|RedNote).*/i, "").trim() || "RedNote Post",
        author: "RedNote Creator",
        thumbnail: ogImg || downloads[0].url,
        type: ogVid ? "video" : "image",
        downloads,
      };
    }
  }
  return null;
}

async function fetchRednote(url) {
  const u = parseUrl(url);
  if (!u || !/(^|\.)(xiaohongshu\.com|xhslink\.(com|cn)|rednote\.com)$/i.test(u.hostname)) {
    throw badRequest("URL RedNote / Xiaohongshu tidak valid.");
  }

  let cleanUrl = u.toString();
  let extractedNoteId = null;
  const userAgents = [DESKTOP_UA, MOBILE_UA];

  if (cleanUrl.includes("xhslink.com") || cleanUrl.includes("xhslink.cn")) {
    for (const ua of userAgents) {
      try {
        const res = await fetchWithTimeout(cleanUrl, { headers: { "User-Agent": ua }, redirect: "follow" }, 10000);
        const resHtml = await res.text();
        const extracted = extractRednoteFromHtml(resHtml);
        if (extracted) return normalizeResult("rednote", cleanUrl, extracted);

        const noteMatch = `${res.url || ""} ${resHtml}`.match(/\/([a-f0-9]{24})/i);
        if (noteMatch) extractedNoteId = noteMatch[1];
        if (res.url && !res.url.includes("xhslink.com")) {
          cleanUrl = res.url;
          break;
        }
      } catch {}
    }
  }

  if (!extractedNoteId) {
    const m =
      cleanUrl.match(/\/(?:explore|discovery\/item|red_video)\/([a-f0-9]{24})/i) ||
      cleanUrl.match(/\/([a-f0-9]{24})/i);
    if (m) extractedNoteId = m[1];
  }

  const urlsToTry = [];
  if (!cleanUrl.includes("xhslink.com") && !cleanUrl.includes("xhslink.cn")) {
    urlsToTry.push(cleanUrl);
  }
  if (extractedNoteId) {
    urlsToTry.push(
      `https://www.xiaohongshu.com/discovery/item/${extractedNoteId}`,
      `https://www.xiaohongshu.com/explore/${extractedNoteId}`,
      `https://www.rednote.com/discovery/item/${extractedNoteId}`,
      `https://www.rednote.com/explore/${extractedNoteId}`
    );
  }

  for (const target of urlsToTry) {
    for (const ua of userAgents) {
      try {
        const res = await fetchWithTimeout(
          target,
          {
            headers: {
              "User-Agent": ua,
              Cookie: "a1=18a1234567890abcdef1234567890abc; webId=1234567890abcdef",
              "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            },
            redirect: "follow",
          },
          10000
        );
        const extracted = extractRednoteFromHtml(await res.text());
        if (extracted) return normalizeResult("rednote", cleanUrl, extracted);
      } catch {}
    }
  }

  throw new Error("Postingan RedNote tidak ditemukan atau link kedaluwarsa.");
}

module.exports = {
  fetchDouyin,
  fetchThreads,
  fetchReddit,
  fetchPixiv,
  fetchBilibili,
  fetchRednote,
};
