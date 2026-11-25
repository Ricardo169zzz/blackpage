const axios = require("axios");
const cheerio = require("cheerio");

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

let fastdlTokenCache = { exp: "", token: "", timestamp: 0 };

async function getFastDLToken() {
  const now = Date.now();
  if (
    fastdlTokenCache.token &&
    now - fastdlTokenCache.timestamp < 10 * 60 * 1000
  ) {
    return fastdlTokenCache;
  }
  try {
    const res = await axios.get("https://fastdl.to/en", {
      headers: { "User-Agent": CHROME_UA },
      timeout: 8000,
    });
    const html = typeof res?.data === "string" ? res.data : String(res?.data || "");
    const expMatch = html.match(/k_exp\s*=\s*["']([^"']+)["']/);
    const tokenMatch = html.match(/k_token\s*=\s*["']([^"']+)["']/);
    if (expMatch && tokenMatch) {
      fastdlTokenCache = {
        exp: expMatch[1],
        token: tokenMatch[1],
        timestamp: now,
      };
      return fastdlTokenCache;
    }
  } catch (_) {}
  return null;
}

function cleanUrlString(input) {
  if (!input) return null;
  let raw = input.trim().replace(/^["'\\]+|["'\\]+$/g, "");
  if (raw.startsWith("//")) raw = "https:" + raw;
  return raw.startsWith("http") ? raw : null;
}

function checkIsVideo(href, text, title) {
  const upper = (text + " " + title).toUpperCase();
  if (upper.includes("VIDEO") || upper.includes("MP4") || upper.includes("REEL") || upper.includes("ICON-DLVIDEO")) {
    return true;
  }
  if (upper.includes("PHOTO") || upper.includes("IMAGE") || upper.includes("ICON-DLIMAGE")) {
    return false;
  }
  try {
    const match = href.match(/token=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/);
    if (match) {
      const payloadB64 = match[1].split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const decoded = Buffer.from(payloadB64, "base64").toString("utf-8");
      if (/\.(mp4|mov|webm|mkv)(\?|"|$)/i.test(decoded)) return true;
      if (/\.(jpe?g|png|webp)(\?|"|$)/i.test(decoded)) return false;
    }
  } catch (_) {}
  return /\.(mp4|mov|webm)(\?|$)/i.test(href);
}

async function scrape(url) {
  try {
    const cleanUrl = url.trim().split("?")[0];

    // Method 1: FastDL (SnapSave network modern API)
    try {
      const tokenData = await getFastDLToken();
      const payload = new URLSearchParams({
        q: cleanUrl,
        vt: "reel",
        t: "media",
        lang: "en",
        v: "v2",
        ...(tokenData ? { k_exp: tokenData.exp, k_token: tokenData.token } : {}),
      });

      const res = await axios.post(
        "https://fastdl.to/api/ajaxSearch",
        payload.toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "User-Agent": CHROME_UA,
            "X-Requested-With": "XMLHttpRequest",
            Origin: "https://fastdl.to",
            Referer: "https://fastdl.to/en",
          },
          timeout: 12000,
        },
      );

      const raw = res.data;
      const html = typeof raw === "object" ? raw?.data || "" : raw || "";
      if (html) {
        const $ = cheerio.load(html);
        const downloads = [];
        const seen = new Set();
        let thumbnail = "";

        $(".download-box > li, .download-items, .col-sm-4, .card").each((_, item) => {
          const thumb =
            cleanUrlString($(item).find("img").attr("data-src")) ||
            cleanUrlString($(item).find("img").attr("src")) ||
            "";
          if (thumb && !thumbnail) thumbnail = thumb;

          $(item)
            .find("a.abutton, a.btn, a[href*='snapcdn'], a[href*='rapidcdn'], a[href*='cdninstagram'], a[href*='fbcdn'], a[href^='http']")
            .each((_, a) => {
              const href = cleanUrlString($(a).attr("href"));
              if (!href || href.includes("fastdl.to") || href.includes("snapsave.app") || href.includes("play.google.com") || seen.has(href)) {
                return;
              }
              seen.add(href);
              const text = $(a).text().trim();
              const isVideo = checkIsVideo(href, text, $(a).attr("title") || "");
              downloads.push({
                quality: isVideo ? "video" : "photo",
                type: isVideo ? "video" : "photo",
                url: href,
                thumbnail: thumb || undefined,
              });
            });
        });

        if (downloads.length > 0) {
          const title =
            $(".download-items__title, .card-title, .caption, h3")
              .first()
              .text()
              .trim() || "Instagram Media";

          return {
            status: true,
            result: {
              title,
              thumbnail: thumbnail || downloads[0].thumbnail || downloads[0].url,
              type: downloads.some((d) => d.type === "video") ? "video" : "photo",
              downloads,
            },
          };
        }
      } else if (raw?.mess) {
        const cleanMsg = String(raw.mess).replace(/<[^>]+>/g, "").trim();
        return {
          status: false,
          message: cleanMsg || "SnapSave reported an error.",
        };
      }
    } catch (_) {}

    // Method 2: Legacy SnapSave action endpoint fallback
    const headers = {
      "User-Agent": CHROME_UA,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Origin: "https://snapsave.app",
      Referer: "https://snapsave.app/",
    };

    const res = await axios.post(
      "https://snapsave.app/action.php",
      `url=${encodeURIComponent(cleanUrl)}`,
      { headers, timeout: 8000 },
    );

    let htmlContent = "";
    const rawData = res.data;
    if (typeof rawData === "string") {
      try {
        const codeToRun = rawData.replace(/\beval\s*\(\s*function/g, "(function");
        const unpackedScript = (0, eval)(codeToRun);
        const idxDouble = unpackedScript.indexOf('innerHTML = "');
        if (idxDouble !== -1) {
          const start = idxDouble + 'innerHTML = "'.length;
          const end = unpackedScript.lastIndexOf('";');
          if (end > start) {
            htmlContent = (0, eval)('"' + unpackedScript.slice(start, end) + '"');
          }
        }
      } catch (_) {}
    }

    if (htmlContent) {
      const $ = cheerio.load(htmlContent);
      const downloads = [];
      const seen = new Set();

      $("a[href^='http'], a[href*='rapidcdn'], a[href*='snapcdn']").each((_, a) => {
        const href = cleanUrlString($(a).attr("href"));
        if (href && !href.includes("snapsave.app") && !href.includes("play.google.com") && !seen.has(href)) {
          seen.add(href);
          const isPhoto = href.includes("/image");
          downloads.push({
            quality: isPhoto ? "photo" : "HD",
            type: isPhoto ? "photo" : "video",
            url: href,
          });
        }
      });

      if (downloads.length > 0) {
        return {
          status: true,
          result: {
            title: "Instagram Media",
            thumbnail: downloads[0].url,
            type: downloads.some((d) => d.type === "video") ? "video" : "photo",
            downloads,
          },
        };
      }
    }

    throw new Error("No download links found from SnapSave.");
  } catch (err) {
    return {
      status: false,
      message: err.message || "Failed to scrape Instagram via SnapSave.",
    };
  }
}

module.exports = { scrape };
