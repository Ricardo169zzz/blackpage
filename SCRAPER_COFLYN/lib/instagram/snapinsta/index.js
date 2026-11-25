let chromium, stealth;
try {
  chromium = require("playwright-extra").chromium;
  stealth = require("puppeteer-extra-plugin-stealth")();
  chromium.use(stealth);
} catch (e) {
  // Optional: requires playwright-extra + puppeteer-extra-plugin-stealth
}

const fs = require("fs");
const os = require("os");
const cheerio = require("cheerio");

function getSystemExecutable() {
  const platform = os.platform();
  const candidates = [];
  if (platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
    );
  } else if (platform === "win32") {
    candidates.push(
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
    );
  } else {
    candidates.push(
      "/usr/bin/google-chrome",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/google-chrome-stable"
    );
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return undefined;
}

async function scrape(url) {
  if (!chromium) {
    return {
      status: false,
      message:
        "playwright-extra is not installed. Install it with: npm install playwright-extra puppeteer-extra-plugin-stealth",
    };
  }

  let browser;
  try {
    const executablePath = getSystemExecutable();
    browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
      locale: "en-US",
      timezoneId: "America/New_York",
    });

    const page = await context.newPage();

    await page.goto("https://snapinsta.to/", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    try {
      await page.waitForSelector("#s_input", { timeout: 8000 });
    } catch {
      const turnstile = await page.$(
        ".cf-turnstile, iframe[src*='challenges.cloudflare.com']",
      );
      if (turnstile) {
        throw new Error(
          "SnapInsta is currently protected by Cloudflare Turnstile challenge.",
        );
      }
      throw new Error("Timeout waiting for SnapInsta input (#s_input).");
    }

    await page.fill("#s_input", url);

    const submitBtn = "button.btn-default";
    await page.waitForSelector(submitBtn, { timeout: 5000 });
    await page.click(submitBtn);

    let success = false;
    const startTime = Date.now();
    while (Date.now() - startTime < 8000) {
      const turnstile = await page.$(
        ".cf-turnstile, iframe[src*='challenges.cloudflare.com']",
      );
      if (turnstile) {
        throw new Error(
          "SnapInsta is currently protected by Cloudflare Turnstile challenge.",
        );
      }

      const modalClose = await page.$("#closeModalBtn");
      if (modalClose && (await modalClose.isVisible())) {
        await modalClose.click();
      }

      const downloadBtn = await page.$(
        "a.btn-premium, a.btn-download, a[href*='snapcdn']",
      );
      if (downloadBtn && (await downloadBtn.isVisible())) {
        success = true;
        break;
      }

      const errorAlert = await page.$(".alert-danger");
      if (errorAlert && (await errorAlert.isVisible())) {
        const msg = await errorAlert.innerText();
        throw new Error(msg);
      }

      await page.waitForTimeout(600);
    }

    if (!success) {
      throw new Error(
        "Timeout waiting for results (Cloudflare Turnstile challenge active on SnapInsta).",
      );
    }

    const html = await page.content();
    const $ = cheerio.load(html);

    const downloads = [];
    $("a.btn-premium").each((i, el) => {
      const $el = $(el);
      let link = $el.attr("href");
      const text = $el.text().trim();

      if (link) {
        if (link.startsWith("/")) {
          link = "https://snapinsta.to" + link;
        }

        downloads.push({
          url: link,
          type: text.toLowerCase().includes("video") ? "video" : "image",
          text: text,
        });
      }
    });

    $("img").each((i, el) => {
      const src = $(el).attr("src");
      if (
        src &&
        (src.includes("cdn") || src.includes("instagram")) &&
        downloads[i]
      ) {
        downloads[i].thumbnail = src;
      }
    });

    const title = $("h3").first().text().trim() || "Instagram Content";

    await browser.close();

    return {
      status: true,
      result: {
        title,
        downloads,
      },
    };
  } catch (error) {
    if (browser) await browser.close();
    return {
      status: false,
      message: error.message,
    };
  }
}

module.exports = { scrape };
