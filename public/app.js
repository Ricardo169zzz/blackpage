import { downloadMediaFile, renderProgressHtml } from "./tools/download.js";

const API_BASE_KEY = "tools_op_api_base_v1";
const TT_HISTORY_KEY = "tools_op_tiktok_history_v1";
const THEME_KEY = "tools_op_theme_v1";
const PREFS_KEY = "tools_op_prefs_v1";
const APP_VERSION = "1.3.0";
const GITHUB_REPO = "Ricardo169zzz/blackpage";

const DEFAULT_PREFS = {
  autoPaste: false,
  autoAnalyze: true,
  keepAwake: false,
  autoUpdate: true,
  reduceMotion: false,
  autoSaveGallery: true,
};

export function getPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function savePrefs(next) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(next));
}

let wakeLockSentinel = null;
async function syncWakeLock() {
  const { keepAwake } = getPrefs();
  if (!("wakeLock" in navigator)) return;
  if (keepAwake && document.visibilityState === "visible") {
    if (!wakeLockSentinel) {
      try {
        wakeLockSentinel = await navigator.wakeLock.request("screen");
        wakeLockSentinel.addEventListener("release", () => {
          wakeLockSentinel = null;
        });
      } catch {
        // Ignored when battery saver or browser blocks wake lock
      }
    }
  } else if (!keepAwake && wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
    } catch {
      // Ignore
    }
    wakeLockSentinel = null;
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") syncWakeLock();
});
syncWakeLock();

const systemDarkMq = window.matchMedia("(prefers-color-scheme: dark)");

function getThemeMode() {
  return localStorage.getItem(THEME_KEY) || "auto";
}

function applyTheme(mode = getThemeMode()) {
  const resolved = mode === "auto" ? (systemDarkMq.matches ? "dark" : "light") : mode;
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "dark" ? "#121214" : "#F4F1EA");
}

systemDarkMq.addEventListener("change", () => {
  if (getThemeMode() === "auto") applyTheme("auto");
});
applyTheme();

export function getApiBase() {
  return window.TOOLS_OP_API_BASE || localStorage.getItem(API_BASE_KEY) || "";
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

import { tiktokTool } from "./tools/tiktok.js";
import { youtubeTool } from "./tools/youtube.js";
import { spotifyTool } from "./tools/spotify.js";
import { instagramTool } from "./tools/instagram.js";
import { facebookTool } from "./tools/facebook.js";
import { capcutTool } from "./tools/capcut.js";
import { pinterestTool } from "./tools/pinterest.js";
import { bratTool } from "./tools/brat.js";
import { wmp1Tool } from "./tools/wmp1.js";
import { ttsTool } from "./tools/tts.js";
import { mountComicReader } from "./tools/comic.js";
import { renderUniversalBoxHtml, initUniversalBox } from "./tools/universal.js";

const LANG_KEY = "tools_op_lang_v1";

const I18N = {
  id: {
    nav_home: "Utama",
    nav_tools: "Tools",
    nav_gallery: "Galeri",
    nav_settings: "Setting",
    settings_title: "Setting",
    settings_desc: "Pilih kategori pengaturan.",
    back_settings: "← Kembali ke Setting",
    back_home: "← Halaman Utama",
    back_tools: "← Kembali ke Tools",
    lang_label: "BAHASA",
    pref_auto_paste: "Tempel Otomatis",
    pref_auto_paste_sub: "Tempel link dari clipboard saat buka tool",
    pref_auto_analyze: "Analisis Otomatis",
    pref_auto_analyze_sub: "Langsung proses video setelah link ditempel",
    pref_keep_awake: "Layar Tetap Menyala",
    pref_keep_awake_sub: "Cegah layar mati saat aplikasi terbuka",
    pref_auto_update: "Cek Update Otomatis",
    pref_auto_update_sub: "Periksa versi terbaru saat aplikasi dibuka",
  },
  en: {
    nav_home: "Home",
    nav_tools: "Tools",
    nav_gallery: "Gallery",
    nav_settings: "Settings",
    settings_title: "Settings",
    settings_desc: "Choose a settings category.",
    back_settings: "← Back to Settings",
    back_home: "← Home",
    back_tools: "← Back to Tools",
    lang_label: "LANGUAGE",
    pref_auto_paste: "Auto Paste",
    pref_auto_paste_sub: "Paste link from clipboard when opening a tool",
    pref_auto_analyze: "Auto Analyze",
    pref_auto_analyze_sub: "Automatically fetch video after pasting link",
    pref_keep_awake: "Keep Screen On",
    pref_keep_awake_sub: "Prevent screen from sleeping while app is open",
    pref_auto_update: "Auto Check Updates",
    pref_auto_update_sub: "Check for latest version on startup",
  },
};

function getLang() {
  const saved = localStorage.getItem(LANG_KEY);
  return saved === "en" ? "en" : "id";
}

function t(key) {
  const lang = getLang();
  return I18N[lang]?.[key] || I18N.id[key] || key;
}

const TIKTOK_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.74a4.85 4.85 0 0 1-1.01-.05z"/></svg>`;
const YOUTUBE_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg>`;
const SPOTIFY_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.52 17.34c-.24.36-.66.48-1.02.24-2.82-1.74-6.36-2.1-10.56-1.14-.42.12-.78-.18-.9-.54-.12-.42.18-.78.54-.9 4.56-1.02 8.52-.6 11.64 1.32.42.18.48.66.3 1.02zm1.44-3.3c-.3.42-.84.6-1.26.3-3.24-1.98-8.16-2.58-11.94-1.38-.48.12-.99-.12-1.14-.6-.12-.48.12-.99.6-1.14 4.38-1.32 9.78-.66 13.5 1.62.36.18.54.78.24 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.3c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.72 1.62.54.3.72 1.02.42 1.56-.3.42-.96.6-1.56.3z"/></svg>`;
const INSTAGRAM_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2zm-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6zm9.65 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>`;
const FACEBOOK_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"/></svg>`;
const CAPCUT_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6l16 12"/><path d="M20 6L4 18"/><rect x="3" y="4" width="18" height="16" rx="2"/></svg>`;
const PINTEREST_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.64 19.31c-.1-.82-.19-2.08.04-2.97l1.34-5.68s-.34-.68-.34-1.69c0-1.58.92-2.76 2.06-2.76.97 0 1.44.73 1.44 1.6 0 .98-.62 2.44-.94 3.8-.27 1.13.57 2.05 1.68 2.05 2.02 0 3.57-2.13 3.57-5.2 0-2.72-1.95-4.62-4.74-4.62-3.23 0-5.13 2.42-5.13 4.93 0 .98.38 2.02.85 2.59.09.11.11.21.08.32l-.32 1.29c-.05.21-.17.25-.39.15-1.45-.68-2.36-2.8-2.36-4.5 0-3.66 2.66-7.03 7.67-7.03 4.03 0 7.16 2.87 7.16 6.71 0 4-2.52 7.22-6.02 7.22-1.18 0-2.28-.61-2.66-1.33l-.72 2.75c-.26 1.01-.97 2.27-1.44 3.04A10 10 0 1 0 12 2z"/></svg>`;
const BRAT_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 10h10M7 14h6"/></svg>`;
const WMP1_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 8h10M7 12h8M7 16h6"/></svg>`;
const TTS_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
const AIO_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;

const SUPPORT_DOWNLOADERS = [
  { id: "tiktok-dl", shortName: "TikTok", icon: TIKTOK_SVG, color: "card-yellow" },
  { id: "youtube-dl", shortName: "YouTube", icon: YOUTUBE_SVG, color: "card-yellow" },
  { id: "spotify-dl", shortName: "Spotify", icon: SPOTIFY_SVG, color: "card-yellow" },
  { id: "instagram-dl", shortName: "Instagram", icon: INSTAGRAM_SVG, color: "card-yellow" },
  { id: "facebook-dl", shortName: "Facebook", icon: FACEBOOK_SVG, color: "card-yellow" },
  { id: "capcut-dl", shortName: "CapCut", icon: CAPCUT_SVG, color: "card-yellow" },
  { id: "pinterest-dl", shortName: "Pinterest", icon: PINTEREST_SVG, color: "card-yellow" },
  { id: "aio-dl", shortName: "All Link", icon: AIO_SVG, color: "card-yellow" },
];

const TOOLS = [
  {
    ...bratTool,
    shortName: "Brat",
    icon: BRAT_SVG,
    category: "Sticker",
    color: "card-yellow",
  },
  {
    ...wmp1Tool,
    shortName: "WMP Quote",
    icon: WMP1_SVG,
    category: "Sticker",
    color: "card-yellow",
  },
  {
    ...ttsTool,
    shortName: "TTS Suara",
    icon: TTS_SVG,
    category: "Utility",
    color: "card-cyan",
  },
  {
    id: "ai-assistant",
    name: "AI Assistant",
    shortName: "AI",
    icon: "AI",
    category: "AI",
    color: "card-cyan",
    badge: "SOON",
    disabled: true,
    render: () => "",
  },
  {
    id: "utility-pack",
    name: "Utility Pack",
    shortName: "Utility",
    icon: "UT",
    category: "Utility",
    color: "card-white",
    badge: "SOON",
    disabled: true,
    render: () => "",
  },
];

const CATEGORIES = ["Semua", ...new Set(TOOLS.map((t) => t.category))];

let activePage = "home"; // "home" | "tools" | "gallery" | "gallery:<idx>" | "settings" | "settings:<id>" | "tool:<id>"
let searchQuery = "";
let activeCategory = "Semua";
let galleryFilter = "ALL"; // "ALL" | "VIDEO" | "MP3"

const navEl = document.getElementById("toolNav");
const stageEl = document.getElementById("toolStage");
const statusEl = document.getElementById("serverStatus");

function applyMotionPref() {
  document.documentElement.dataset.motion = getPrefs().reduceMotion ? "reduced" : "normal";
}

function playPageEnter() {
  if (getPrefs().reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (typeof stageEl.animate === "function") {
    stageEl.animate(
      [
        { opacity: 0, transform: "translate3d(0, 10px, 0)" },
        { opacity: 1, transform: "translate3d(0, 0, 0)" },
      ],
      { duration: 180, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
    );
  }
}

applyMotionPref();

function bindThumbLoaders(container) {
  container.querySelectorAll("img.gallery-thumb").forEach((img) => {
    const wrap = img.closest(".gallery-thumb-wrap");
    if (!wrap) return;
    const done = () => wrap.classList.remove("is-loading");
    if (img.complete) {
      done();
    } else {
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    }
  });
}

function renderNav() {
  const isHome = activePage === "home";
  const isTools = activePage === "tools" || activePage.startsWith("tool:");
  const isGallery = activePage === "gallery" || activePage.startsWith("gallery:");
  const isSettings = activePage === "settings" || activePage.startsWith("settings:");

  navEl.innerHTML = `
    <button class="nav-btn ${isHome ? "active" : ""}" data-page="home">
      <span>${escapeHtml(t("nav_home"))}</span>
    </button>
    <button class="nav-btn ${isTools ? "active" : ""}" data-page="tools">
      <span>${escapeHtml(t("nav_tools"))}</span>
    </button>
    <button class="nav-btn ${isGallery ? "active" : ""}" data-page="gallery">
      <span>${escapeHtml(t("nav_gallery"))}</span>
    </button>
    <button class="nav-btn ${isSettings ? "active" : ""}" data-page="settings">
      <span>${escapeHtml(t("nav_settings"))}</span>
    </button>
  `;
}

function getFilteredTools() {
  const q = searchQuery.trim().toLowerCase();
  return TOOLS.filter((t) => {
    const matchCat = activeCategory === "Semua" || t.category === activeCategory;
    const matchText =
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.desc.toLowerCase().includes(q);
    return matchCat && matchText;
  });
}

function renderToolListHtml() {
  const filtered = getFilteredTools();
  if (!filtered.length) {
    return `<div class="alert alert-info">Tidak ada tool di kategori "${escapeHtml(activeCategory)}" untuk "${escapeHtml(searchQuery)}".</div>`;
  }

  return filtered
    .map(
      (t) => `
      <button
        type="button"
        class="tool-card ${t.color || "card-white"}"
        data-open-tool="${t.id}"
        ${t.disabled ? "disabled" : ""}
      >
        <span class="tool-icon">${t.icon || "OP"}</span>
        <div class="tool-card-body">
          <h3 class="tool-card-title">${escapeHtml(t.shortName || t.name)}</h3>
          ${t.disabled ? `<span class="tag soon">${escapeHtml(t.badge)}</span>` : ""}
        </div>
      </button>
    `
    )
    .join("");
}

function renderSupportDownloadersHtml() {
  return SUPPORT_DOWNLOADERS.map(
    (d) => `
      <button type="button" class="tool-card support-card ${d.color}">
        <span class="tool-icon">${d.icon}</span>
        <div class="tool-card-body">
          <h3 class="tool-card-title">${escapeHtml(d.shortName)}</h3>
        </div>
      </button>
    `
  ).join("");
}

function renderCategoryBarHtml() {
  return CATEGORIES.map(
    (cat) => `
      <button
        type="button"
        class="cat-pill ${cat === activeCategory ? "active" : ""}"
        data-cat="${escapeHtml(cat)}"
      >
        ${escapeHtml(cat)}
      </button>
    `
  ).join("");
}

function pushRoute(page, fromPopstate = false) {
  if (!fromPopstate && history.state?.page !== page) {
    history.pushState({ page }, "");
  }
}

function renderHome(fromPopstate = false) {
  activePage = "home";
  pushRoute(activePage, fromPopstate);
  renderNav();

  stageEl.classList.add("stage-split");
  stageEl.innerHTML = `
    <div class="panel-card">
      ${renderUniversalBoxHtml(getLang())}
    </div>

    <div class="panel-card">
      <div class="support-head" style="border-top:0;padding-top:0;">
        <div class="field-label" style="margin:0;">SUPPORT TOOLS</div>
        <span class="tag">${SUPPORT_DOWNLOADERS.length} AKTIF</span>
      </div>
      <div class="tool-list tool-grid-2">${renderSupportDownloadersHtml()}</div>
    </div>

    <button type="button" class="comic-hero-btn" id="openComicBtn">
      <span class="comic-hero-icon" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"><path d="M2 4h8a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2z"/><path d="M22 4h-8a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h9z"/></svg>
      </span>
      <span class="comic-hero-text">
        <strong>BACA KOMIK</strong>
        <small>Manga, Manhwa &amp; Manhua Sub Indo</small>
      </span>
      <span class="tag comic-hero-pill">BUKA &rarr;</span>
    </button>
  `;
  playPageEnter();

  initUniversalBox(stageEl, { API_BASE: getApiBase(), escapeHtml, prefs: getPrefs() });
  stageEl.querySelector("#openComicBtn")?.addEventListener("click", () => mountComicPage());
}

function mountComicPage(fromPopstate = false) {
  activePage = "comic";
  pushRoute("comic", fromPopstate);
  renderNav();
  stageEl.classList.remove("stage-split");
  mountComicReader(stageEl, {
    API_BASE: getApiBase(),
    escapeHtml,
    onBackHome: () => navigate("home"),
  });
  playPageEnter();
}

function renderToolsPage(fromPopstate = false) {
  activePage = "tools";
  pushRoute(activePage, fromPopstate);
  renderNav();

  stageEl.classList.remove("stage-split");
  stageEl.innerHTML = `
    <div class="dash-head">
      <div>
        <h2 class="stage-title">${escapeHtml(t("nav_tools"))}</h2>
        <p class="stage-desc">${getLang() === "en" ? "Pick a utility or creator tool." : "Pilih tool kreatif & utilitas."}</p>
      </div>
      <span class="tag">${TOOLS.filter((t) => !t.disabled).length}/${TOOLS.length} AKTIF</span>
    </div>

    <input
      id="toolSearch"
      class="brutal-input search-input"
      type="search"
      placeholder="${getLang() === "en" ? "Search tools..." : "Cari tools (mis. Brat, AI)..."}"
      value="${escapeHtml(searchQuery)}"
    />

    <div class="cat-bar" id="catBar">${renderCategoryBarHtml()}</div>
    <div class="tool-list tool-grid-2" id="toolList">${renderToolListHtml()}</div>
  `;
  playPageEnter();

  const searchEl = stageEl.querySelector("#toolSearch");
  const catBarEl = stageEl.querySelector("#catBar");
  const listEl = stageEl.querySelector("#toolList");

  searchEl.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    listEl.innerHTML = renderToolListHtml();
  });

  catBarEl.addEventListener("click", (e) => {
    const pill = e.target.closest("[data-cat]");
    if (!pill) return;
    activeCategory = pill.dataset.cat;
    catBarEl.innerHTML = renderCategoryBarHtml();
    listEl.innerHTML = renderToolListHtml();
  });
}

function loadGalleryItems() {
  try {
    const raw = localStorage.getItem(TT_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function renderGalleryFilterHtml() {
  return ["ALL", "VIDEO", "MP3"]
    .map(
      (f) => `
      <button
        type="button"
        class="cat-pill ${f === galleryFilter ? "active" : ""}"
        data-gfilter="${f}"
      >
        ${f}
      </button>
    `
    )
    .join("");
}

function renderGalleryItemsHtml(items) {
  const apiBase = getApiBase();
  const indexed = items
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => {
      if (galleryFilter === "VIDEO") return item.mediaType !== "audio";
      if (galleryFilter === "MP3") return item.mediaType === "audio";
      return true;
    });

  if (!indexed.length) {
    const emptyMsg = items.length
      ? `Tidak ada item di kategori ${galleryFilter}.`
      : "Galeri masih kosong. Video/MP3 yang berhasil kamu download akan otomatis tersimpan di sini.";
    return `<div class="alert alert-info">${emptyMsg}</div>`;
  }

  return indexed
    .map(({ item, idx }) => {
      const isAudio = item.mediaType === "audio";
      const thumbSrc = item.thumbnail
        ? `${apiBase}/api/media?${new URLSearchParams({ url: item.thumbnail }).toString()}`
        : "";
      const coverHtml = thumbSrc
        ? `<span class="gallery-thumb-wrap is-loading"><img class="gallery-thumb" src="${escapeHtml(thumbSrc)}" alt="Sampul" loading="lazy" /></span>`
        : `<span class="gallery-thumb gallery-thumb-fallback">${isAudio ? "MP3" : "VID"}</span>`;

      return `
        <button type="button" class="gallery-row-card" data-open-gallery="${idx}">
          ${coverHtml}
          <div class="gallery-row-body">
            <div class="gallery-row-top">
              <span class="tag">${isAudio ? "MP3" : "VIDEO"}</span>
              <strong class="gallery-author">${escapeHtml(item.author || "TikTok")}</strong>
            </div>
            <p class="gallery-row-title">${escapeHtml(item.title || item.url)}</p>
          </div>
          <span class="tool-arrow" aria-hidden="true">→</span>
        </button>
      `;
    })
    .join("");
}

function renderGallery(fromPopstate = false) {
  activePage = "gallery";
  pushRoute(activePage, fromPopstate);
  renderNav();
  stageEl.classList.remove("stage-split");

  const items = loadGalleryItems();

  stageEl.innerHTML = `
    <div class="stage-head">
      <div>
        <h2 class="stage-title">Galeri</h2>
        <p class="stage-desc">Klik item untuk memutar &amp; melihat caption lengkap.</p>
      </div>
      ${items.length ? `<button type="button" class="btn btn-sm" id="clearGalleryBtn">Bersihkan</button>` : ""}
    </div>

    <div class="cat-bar" id="galleryFilterBar">${renderGalleryFilterHtml()}</div>
    <div class="gallery-list" id="galleryList">${renderGalleryItemsHtml(items)}</div>
  `;
  playPageEnter();

  const filterBar = stageEl.querySelector("#galleryFilterBar");
  const listEl = stageEl.querySelector("#galleryList");
  const clearBtn = stageEl.querySelector("#clearGalleryBtn");
  bindThumbLoaders(listEl);

  filterBar.addEventListener("click", (e) => {
    const pill = e.target.closest("[data-gfilter]");
    if (!pill) return;
    galleryFilter = pill.dataset.gfilter;
    filterBar.innerHTML = renderGalleryFilterHtml();
    listEl.innerHTML = renderGalleryItemsHtml(loadGalleryItems());
    bindThumbLoaders(listEl);
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      localStorage.removeItem(TT_HISTORY_KEY);
      renderGallery();
    });
  }
}

function renderGalleryDetail(idx, fromPopstate = false) {
  const items = loadGalleryItems();
  const item = items[idx];
  if (!item) return renderGallery(fromPopstate);

  activePage = `gallery:${idx}`;
  pushRoute(activePage, fromPopstate);
  renderNav();

  const apiBase = getApiBase();
  const isAudio = item.mediaType === "audio";
  const mediaSrc = item.mediaUrl
    ? `${apiBase}/api/media?${new URLSearchParams({ url: item.mediaUrl }).toString()}`
    : "";
  const thumbSrc = item.thumbnail
    ? `${apiBase}/api/media?${new URLSearchParams({ url: item.thumbnail }).toString()}`
    : "";
  const dlHref = item.mediaUrl
    ? `${apiBase}/api/media?${new URLSearchParams({
      url: item.mediaUrl,
      download: "1",
      filename: item.filename || (isAudio ? "blackpage.mp3" : "blackpage.mp4"),
    }).toString()}`
    : "#";

  const playerHtml =
    mediaSrc && !isAudio
      ? `<div class="video-wrap is-loading" id="galVideoWrap">
          <div class="video-loader">MEMUAT VIDEO...</div>
          <video class="video-preview" src="${escapeHtml(mediaSrc)}" ${thumbSrc ? `poster="${escapeHtml(thumbSrc)}"` : ""} controls autoplay playsinline preload="auto"></video>
        </div>`
      : mediaSrc && isAudio
        ? `${thumbSrc ? `<img class="thumb" src="${escapeHtml(thumbSrc)}" alt="Sampul" />` : ""}<audio class="audio-preview" src="${escapeHtml(mediaSrc)}" controls autoplay preload="auto"></audio>`
        : "";

  const hasCaption = Boolean(item.title && item.title.trim());

  stageEl.innerHTML = `
    <div class="tool-topbar">
      <button type="button" class="btn btn-sm" data-page="gallery">← Kembali ke Galeri</button>
      <span class="tag">${isAudio ? "MP3" : "VIDEO"}</span>
    </div>

    <article class="result-card">
      ${playerHtml}
      <div class="result-meta">
        <div class="author-row">
          <span class="author-avatar author-fallback">${isAudio ? "MP3" : "VID"}</span>
          <div class="author-info">
            <h3>${escapeHtml(item.author || "TikTok")}</h3>
          </div>
        </div>

        ${hasCaption
      ? `<div class="caption-box">
                <div class="caption-head">
                  <span class="caption-label">CAPTION</span>
                  <div class="caption-actions">
                    <button type="button" class="btn btn-sm" id="galCopySel">Salin Pilihan</button>
                    <button type="button" class="btn btn-sm btn-primary" id="galCopyAll">Salin Semua</button>
                  </div>
                </div>
                <p class="result-caption" id="galCaptionText">${escapeHtml(item.title)}</p>
              </div>`
      : `<p class="result-caption">Tanpa caption</p>`
    }

        <div id="galFeedback"></div>

        <div class="dl-list">
          <button type="button" class="btn btn-success" id="galDownloadBtn">Unduh Lagi</button>
          <button type="button" class="btn" id="galDeleteBtn">Hapus dari Galeri</button>
        </div>
      </div>
    </article>
  `;

  const videoWrap = stageEl.querySelector("#galVideoWrap");
  const videoEl = stageEl.querySelector("video.video-preview");
  playPageEnter();
  if (videoEl) {
    const finishLoad = () => videoWrap && videoWrap.classList.remove("is-loading");
    videoEl.addEventListener("loadeddata", finishLoad, { once: true });
    videoEl.addEventListener("canplay", finishLoad, { once: true });
    videoEl.addEventListener("error", finishLoad, { once: true });
    videoEl.play().catch(() => { });
  }

  const copyAllBtn = stageEl.querySelector("#galCopyAll");
  const copySelBtn = stageEl.querySelector("#galCopySel");
  const feedbackEl = stageEl.querySelector("#galFeedback");
  const dlBtn = stageEl.querySelector("#galDownloadBtn");
  const delBtn = stageEl.querySelector("#galDeleteBtn");

  if (dlBtn) {
    dlBtn.addEventListener("click", async () => {
      const origText = dlBtn.textContent;
      dlBtn.disabled = true;
      dlBtn.textContent = "Menyiapkan...";
      try {
        const res = await downloadMediaFile({
          API_BASE: apiBase,
          remoteUrl: item.mediaUrl,
          mediaType: item.mediaType === "audio" ? "audio" : item.mediaType === "image" ? "image" : "video",
          filename: item.filename || `blackpage_${Date.now()}.${item.mediaType === "audio" ? "mp3" : "mp4"}`,
          onProgress: (p) => {
            dlBtn.textContent = typeof p.percent === "number" ? `${p.percent}%` : "Mengunduh...";
            feedbackEl.innerHTML = renderProgressHtml({ label: "Mengunduh...", ...p });
          },
        });
        feedbackEl.innerHTML = `<div class="alert alert-info">${res.native ? `Tersimpan di ${escapeHtml(res.path)}!` : "Download dimulai!"
          }</div>`;
      } catch (err) {
        feedbackEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message || "Gagal mengunduh file.")}</div>`;
      } finally {
        dlBtn.disabled = false;
        dlBtn.textContent = origText;
      }
    });
  }

  if (copyAllBtn) {
    copyAllBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(item.title);
        copyAllBtn.textContent = "Tersalin!";
        setTimeout(() => (copyAllBtn.textContent = "Salin Semua"), 1400);
      } catch {
        feedbackEl.innerHTML = `<div class="alert alert-error">Gagal menyalin caption.</div>`;
      }
    });
  }

  if (copySelBtn) {
    copySelBtn.addEventListener("click", async () => {
      const capEl = stageEl.querySelector("#galCaptionText");
      const sel = window.getSelection();
      const selected =
        sel && sel.rangeCount > 0 && capEl && capEl.contains(sel.anchorNode) ? sel.toString() : "";
      if (!selected.trim()) {
        feedbackEl.innerHTML = `<div class="alert alert-info">Blok/pilih dulu bagian teks caption yang mau disalin.</div>`;
        return;
      }
      try {
        await navigator.clipboard.writeText(selected);
        copySelBtn.textContent = "Tersalin!";
        setTimeout(() => (copySelBtn.textContent = "Salin Pilihan"), 1400);
      } catch {
        feedbackEl.innerHTML = `<div class="alert alert-error">Gagal menyalin teks pilihan.</div>`;
      }
    });
  }

  delBtn.addEventListener("click", () => {
    const updated = loadGalleryItems().filter((_, i) => i !== idx);
    localStorage.setItem(TT_HISTORY_KEY, JSON.stringify(updated));
    renderGallery();
  });
}

const SETTINGS_SECTIONS = [
  { id: "umum", num: "01", titleId: "UMUM", titleEn: "GENERAL", descId: "Bahasa aplikasi", descEn: "App language" },
  { id: "tampilan", num: "02", titleId: "TAMPILAN & RASA", titleEn: "APPEARANCE", descId: "Tema & kenyamanan visual", descEn: "Theme & visual comfort" },
  { id: "penyimpanan", num: "03", titleId: "PENYIMPANAN & UNDUHAN", titleEn: "STORAGE & DOWNLOADS", descId: "Folder download, galeri & cache", descEn: "Download folder, gallery & cache" },
  { id: "lanjutan", num: "04", titleId: "LANJUTAN", titleEn: "ADVANCED", descId: "Koneksi API & opsi developer", descEn: "API connection & developer options" },
  { id: "tentang", num: "05", titleId: "TENTANG & BANTUAN", titleEn: "ABOUT & HELP", descId: "Info aplikasi Blackpage & panduan", descEn: "Blackpage info & guide" },
];

function getSectionText(s) {
  const isEn = getLang() === "en";
  return { title: isEn ? s.titleEn : s.titleId, desc: isEn ? s.descEn : s.descId };
}

function renderSettings(fromPopstate = false) {
  activePage = "settings";
  pushRoute(activePage, fromPopstate);
  renderNav();
  stageEl.classList.remove("stage-split");

  const menuHtml = SETTINGS_SECTIONS.map((s) => {
    const { title, desc } = getSectionText(s);
    return `
      <button type="button" class="tool-card" data-open-setting="${s.id}">
        <span class="tool-icon">${s.num}</span>
        <div class="tool-card-body">
          <div class="tool-card-top">
            <h3 class="tool-card-title">${escapeHtml(title)}</h3>
          </div>
          <p class="tool-card-desc">${escapeHtml(desc)}</p>
        </div>
        <span class="tool-arrow" aria-hidden="true">→</span>
      </button>
    `;
  }).join("");

  stageEl.innerHTML = `
    <div class="stage-head">
      <div>
        <h2 class="stage-title">${escapeHtml(t("settings_title"))}</h2>
        <p class="stage-desc">${escapeHtml(t("settings_desc"))}</p>
      </div>
      <span class="tag">V1.0</span>
    </div>
    <div class="tool-list">${menuHtml}</div>
  `;
  playPageEnter();
}

function renderTampilanSettings() {
  const current = getThemeMode();
  const isEn = getLang() === "en";
  const prefs = getPrefs();
  const options = [
    { id: "auto", title: isEn ? "Follow Android Theme" : "Ikuti Tema Android", sub: isEn ? "Automatically match system light/dark mode" : "Otomatis menyesuaikan mode terang/gelap sistem" },
    { id: "light", title: isEn ? "Light Theme" : "Tema Terang", sub: isEn ? "Classic manga paper (#F4F1EA)" : "Kertas manga klasik (#F4F1EA)" },
    { id: "dark", title: isEn ? "Dark Theme" : "Tema Gelap", sub: isEn ? "High-contrast dark ink (#121214)" : "Tinta gelap kontras tinggi (#121214)" },
  ];
  return `
    <div class="setting-group">
      <div class="field-label">${isEn ? "THEME" : "TEMA"}</div>
      <div class="theme-options" id="themeOptions">
        ${options
      .map(
        (o) => `
          <button type="button" class="theme-option ${current === o.id ? "active" : ""}" data-set-theme="${o.id}">
            <div>
              <div class="theme-option-title">${escapeHtml(o.title)}</div>
              <div class="theme-option-sub">${escapeHtml(o.sub)}</div>
            </div>
            <span class="tag">${current === o.id ? (isEn ? "ACTIVE" : "AKTIF") : (isEn ? "SELECT" : "PILIH")}</span>
          </button>
        `
      )
      .join("")}
      </div>
    </div>

    <div class="setting-group">
      <div class="field-label">${isEn ? "MOTION" : "ANIMASI"}</div>
      <button type="button" class="toggle-row" id="reduceMotionBtn" role="switch" aria-checked="${prefs.reduceMotion ? "true" : "false"}">
        <div class="toggle-text">
          <div class="theme-option-title">${isEn ? "Reduce Motion" : "Kurangi Animasi"}</div>
          <div class="theme-option-sub">${isEn ? "Disable transitions for maximum speed" : "Matikan transisi agar super instan"}</div>
        </div>
        <span class="toggle-switch ${prefs.reduceMotion ? "on" : ""}"><span class="toggle-knob"></span></span>
      </button>
    </div>
  `;
}

function renderPenyimpananSettings() {
  const isEn = getLang() === "en";
  const prefs = getPrefs();
  const items = loadGalleryItems();
  const videoCount = items.filter((x) => x.mediaType !== "audio").length;
  const audioCount = items.filter((x) => x.mediaType === "audio").length;
  const bytes = new Blob([localStorage.getItem(TT_HISTORY_KEY) || ""]).size;
  const kb = (bytes / 1024).toFixed(1);

  return `
    <div class="setting-group">
      <div class="field-label">${isEn ? "DOWNLOAD FOLDERS" : "LOKASI UNDUHAN"}</div>
      <div class="alert alert-info path-info">
        <strong>${isEn ? "Android APK:" : "APK Android:"}</strong><br />
        Video: <code>Download/Blackpage/video</code><br />
        Audio: <code>Download/Blackpage/audio</code><br />
        <small>${isEn ? "On Web, your browser lets you pick any save location." : "Untuk Web, browser bebas memilih lokasi simpan."}</small>
      </div>
    </div>

    <div class="setting-group">
      <div class="field-label">${isEn ? "GALLERY" : "GALERI"}</div>
      <button type="button" class="toggle-row" id="autoSaveGalBtn" role="switch" aria-checked="${prefs.autoSaveGallery ? "true" : "false"}">
        <div class="toggle-text">
          <div class="theme-option-title">${isEn ? "Auto-Save to Gallery" : "Simpan Otomatis ke Galeri"}</div>
          <div class="theme-option-sub">${isEn ? "Record downloaded media in Gallery tab" : "Catat media hasil download ke tab Galeri"}</div>
        </div>
        <span class="toggle-switch ${prefs.autoSaveGallery ? "on" : ""}"><span class="toggle-knob"></span></span>
      </button>

      <div class="stat-pair">
        <div class="stat-box"><strong>${videoCount}</strong><span>VIDEO</span></div>
        <div class="stat-box"><strong>${audioCount}</strong><span>MP3</span></div>
        <div class="stat-box"><strong>${kb} KB</strong><span>CACHE</span></div>
      </div>

      <button type="button" class="btn" id="clearStorageGalBtn" ${items.length ? "" : "disabled"}>
        ${isEn ? "Clear Gallery Cache" : "Bersihkan Cache Galeri"}
      </button>
    </div>
  `;
}

function renderLanjutanSettings() {
  const isEn = getLang() === "en";
  const savedApi = localStorage.getItem(API_BASE_KEY) || "";
  return `
    <form id="advApiForm" class="settings-form">
      <label class="field-label" for="advApiInput">${isEn ? "API Base URL (for APK)" : "API Base URL (opsional untuk APK)"}</label>
      <input
        id="advApiInput"
        class="brutal-input"
        type="url"
        placeholder="${isEn ? "Leave empty for same-origin (web)" : "Kosongkan untuk same-origin (web)"}"
        value="${escapeHtml(savedApi)}"
      />
      <div class="settings-actions">
        <button type="submit" class="btn btn-primary">${isEn ? "Save" : "Simpan"}</button>
        <button type="button" class="btn" id="pingApiBtn">${isEn ? "Test Ping" : "Tes Koneksi"}</button>
      </div>
    </form>

    <div id="advFeedback"></div>

    <div class="setting-group" style="margin-top: 16px;">
      <div class="field-label">${isEn ? "RESET" : "ATUR ULANG"}</div>
      <button type="button" class="btn btn-success" id="resetAllBtn">
        ${isEn ? "Reset All Settings & Data" : "Reset Semua Pengaturan & Data"}
      </button>
    </div>
  `;
}

function renderTentangSettings() {
  const isEn = getLang() === "en";
  return `
    <div class="about-card">
      <div class="about-head">
        <img src="./icon.svg" alt="Blackpage Logo" class="about-logo" />
        <div>
          <h3 style="margin:0;">BLACKPAGE</h3>
          <p class="stage-desc" style="margin:2px 0 0;">v${APP_VERSION} · Manga Editorial · APK-Ready</p>
        </div>
      </div>
      <p class="about-text">
        ${isEn
      ? "Lightweight multi-tool utility hub built with zero-dependency Node.js and vanilla ES modules."
      : "Hub multi-tools ringan berbasis Node.js tanpa dependency eksternal dan vanilla ES modules."}
      </p>
    </div>

    <div class="setting-group" style="margin-top: 12px;">
      <div class="field-label">${isEn ? "APP UPDATES" : "PEMBARUAN APLIKASI"}</div>
      <div id="updateStatusBox"></div>
      <div class="settings-actions">
        <button type="button" class="btn btn-primary" id="checkUpdateBtn">${isEn ? "Check for Updates" : "Cek Update"}</button>
        <a class="btn" href="https://github.com/${GITHUB_REPO}/releases" target="_blank" rel="noopener">GitHub Releases</a>
      </div>
    </div>

    <div class="setting-group" style="margin-top: 12px;">
      <div class="field-label">${isEn ? "QUICK GUIDE" : "PANDUAN CEPAT"}</div>
      <div class="alert alert-info path-info" style="margin-bottom:0;">
        1. ${isEn ? "Open TikTok Downloader, paste link, video auto-plays." : "Buka TikTok Downloader, tempel link, video otomatis diputar."}<br />
        2. ${isEn ? "Hold caption text to select part of it, or tap Copy All." : "Tahan teks caption untuk pilih sebagian, atau klik Salin Semua."}<br />
        3. ${isEn ? "Downloaded media appears in Gallery with VIDEO / MP3 filters." : "Media terunduh otomatis masuk Galeri dengan filter VIDEO / MP3."}
      </div>
    </div>
  `;
}

function renderUmumSettings() {
  const lang = getLang();
  const langName = lang === "en" ? "English" : "Bahasa Indonesia";
  const prefs = getPrefs();

  const toggles = [
    { key: "autoPaste", title: t("pref_auto_paste"), sub: t("pref_auto_paste_sub") },
    { key: "autoAnalyze", title: t("pref_auto_analyze"), sub: t("pref_auto_analyze_sub") },
    { key: "keepAwake", title: t("pref_keep_awake"), sub: t("pref_keep_awake_sub") },
    { key: "autoUpdate", title: t("pref_auto_update"), sub: t("pref_auto_update_sub") },
  ];

  return `
    <div class="setting-group">
      <div class="field-label">${escapeHtml(t("lang_label"))}</div>
      <div class="select-wrap">
        <button type="button" class="select-box" id="langSelectBtn" aria-expanded="false">
          <span>${escapeHtml(langName)}</span>
          <span class="select-chevron">▾</span>
        </button>
        <div class="select-menu" id="langRow" hidden>
          <button type="button" class="theme-option ${lang === "id" ? "active" : ""}" data-set-lang="id">
            <span class="theme-option-title">Bahasa Indonesia</span>
            <span class="tag">${lang === "id" ? "AKTIF" : "ID"}</span>
          </button>
          <button type="button" class="theme-option ${lang === "en" ? "active" : ""}" data-set-lang="en">
            <span class="theme-option-title">English</span>
            <span class="tag">${lang === "en" ? "ACTIVE" : "EN"}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="setting-group" id="umumToggles">
      ${toggles
      .map(
        (item) => `
        <button
          type="button"
          class="toggle-row"
          role="switch"
          aria-checked="${prefs[item.key] ? "true" : "false"}"
          data-toggle-pref="${item.key}"
        >
          <div class="toggle-text">
            <div class="theme-option-title">${escapeHtml(item.title)}</div>
            <div class="theme-option-sub">${escapeHtml(item.sub)}</div>
          </div>
          <span class="toggle-switch ${prefs[item.key] ? "on" : ""}">
            <span class="toggle-knob"></span>
          </span>
        </button>
      `
      )
      .join("")}
    </div>
  `;
}

function renderSettingDetail(sectionId, fromPopstate = false) {
  const section = SETTINGS_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return renderSettings(fromPopstate);

  activePage = `settings:${section.id}`;
  pushRoute(activePage, fromPopstate);
  renderNav();

  const { title, desc } = getSectionText(section);
  const bodyHtml =
    section.id === "umum"
      ? renderUmumSettings()
      : section.id === "tampilan"
        ? renderTampilanSettings()
        : section.id === "penyimpanan"
          ? renderPenyimpananSettings()
          : section.id === "lanjutan"
            ? renderLanjutanSettings()
            : renderTentangSettings();

  stageEl.innerHTML = `
    <div class="tool-topbar">
      <button type="button" class="btn btn-sm" data-page="settings">${escapeHtml(t("back_settings"))}</button>
      <span class="tag">${section.num}</span>
    </div>
    <div class="stage-head">
      <div>
        <h2 class="stage-title">${escapeHtml(title)}</h2>
        <p class="stage-desc">${escapeHtml(desc)}</p>
      </div>
    </div>
    ${bodyHtml}
  `;
  playPageEnter();

  const themeOpts = stageEl.querySelector("#themeOptions");
  if (themeOpts) {
    themeOpts.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-set-theme]");
      if (!btn) return;
      const mode = btn.dataset.setTheme;
      localStorage.setItem(THEME_KEY, mode);
      applyTheme(mode);
      renderSettingDetail("tampilan", true);
    });
  }

  const reduceMotionBtn = stageEl.querySelector("#reduceMotionBtn");
  if (reduceMotionBtn) {
    reduceMotionBtn.addEventListener("click", () => {
      const prefs = getPrefs();
      prefs.reduceMotion = !prefs.reduceMotion;
      savePrefs(prefs);
      applyMotionPref();
      renderSettingDetail("tampilan", true);
    });
  }

  if (section.id === "penyimpanan") {
    const autoSaveBtn = stageEl.querySelector("#autoSaveGalBtn");
    const clearBtn = stageEl.querySelector("#clearStorageGalBtn");
    autoSaveBtn.addEventListener("click", () => {
      const prefs = getPrefs();
      prefs.autoSaveGallery = !prefs.autoSaveGallery;
      savePrefs(prefs);
      renderSettingDetail("penyimpanan", true);
    });
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        localStorage.removeItem(TT_HISTORY_KEY);
        renderSettingDetail("penyimpanan", true);
      });
    }
  }

  if (section.id === "lanjutan") {
    const form = stageEl.querySelector("#advApiForm");
    const apiInput = stageEl.querySelector("#advApiInput");
    const pingBtn = stageEl.querySelector("#pingApiBtn");
    const resetAllBtn = stageEl.querySelector("#resetAllBtn");
    const feedback = stageEl.querySelector("#advFeedback");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = apiInput.value.trim().replace(/\/+$/, "");
      if (val) localStorage.setItem(API_BASE_KEY, val);
      else localStorage.removeItem(API_BASE_KEY);
      feedback.innerHTML = `<div class="alert alert-info">API URL tersimpan.</div>`;
      checkHealth();
    });

    pingBtn.addEventListener("click", async () => {
      const t0 = performance.now();
      try {
        const res = await fetch(`${getApiBase()}/api/health`);
        const ms = Math.round(performance.now() - t0);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        feedback.innerHTML = `<div class="alert alert-info">ONLINE · ${ms} ms</div>`;
      } catch (err) {
        feedback.innerHTML = `<div class="alert alert-error">OFFLINE · ${escapeHtml(err.message || "Gagal")}</div>`;
      }
    });

    resetAllBtn.addEventListener("click", () => {
      localStorage.removeItem(API_BASE_KEY);
      localStorage.removeItem(TT_HISTORY_KEY);
      localStorage.removeItem(THEME_KEY);
      localStorage.removeItem(LANG_KEY);
      localStorage.removeItem(PREFS_KEY);
      applyTheme("auto");
      applyMotionPref();
      syncWakeLock();
      checkHealth();
      renderSettingDetail("lanjutan", true);
    });
  }

  if (section.id === "tentang") {
    const checkBtn = stageEl.querySelector("#checkUpdateBtn");
    const box = stageEl.querySelector("#updateStatusBox");
    const renderUpdateState = (info) => {
      if (!info) return;
      if (info.hasUpdate) {
        box.innerHTML = `<div class="alert alert-info"><strong>Update tersedia: v${escapeHtml(info.latest)}</strong> (saat ini v${APP_VERSION}). <a href="${escapeHtml(info.url)}" target="_blank" rel="noopener">Unduh APK terbaru</a></div>`;
      } else {
        box.innerHTML = `<div class="alert alert-info">Aplikasi sudah versi terbaru (v${APP_VERSION}).</div>`;
      }
    };
    if (latestUpdateInfo) renderUpdateState(latestUpdateInfo);
    checkBtn?.addEventListener("click", async () => {
      checkBtn.disabled = true;
      checkBtn.textContent = "Mengecek...";
      box.innerHTML = `<div class="alert alert-info">Mengecek versi terbaru di GitHub...</div>`;
      try {
        const info = await checkAppUpdate();
        renderUpdateState(info);
      } catch (err) {
        box.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message || "Gagal mengecek update.")}</div>`;
      } finally {
        checkBtn.disabled = false;
        checkBtn.textContent = getLang() === "en" ? "Check for Updates" : "Cek Update";
      }
    });
  }

  if (section.id === "umum") {
    const langSelectBtn = stageEl.querySelector("#langSelectBtn");
    const langRow = stageEl.querySelector("#langRow");
    const togglesEl = stageEl.querySelector("#umumToggles");

    langSelectBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = langRow.hidden;
      langRow.hidden = !open;
      langSelectBtn.setAttribute("aria-expanded", String(open));
    });

    stageEl.addEventListener("click", (e) => {
      if (!e.target.closest(".setting-group")) {
        langRow.hidden = true;
        langSelectBtn.setAttribute("aria-expanded", "false");
      }
    });

    langRow.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-set-lang]");
      if (!btn) return;
      localStorage.setItem(LANG_KEY, btn.dataset.setLang);
      renderSettingDetail("umum", true);
    });

    togglesEl.addEventListener("click", (e) => {
      const row = e.target.closest("[data-toggle-pref]");
      if (!row) return;
      const key = row.dataset.togglePref;
      const prefs = getPrefs();
      prefs[key] = !prefs[key];
      savePrefs(prefs);
      if (key === "keepAwake") syncWakeLock();
      if (key === "autoUpdate" && prefs[key]) checkHealth();
      renderSettingDetail("umum", true);
    });
  }
}

function mountTool(id, prefillUrl = "", fromPopstate = false) {
  const tool = TOOLS.find((t) => t.id === id && !t.disabled);
  if (!tool) return renderToolsPage(fromPopstate);

  activePage = `tool:${tool.id}`;
  pushRoute(activePage, fromPopstate);
  renderNav();
  stageEl.classList.remove("stage-split");
  stageEl.innerHTML = `
    <div class="tool-topbar">
      <button type="button" class="btn btn-sm" data-page="tools">${escapeHtml(t("back_tools"))}</button>
      <span class="tag">${escapeHtml(tool.badge)}</span>
    </div>
    ${tool.render()}
  `;
  playPageEnter();
  if (typeof tool.init === "function") {
    tool.init(stageEl, { API_BASE: getApiBase(), escapeHtml, prefs: getPrefs() });
  }
  if (prefillUrl) {
    const input = stageEl.querySelector("#ttInput");
    if (input) input.value = prefillUrl;
  }
}

function navigate(page, fromPopstate = false) {
  if (page === "home") renderHome(fromPopstate);
  else if (page === "tools") renderToolsPage(fromPopstate);
  else if (page === "gallery") renderGallery(fromPopstate);
  else if (page === "settings") renderSettings(fromPopstate);
  else if (page.startsWith("tool:")) mountTool(page.slice(5), "", fromPopstate);
  else if (page.startsWith("gallery:")) renderGalleryDetail(Number(page.slice(8)), fromPopstate);
  else if (page.startsWith("settings:")) renderSettingDetail(page.slice(9), fromPopstate);
  else renderHome(fromPopstate);
}

window.addEventListener("popstate", (e) => {
  navigate(e.state?.page || "home", true);
});

window.Capacitor?.Plugins?.App?.addListener?.("backButton", () => {
  if (activePage !== "home") {
    history.back();
  } else {
    window.Capacitor.Plugins.App.exitApp?.();
  }
});

navEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-page]");
  if (btn) navigate(btn.dataset.page);
});

stageEl.addEventListener("click", (e) => {
  const pageBtn = e.target.closest("[data-page]");
  if (pageBtn) {
    navigate(pageBtn.dataset.page);
    return;
  }
  const openGal = e.target.closest("[data-open-gallery]");
  if (openGal) {
    renderGalleryDetail(Number(openGal.dataset.openGallery));
    return;
  }
  const openSet = e.target.closest("[data-open-setting]");
  if (openSet) {
    renderSettingDetail(openSet.dataset.openSetting);
    return;
  }
  const openTt = e.target.closest("[data-open-tiktok]");
  if (openTt) {
    mountTool("tiktok-dl", openTt.dataset.openTiktok);
    return;
  }
  const card = e.target.closest("[data-open-tool]");
  if (card && !card.disabled) {
    mountTool(card.dataset.openTool);
  }
});

let latestUpdateInfo = null;

function compareSemver(a, b) {
  const pa = String(a || "").replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b || "").replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function checkAppUpdate() {
  let latest = "";
  const url = `https://github.com/${GITHUB_REPO}/actions`;
  try {
    const healthRes = await fetch(`${getApiBase()}/api/health`, { cache: "no-store" });
    if (healthRes.ok) {
      const info = await healthRes.json();
      if (info?.version) latest = String(info.version).replace(/^v/i, "");
    }
  } catch {}

  const hasUpdate = Boolean(latest && compareSemver(latest, APP_VERSION) > 0);
  latestUpdateInfo = { latest: latest || APP_VERSION, hasUpdate, url };
  if (hasUpdate && statusEl?.lastElementChild && !statusEl.classList.contains("offline")) {
    statusEl.lastElementChild.textContent = `UPDATE v${latest}`;
  }
  return latestUpdateInfo;
}

async function checkHealth() {
  try {
    const res = await fetch(`${getApiBase()}/api/health`);
    if (!res.ok) throw new Error();
    const info = await res.json();
    statusEl.classList.remove("offline");
    const hasUpdate = getPrefs().autoUpdate && info.version && info.version !== APP_VERSION;
    statusEl.lastElementChild.textContent = hasUpdate ? `UPDATE ${info.version}` : "ONLINE";
    if (getPrefs().autoUpdate) {
      checkAppUpdate().catch(() => { });
    }
  } catch {
    statusEl.classList.add("offline");
    statusEl.lastElementChild.textContent = "OFFLINE";
  }
}

history.replaceState({ page: "home" }, "");
renderHome(true);
checkHealth();
