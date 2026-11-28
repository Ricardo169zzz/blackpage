import { downloadMediaFile, renderProgressHtml, resolveOfflineThumbSrc, cacheOfflineThumb } from "./tools/download.js";
import { createMusicPlayer } from "./tools/music-player.js";
import { createBgEffects } from "./tools/bg-effects.js";
import { quranTool } from "./tools/quran.js";
import { mountAnimeApp } from "./tools/anime.js";
import { mountOnboarding, renderSplashMarkup } from "./tools/intro.js";

const API_BASE_KEY = "tools_op_api_base_v1";
const TT_HISTORY_KEY = "tools_op_tiktok_history_v1";
const THEME_KEY = "tools_op_theme_v1";
const PREFS_KEY = "tools_op_prefs_v1";
const APP_VERSION = "1.5.1";
const GITHUB_REPO = "Ricardo169zzz/blackpage";

const DEFAULT_PREFS = {
  autoPaste: false,
  autoAnalyze: true,
  keepAwake: false,
  autoUpdate: true,
  reduceMotion: false,
  autoSaveGallery: true,
  bgEffect: "none",
  bgBrightness: 100,
  bgSpeed: 100,
  videoFolder: "Download/Blackpage/video",
  audioFolder: "Download/Blackpage/audio",
  autoRetry: true,
  maxRetry: 3,
  introStyle: "bauhaus",
  onboardingDone: false,
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
  const isDark = resolved === "dark";
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  const color = isDark ? "#121214" : "#F2EDE2";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", color);
  try {
    window.BlackpageNative?.setSystemBarsDark?.(isDark);
  } catch { }
  try {
    const sb = window.Capacitor?.Plugins?.StatusBar;
    sb?.setStyle?.({ style: isDark ? "DARK" : "LIGHT" });
    sb?.setBackgroundColor?.({ color });
  } catch { }
}

systemDarkMq.addEventListener("change", () => {
  if (getThemeMode() === "auto") applyTheme("auto");
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && getThemeMode() === "auto") {
    applyTheme("auto");
  }
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
import { nokiaTool } from "./tools/nokia.js";
import { iqcTool } from "./tools/iqc.js";
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
const QURAN_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 6.5c-2.2-1.6-5.2-2-8-1.5v13c2.8-.5 5.8-.1 8 1.5 2.2-1.6 5.2-2 8-1.5V5c-2.8-.5-5.8-.1-8 1.5Z"/><line x1="12" y1="6.5" x2="12" y2="19.5"/></svg>`;
const NOKIA_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2"/><rect x="8" y="5" width="8" height="6"/><path d="M9 15h.01M12 15h.01M15 15h.01M9 18h.01M12 18h.01M15 18h.01"/></svg>`;
const IQC_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/></svg>`;
const AIO_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
const DOUYIN_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/><circle cx="18" cy="5" r="1.5" fill="currentColor" stroke="none"/></svg>`;
const THREADS_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>`;
const REDDIT_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="14" r="7"/><path d="M12 7l2-4 3 1"/><circle cx="9.5" cy="13.5" r="1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="13.5" r="1" fill="currentColor" stroke="none"/><path d="M9.5 16.5a4 4 0 0 0 5 0"/></svg>`;
const PIXIV_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 20V5h6.5a5.5 5.5 0 0 1 0 11H7"/><path d="M5 20h4"/></svg>`;
const BILIBILI_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 3l2.5 3M16 3l-2.5 3M9 12v2M15 12v2"/></svg>`;
const REDNOTE_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h5M8 17h7"/></svg>`;

const SUPPORT_DOWNLOADERS = [
  { id: "tiktok-dl", shortName: "TikTok", icon: TIKTOK_SVG, color: "card-yellow" },
  { id: "douyin-dl", shortName: "Douyin", icon: DOUYIN_SVG, color: "card-yellow" },
  { id: "youtube-dl", shortName: "YouTube", icon: YOUTUBE_SVG, color: "card-yellow" },
  { id: "spotify-dl", shortName: "Spotify", icon: SPOTIFY_SVG, color: "card-yellow" },
  { id: "instagram-dl", shortName: "Instagram", icon: INSTAGRAM_SVG, color: "card-yellow" },
  { id: "facebook-dl", shortName: "Facebook", icon: FACEBOOK_SVG, color: "card-yellow" },
  { id: "threads-dl", shortName: "Threads", icon: THREADS_SVG, color: "card-yellow" },
  { id: "reddit-dl", shortName: "Reddit", icon: REDDIT_SVG, color: "card-yellow" },
  { id: "capcut-dl", shortName: "CapCut", icon: CAPCUT_SVG, color: "card-yellow" },
  { id: "pinterest-dl", shortName: "Pinterest", icon: PINTEREST_SVG, color: "card-yellow" },
  { id: "pixiv-dl", shortName: "Pixiv", icon: PIXIV_SVG, color: "card-yellow" },
  { id: "bilibili-dl", shortName: "Bilibili", icon: BILIBILI_SVG, color: "card-yellow" },
  { id: "rednote-dl", shortName: "RedNote", icon: REDNOTE_SVG, color: "card-yellow" },
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
    ...nokiaTool,
    shortName: "Nokia SMS",
    icon: NOKIA_SVG,
    category: "Sticker",
    color: "card-yellow",
  },
  {
    ...iqcTool,
    shortName: "IQC Quote",
    icon: IQC_SVG,
    category: "Sticker",
    color: "card-yellow",
  },
  {
    ...ttsTool,
    shortName: "TTS Suara",
    icon: TTS_SVG,
    category: "MP3 & Audio",
    color: "card-cyan",
  },
  {
    ...quranTool,
    shortName: "Al-Qur'an",
    icon: QURAN_SVG,
    category: "Islami",
    color: "card-white",
  },
  {
    id: "ai-assistant",
    name: "AI Assistant",
    shortName: "AI",
    icon: "AI",
    category: "AI & Utility",
    color: "card-cyan",
    badge: "SOON",
    disabled: true,
    desc: "Asisten AI serba guna (segera hadir).",
    render: () => "",
  },
  {
    id: "utility-pack",
    name: "Utility Pack",
    shortName: "Utility",
    icon: "UT",
    category: "AI & Utility",
    color: "card-white",
    badge: "SOON",
    disabled: true,
    desc: "Kumpulan utilitas tambahan (segera hadir).",
    render: () => "",
  },
];

const TOOL_GROUPS = [
  { id: "Sticker", label: "Sticker", desc: "Buat stiker & kutipan cepat", icon: BRAT_SVG, color: "card-yellow" },
  { id: "MP3 & Audio", label: "MP3 & Audio", desc: "Konversi teks & olah audio", icon: TTS_SVG, color: "card-cyan" },
  { id: "Islami", label: "Islami", desc: "Al-Qur'an digital & cari surah", icon: QURAN_SVG, color: "card-white" },
  { id: "AI & Utility", label: "AI & Utility", desc: "Asisten & utilitas tambahan", icon: "UT", color: "card-white" },
];

let activePage = "home"; // "home" | "tools" | "gallery" | "gallery:<idx>" | "settings" | "settings:<id>" | "tool:<id>"
let prevPage = "home";
let searchQuery = "";
let openToolGroup = null;
let galleryFilter = "MEDIA"; // "MEDIA" | "MUSIC"
let hasPlayedHomeStagger = false;
let activeStageAnim = null;
let comicController = null;
let animeController = null;
let animeNavTab = "ongoing";

const navEl = document.getElementById("toolNav");
const stageEl = document.getElementById("toolStage");
const statusEl = document.getElementById("serverStatus");
const miniPlayerEl = document.getElementById("bpMiniPlayer");

let lastMiniTrackKey = "";
let lastTabRenderKey = "";
let miniCollapseTimer = null;
let miniIdleTimer = null;
let miniCirclePos = null; // { x, y }

function clearMiniTimers() {
  if (miniCollapseTimer) {
    clearTimeout(miniCollapseTimer);
    miniCollapseTimer = null;
  }
  if (miniIdleTimer) {
    clearTimeout(miniIdleTimer);
    miniIdleTimer = null;
  }
}

function getShellSize() {
  const shell = miniPlayerEl?.closest(".app-shell");
  return {
    w: shell?.clientWidth || 360,
    h: shell?.clientHeight || 720,
  };
}

function getDefaultCirclePos() {
  const { w } = getShellSize();
  return { x: Math.max(12, w - 40 - 12), y: 64 };
}

function scheduleMiniIdleFade() {
  if (miniIdleTimer) clearTimeout(miniIdleTimer);
  if (!miniPlayerEl || miniPlayerEl.hidden || !miniPlayerEl.classList.contains("is-circle")) return;
  miniPlayerEl.classList.remove("is-idle");
  miniIdleTimer = setTimeout(() => {
    if (miniPlayerEl && !miniPlayerEl.hidden && miniPlayerEl.classList.contains("is-circle")) {
      miniPlayerEl.classList.add("is-idle");
    }
  }, 3000);
}

function collapseToCircle() {
  if (!miniPlayerEl || miniPlayerEl.hidden) return;
  if (!miniCirclePos) miniCirclePos = getDefaultCirclePos();
  const { w, h } = getShellSize();
  const x = Math.max(8, Math.min(w - 50, miniCirclePos.x));
  const y = Math.max(58, Math.min(h - 60, miniCirclePos.y));
  miniCirclePos = { x, y };
  const isLeft = x + 21 < w / 2;
  miniPlayerEl.classList.toggle("from-left", isLeft);
  miniPlayerEl.classList.add("is-circle");
  miniPlayerEl.style.left = `${x}px`;
  miniPlayerEl.style.top = `${y}px`;
  scheduleMiniIdleFade();
}

function scheduleMiniCollapse() {
  clearMiniTimers();
  if (!miniPlayerEl || miniPlayerEl.hidden) return;
  miniCollapseTimer = setTimeout(collapseToCircle, 3000);
}

function expandMiniBanner() {
  if (!miniPlayerEl) return;
  clearMiniTimers();
  if (!miniCirclePos) miniCirclePos = getDefaultCirclePos();
  const { w, h } = getShellSize();
  const bannerW = Math.min(336, Math.max(240, w - 24));
  const isLeft = miniCirclePos.x + 21 < w / 2;
  const bannerLeft = isLeft
    ? Math.max(12, Math.min(miniCirclePos.x, w - bannerW - 12))
    : Math.max(12, Math.min(miniCirclePos.x + 42 - bannerW, w - bannerW - 12));
  const bannerTop = Math.max(58, Math.min(miniCirclePos.y - 4, h - 66));

  miniPlayerEl.classList.toggle("from-left", isLeft);
  miniPlayerEl.classList.remove("is-circle", "is-idle");
  miniPlayerEl.style.left = `${miniCirclePos.x}px`;
  miniPlayerEl.style.top = `${miniCirclePos.y}px`;
  const bannerEl = miniPlayerEl.querySelector(".bp-mini-banner-view");
  if (bannerEl) {
    bannerEl.style.width = `${bannerW}px`;
    bannerEl.style.left = `${bannerLeft - miniCirclePos.x}px`;
    bannerEl.style.top = `${bannerTop - miniCirclePos.y}px`;
  }
  scheduleMiniCollapse();
}

function renameGalleryItem(idx, newTitle) {
  const items = loadGalleryItems();
  if (!items[idx]) return false;
  items[idx].title = String(newTitle || "").trim();
  try {
    localStorage.setItem(TT_HISTORY_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

function saveMusicTrack(entry) {
  const list = loadGalleryItems().filter((x) => !(x.url === entry.url && x.mediaUrl === entry.mediaUrl));
  list.unshift({
    url: entry.url,
    author: entry.author || "Spotify",
    title: entry.title || entry.url,
    thumbnail: entry.thumbnail || null,
    mediaUrl: entry.mediaUrl,
    mediaType: "audio",
    filename: entry.filename || `spotify_${Date.now().toString().slice(-6)}.mp3`,
    thumbFilename: "",
    downloadedAt: Date.now(),
  });
  try {
    localStorage.setItem(TT_HISTORY_KEY, JSON.stringify(list.slice(0, 30)));
    return true;
  } catch {
    return false;
  }
}

function markTrackDownloaded(idx, filename, thumbFilename) {
  const list = loadGalleryItems();
  if (!list[idx]) return false;
  const item = list[idx];
  item.filename = filename || item.filename;
  if (thumbFilename) item.thumbFilename = thumbFilename;
  item.offlineSaved = true;
  item.downloadedAt = Date.now();
  const reordered = [item, ...list.filter((_, i) => i !== idx)];
  try {
    localStorage.setItem(TT_HISTORY_KEY, JSON.stringify(reordered));
    return true;
  } catch {
    return false;
  }
}

async function downloadMusicTrack(track, onProgress) {
  if (!track?.mediaUrl) throw new Error("URL audio tidak tersedia");
  const apiBase = getApiBase();
  const safeName = (track.title || track.author || "blackpage_audio")
    .replace(/[^a-z0-9_-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "blackpage_audio";
  const filename = track.filename || `${safeName}.mp3`;
  const thumbFilename = track.thumbnail ? `thumb_${filename.replace(/\.[^.]+$/, "")}.jpg` : "";
  const res = await downloadMediaFile({
    API_BASE: apiBase,
    remoteUrl: track.mediaUrl,
    mediaType: "audio",
    filename,
    onProgress,
  });
  if (track.thumbnail && thumbFilename) {
    cacheOfflineThumb(apiBase, track.thumbnail, thumbFilename);
  }
  markTrackDownloaded(track.galleryIdx, filename, thumbFilename);
  return res;
}

const musicPlayer = createMusicPlayer({
  loadGalleryItems,
  renameGalleryItem,
  saveTrack: saveMusicTrack,
  downloadTrack: downloadMusicTrack,
  resolveOfflineMediaSrc,
  resolveOfflineThumbSrc,
  getApiBase,
  getLang,
  onStateChange: (snap) => {
    const cur = snap.track;
    const miniTrackId = cur ? `${cur.galleryIdx}|${snap.isOffline}` : "";
    const miniTitleText = cur ? (cur.title?.trim() || cur.author?.trim() || "Blackpage Music") : "";
    if (miniPlayerEl) {
      if (!cur) {
        lastMiniTrackKey = "";
        clearMiniTimers();
        miniPlayerEl.classList.remove("is-circle", "is-idle");
        musicPlayer.renderMiniPlayer(miniPlayerEl);
      } else if (miniTrackId !== lastMiniTrackKey || !miniPlayerEl.querySelector("#miniPlayBtn")) {
        lastMiniTrackKey = miniTrackId;
        musicPlayer.renderMiniPlayer(miniPlayerEl);
        expandMiniBanner();
      } else {
        const pct = snap.duration > 0 ? Math.min(100, (snap.currentTime / snap.duration) * 100) : 0;
        const bar = miniPlayerEl.querySelector(".bp-mini-progress");
        const playBtn = miniPlayerEl.querySelector("#miniPlayBtn");
        const titleEl = miniPlayerEl.querySelector("#miniOpenMusicBtn strong");
        const circleImg = miniPlayerEl.querySelector(".bp-mini-circle-img");
        const circleDot = miniPlayerEl.querySelector(".bp-mini-circle-dot");
        if (bar) bar.style.transform = `scaleX(${(pct / 100).toFixed(3)})`;
        if (playBtn) {
          playBtn.innerHTML = snap.isPlaying
            ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4.5" height="16" rx="1"/><rect x="13.5" y="4" width="4.5" height="16" rx="1"/></svg>`
            : `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6,4 20,12 6,20"/></svg>`;
        }
        if (titleEl && titleEl.textContent !== miniTitleText) titleEl.textContent = miniTitleText;
        if (circleImg) circleImg.classList.toggle("is-spinning", Boolean(snap.isPlaying));
        if (circleDot) {
          circleDot.innerHTML = snap.isPlaying
            ? `<svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="1" y="5" width="2" height="6" rx="1"/><rect x="5" y="2" width="2" height="9" rx="1"/><rect x="9" y="4" width="2" height="7" rx="1"/></svg>`
            : `<svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="2.5" y="2" width="2.5" height="8" rx="0.8"/><rect x="7" y="2" width="2.5" height="8" rx="0.8"/></svg>`;
        }
      }
    }

    if (activePage === "music") {
      const listEl = stageEl.querySelector("#musicPageRoot");
      if (!listEl) return;
      const tabKey = `${snap.currentIdx}|${cur?.title || ""}|${snap.isPlaying}|${snap.shuffle}|${snap.repeat}|${snap.hasBgPerm}|${snap.isOffline}|${snap.error}|${snap.tracks.length}`;
      if (tabKey !== lastTabRenderKey) {
        lastTabRenderKey = tabKey;
        listEl.innerHTML = musicPlayer.renderMusicTabHtml();
        musicPlayer.bindMusicTabEvents(listEl);
        bindThumbLoaders(listEl);
      } else {
        const seekInput = listEl.querySelector("#musicSeekInput");
        const curTimeEl = listEl.querySelector("#musicCurTime");
        const durTimeEl = listEl.querySelector("#musicDurTime");
        const pct = snap.duration > 0 ? Math.min(100, (snap.currentTime / snap.duration) * 100) : 0;
        if (seekInput && document.activeElement !== seekInput) {
          seekInput.value = String(Math.round(pct * 10));
        }
        if (curTimeEl) curTimeEl.textContent = musicPlayer.fmtTime(snap.currentTime);
        if (durTimeEl) durTimeEl.textContent = musicPlayer.fmtTime(snap.duration);
      }
    }
  },
});

if (miniPlayerEl) {
  let dragState = null;
  let suppressNextClick = false;

  miniPlayerEl.addEventListener("pointerdown", (e) => {
    if (!miniPlayerEl.classList.contains("is-circle")) return;
    const shell = miniPlayerEl.closest(".app-shell");
    if (!shell) return;
    const rect = miniPlayerEl.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    dragState = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left - shellRect.left,
      origY: rect.top - shellRect.top,
      maxX: Math.max(0, shellRect.width - rect.width - 8),
      maxY: Math.max(0, shellRect.height - rect.height - 8),
      moved: false,
    };
    miniPlayerEl.classList.add("is-dragging");
    miniPlayerEl.setPointerCapture?.(e.pointerId);
  });

  miniPlayerEl.addEventListener("pointermove", (e) => {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    if (!dragState.moved && Math.hypot(dx, dy) > 6) {
      dragState.moved = true;
    }
    if (!dragState.moved) return;
    const nextX = Math.max(8, Math.min(dragState.maxX, dragState.origX + dx));
    const nextY = Math.max(58, Math.min(dragState.maxY, dragState.origY + dy));
    miniCirclePos = { x: nextX, y: nextY };
    miniPlayerEl.classList.remove("is-idle");
    miniPlayerEl.style.left = `${nextX}px`;
    miniPlayerEl.style.top = `${nextY}px`;
  });

  const endDrag = (e) => {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    miniPlayerEl.classList.remove("is-dragging");
    if (dragState.moved) {
      suppressNextClick = true;
      setTimeout(() => {
        suppressNextClick = false;
      }, 60);
      scheduleMiniIdleFade();
    }
    dragState = null;
  };
  miniPlayerEl.addEventListener("pointerup", endDrag);
  miniPlayerEl.addEventListener("pointercancel", endDrag);

  miniPlayerEl.addEventListener("click", (e) => {
    if (suppressNextClick) return;
    if (miniPlayerEl.classList.contains("is-circle")) {
      expandMiniBanner();
      return;
    }
    if (e.target.closest("#miniPlayBtn")) {
      musicPlayer.togglePlay();
      scheduleMiniCollapse();
    } else if (e.target.closest("#miniNextBtn")) {
      musicPlayer.next();
      scheduleMiniCollapse();
    } else if (e.target.closest("#miniCloseBtn")) {
      if (miniCollapseTimer) clearTimeout(miniCollapseTimer);
      musicPlayer.stop();
      lastMiniTrackKey = "";
      miniPlayerEl.hidden = true;
      miniPlayerEl.innerHTML = "";
    } else if (e.target.closest("#miniOpenMusicBtn")) {
      renderMusicPage();
      scheduleMiniCollapse();
    }
  });
}

const bgEffects = createBgEffects(document.getElementById("bpBgCanvas"));
function applyBgEffectPref() {
  const p = getPrefs();
  bgEffects.setConfig({
    brightness: Number(p.bgBrightness) || 100,
    speed: Number(p.bgSpeed) || 100,
  });
  bgEffects.setMode(p.bgEffect || "none");
}
applyBgEffectPref();

function applyMotionPref() {
  document.documentElement.dataset.motion = getPrefs().reduceMotion ? "reduced" : "normal";
}

const TAB_ORDER = { home: 0, tools: 1, music: 2, gallery: 3, settings: 4 };
const isSubPage = (p) =>
  p === "comic" || p === "anime" || p.startsWith("tool:") || p.startsWith("gallery:") || p.startsWith("settings:");

function playPageEnter() {
  if (getPrefs().reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (typeof stageEl.animate !== "function") return;

  activeStageAnim?.cancel();
  const from = prevPage;
  const to = activePage;
  let fromTransform = "translate3d(0, 14px, 0) scale(0.985)";
  let duration = 260;

  if (isSubPage(to) && !isSubPage(from)) {
    fromTransform = "translate3d(0, 16px, 0) scale(0.965)";
    duration = 280;
  } else if (!isSubPage(to) && isSubPage(from)) {
    fromTransform = "translate3d(-18px, 0, 0) scale(1.015)";
    duration = 250;
  } else if (TAB_ORDER[from] !== undefined && TAB_ORDER[to] !== undefined && from !== to) {
    const dir = TAB_ORDER[to] > TAB_ORDER[from] ? 1 : -1;
    fromTransform = `translate3d(${dir * 26}px, 0, 0) scale(0.992)`;
  }

  activeStageAnim = stageEl.animate(
    [
      { opacity: 0, transform: fromTransform },
      { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
    ],
    { duration, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
  );
  prevPage = to;
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

const NAV_ICONS = {
  home: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-6h5v6"/></svg>`,
  tools: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1"/></svg>`,
  music: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>`,
  gallery: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1.5"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 15-4.5-4.5L7 20"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><circle cx="9" cy="6" r="2" fill="var(--surface)"/><line x1="4" y1="12" x2="20" y2="12"/><circle cx="15" cy="12" r="2" fill="var(--surface)"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="10" cy="18" r="2" fill="var(--surface)"/></svg>`,
};

const ANIME_NAV_ICONS = {
  ongoing: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg>`,
  search: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.5" y2="16.5"/></svg>`,
  downloads: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  history: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>`,
  exit: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
};

function renderNav() {
  if (activePage !== "home") {
    stageEl.classList.remove("home-stagger", "is-waiting", "is-entering");
  }

  if (activePage === "anime") {
    navEl.classList.add("is-anime-nav");
    navEl.innerHTML = `
      <button class="nav-btn ${animeNavTab === "ongoing" ? "active" : ""}" data-anime-nav="ongoing">
        ${ANIME_NAV_ICONS.ongoing}
        <span>Ongoing</span>
      </button>
      <button class="nav-btn ${animeNavTab === "search" ? "active" : ""}" data-anime-nav="search">
        ${ANIME_NAV_ICONS.search}
        <span>${getLang() === "en" ? "Search" : "Cari"}</span>
      </button>
      <button class="nav-btn ${animeNavTab === "downloads" ? "active" : ""}" data-anime-nav="downloads">
        ${ANIME_NAV_ICONS.downloads}
        <span>Download</span>
      </button>
      <button class="nav-btn ${animeNavTab === "history" ? "active" : ""}" data-anime-nav="history">
        ${ANIME_NAV_ICONS.history}
        <span>${getLang() === "en" ? "History" : "Riwayat"}</span>
      </button>
      <button class="nav-btn" data-anime-nav="exit">
        ${ANIME_NAV_ICONS.exit}
        <span>${getLang() === "en" ? "Exit" : "Keluar"}</span>
      </button>
    `;
    return;
  }

  navEl.classList.remove("is-anime-nav");
  const isHome = activePage === "home";
  const isTools = activePage === "tools" || activePage.startsWith("tool:");
  const isMusic = activePage === "music";
  const isGallery = activePage === "gallery" || activePage.startsWith("gallery:");
  const isSettings = activePage === "settings" || activePage.startsWith("settings:");

  navEl.innerHTML = `
    <button class="nav-btn ${isHome ? "active" : ""}" data-page="home">
      ${NAV_ICONS.home}
      <span>${escapeHtml(t("nav_home"))}</span>
    </button>
    <button class="nav-btn ${isTools ? "active" : ""}" data-page="tools">
      ${NAV_ICONS.tools}
      <span>${escapeHtml(t("nav_tools"))}</span>
    </button>
    <button class="nav-btn ${isMusic ? "active" : ""}" data-page="music">
      ${NAV_ICONS.music}
      <span>Music</span>
    </button>
    <button class="nav-btn ${isGallery ? "active" : ""}" data-page="gallery">
      ${NAV_ICONS.gallery}
      <span>${escapeHtml(t("nav_gallery"))}</span>
    </button>
    <button class="nav-btn ${isSettings ? "active" : ""}" data-page="settings">
      ${NAV_ICONS.settings}
      <span>${escapeHtml(t("nav_settings"))}</span>
    </button>
  `;
}

function renderToolCardsHtml(items) {
  return items
    .map(
      (tool, idx) => `
      <button
        type="button"
        class="tool-card tool-stagger-item ${tool.color || "card-white"}"
        style="--stagger-i:${idx};"
        data-open-tool="${tool.id}"
        ${tool.disabled ? "disabled" : ""}
      >
        <span class="tool-icon">${tool.icon || "OP"}</span>
        <div class="tool-card-body">
          <h3 class="tool-card-title">${escapeHtml(tool.shortName || tool.name)}</h3>
          ${tool.desc ? `<p class="tool-card-desc">${escapeHtml(tool.desc)}</p>` : ""}
        </div>
        ${tool.disabled ? `<span class="tag soon">${escapeHtml(tool.badge)}</span>` : `<span class="tool-arrow" aria-hidden="true">&rarr;</span>`}
      </button>
    `
    )
    .join("");
}

function renderToolsAreaHtml() {
  const q = searchQuery.trim().toLowerCase();
  if (q) {
    const matched = TOOLS.filter(
      (tool) =>
        tool.name.toLowerCase().includes(q) ||
        tool.category.toLowerCase().includes(q) ||
        (tool.desc || "").toLowerCase().includes(q)
    );
    if (!matched.length) {
      return `<div class="alert alert-info">Tidak ada tool untuk "${escapeHtml(searchQuery)}".</div>`;
    }
    return `<div class="tool-list">${renderToolCardsHtml(matched)}</div>`;
  }

  return `<div class="tool-cat-list">${TOOL_GROUPS.map((group) => {
    const items = TOOLS.filter((tool) => tool.category === group.id);
    const activeCount = items.filter((tool) => !tool.disabled).length;
    const isOpen = openToolGroup === group.id;
    return `
      <div class="tool-cat-wrap ${isOpen ? "is-open" : ""}">
        <button
          type="button"
          class="tool-card tool-cat-btn ${group.color}"
          data-toggle-cat="${escapeHtml(group.id)}"
          aria-expanded="${isOpen ? "true" : "false"}"
        >
          <span class="tool-icon">${group.icon}</span>
          <div class="tool-card-body">
            <h3 class="tool-card-title">${escapeHtml(group.label)}</h3>
            <p class="tool-card-desc">${escapeHtml(group.desc)}</p>
          </div>
          <div class="tool-cat-meta">
            <span class="tag">${activeCount} AKTIF</span>
            <span class="tool-cat-chevron" aria-hidden="true">&#9662;</span>
          </div>
        </button>
        ${isOpen ? `<div class="tool-cat-panel">${renderToolCardsHtml(items)}</div>` : ""}
      </div>
    `;
  }).join("")}</div>`;
}

function renderSupportDownloadersHtml() {
  return SUPPORT_DOWNLOADERS.map(
    (d, idx) => `
      <button type="button" class="tool-card support-card ${d.color}" style="--stagger-i:${idx};">
        <span class="tool-icon">${d.icon}</span>
        <div class="tool-card-body">
          <h3 class="tool-card-title">${escapeHtml(d.shortName)}</h3>
        </div>
      </button>
    `
  ).join("");
}

function pushRoute(page, fromPopstate = false) {
  if (!fromPopstate && history.state?.page !== page) {
    history.pushState(page === "comic" ? { page, comicView: "search" } : { page }, "");
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

    <button type="button" class="comic-hero-btn" id="openComicBtn">
      <span class="comic-hero-icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"><path d="M2 4h8a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2z"/><path d="M22 4h-8a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h9z"/></svg>
      </span>
      <span class="comic-hero-text">
        <strong>${getLang() === "en" ? "READ COMICS" : "BACA KOMIK"}</strong>
        <small>${getLang() === "en" ? "Manga, Manhwa &amp; Manhua Reader" : "Manga, Manhwa &amp; Manhua Sub Indo"}</small>
      </span>
      <span class="tag comic-hero-pill">${getLang() === "en" ? "OPEN &rarr;" : "BUKA &rarr;"}</span>
    </button>

    <button type="button" class="comic-hero-btn anime-hero-btn" id="openAnimeBtn">
      <span class="comic-hero-icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 4 20 12 6 20 6 4"/></svg>
      </span>
      <span class="comic-hero-text">
        <strong>${getLang() === "en" ? "WATCH ANIME" : "NONTON ANIME"}</strong>
        <small>${getLang() === "en" ? "Ongoing &amp; Sub Indo Streaming" : "Streaming Anime Sub Indo Terbaru"}</small>
      </span>
      <span class="tag comic-hero-pill">${getLang() === "en" ? "OPEN &rarr;" : "BUKA &rarr;"}</span>
    </button>

    <div class="panel-card">
      <div class="support-head" style="border-top:0;padding-top:0;">
        <div class="field-label" style="margin:0;">SUPPORT TOOLS</div>
        <span class="tag">${SUPPORT_DOWNLOADERS.length} ${getLang() === "en" ? "ACTIVE" : "AKTIF"}</span>
      </div>
      <div class="tool-list tool-grid-3">${renderSupportDownloadersHtml()}</div>
    </div>
  `;
  stageEl.classList.remove("home-stagger", "is-waiting", "is-entering");
  const shouldStagger =
    !hasPlayedHomeStagger &&
    !getPrefs().reduceMotion &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (shouldStagger) {
    hasPlayedHomeStagger = true;
    const introPending = Boolean(document.getElementById("bpIntro"));
    stageEl.classList.add("home-stagger", introPending ? "is-waiting" : "is-entering");
  } else {
    playPageEnter();
  }

  initUniversalBox(stageEl, { API_BASE: getApiBase(), escapeHtml, prefs: getPrefs() });
  stageEl.querySelector("#openComicBtn")?.addEventListener("click", () => mountComicPage());
  stageEl.querySelector("#openAnimeBtn")?.addEventListener("click", () => mountAnimePage());
}

function mountAnimePage(fromPopstate = false) {
  activePage = "anime";
  animeNavTab = "ongoing";
  pushRoute("anime", fromPopstate);
  renderNav();
  stageEl.classList.remove("stage-split");
  animeController = mountAnimeApp(stageEl, {
    API_BASE: getApiBase(),
    escapeHtml,
    upgradeVideoPlayer,
    onRouteChange: (v) => {
      if (v === "ongoing" || v === "search" || v === "downloads" || v === "history") {
        animeNavTab = v;
        renderNav();
      }
    },
    onExit: () => renderHome(),
  });
  playPageEnter();
}

function mountComicPage(fromPopstate = false) {
  activePage = "comic";
  pushRoute("comic", fromPopstate);
  renderNav();
  stageEl.classList.remove("stage-split");
  comicController = mountComicReader(stageEl, {
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

    <div id="toolList">${renderToolsAreaHtml()}</div>
  `;
  playPageEnter();

  const searchEl = stageEl.querySelector("#toolSearch");
  const listEl = stageEl.querySelector("#toolList");
  let closeTimer = null;
  let stageHeightAnim = null;

  function captureCatTops() {
    const map = new Map();
    listEl.querySelectorAll("[data-toggle-cat]").forEach((btn) => {
      map.set(btn.dataset.toggleCat, btn.getBoundingClientRect().top);
    });
    return map;
  }

  function applyCatFlip(beforeTops) {
    if (!beforeTops?.size) return;
    listEl.querySelectorAll("[data-toggle-cat]").forEach((btn) => {
      const prevTop = beforeTops.get(btn.dataset.toggleCat);
      if (prevTop === undefined || typeof btn.animate !== "function") return;
      const dy = prevTop - btn.getBoundingClientRect().top;
      if (Math.abs(dy) < 1) return;
      btn.animate(
        [
          { transform: `translate3d(0, ${dy}px, 0)` },
          { transform: "translate3d(0, 0, 0)" },
        ],
        { duration: 240, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
      );
    });
  }

  searchEl.addEventListener("input", (e) => {
    clearTimeout(closeTimer);
    searchQuery = e.target.value;
    listEl.innerHTML = renderToolsAreaHtml();
  });

  listEl.addEventListener("click", (e) => {
    const catBtn = e.target.closest("[data-toggle-cat]");
    if (!catBtn) return;
    clearTimeout(closeTimer);

    const catId = catBtn.dataset.toggleCat;
    const nextGroup = openToolGroup === catId ? null : catId;
    const openWrap = listEl.querySelector(".tool-cat-wrap.is-open");
    const reduce = getPrefs().reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const commitToggle = () => {
      const prevHeight = reduce ? 0 : stageEl.offsetHeight;
      const beforeTops = reduce ? null : captureCatTops();
      openToolGroup = nextGroup;
      listEl.innerHTML = renderToolsAreaHtml();
      if (!reduce) {
        applyCatFlip(beforeTops);
        const nextHeight = stageEl.offsetHeight;
        if (Math.abs(prevHeight - nextHeight) > 1 && typeof stageEl.animate === "function") {
          stageHeightAnim?.cancel();
          stageEl.style.overflow = "hidden";
          stageHeightAnim = stageEl.animate(
            [{ height: `${prevHeight}px` }, { height: `${nextHeight}px` }],
            { duration: 240, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
          );
          const clearOverflow = () => {
            stageEl.style.overflow = "";
          };
          stageHeightAnim.onfinish = clearOverflow;
          stageHeightAnim.oncancel = clearOverflow;
        }
      }
    };

    if (openWrap && !reduce) {
      const items = [...openWrap.querySelectorAll(".tool-stagger-item")];
      items.forEach((el, idx) => {
        el.style.setProperty("--exit-i", String(items.length - 1 - idx));
      });
      openWrap.classList.add("is-closing");
      const waitMs = Math.min(240, 165 + Math.max(0, items.length - 1) * 24);
      closeTimer = setTimeout(commitToggle, waitMs);
      return;
    }

    commitToggle();
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

function renderMusicPage(fromPopstate = false) {
  activePage = "music";
  pushRoute(activePage, fromPopstate);
  renderNav();
  stageEl.classList.remove("stage-split");
  lastTabRenderKey = "";

  stageEl.innerHTML = `
    <div class="stage-head">
      <div>
        <h2 class="stage-title">MUSIC</h2>
        <p class="stage-desc">${getLang() === "en" ? "Offline music library &amp; Spotify search." : "Pemutar musik offline &amp; pencarian lagu Spotify."}</p>
      </div>
    </div>
    <div id="musicPageRoot">${musicPlayer.renderMusicTabHtml()}</div>
  `;
  playPageEnter();

  const rootEl = stageEl.querySelector("#musicPageRoot");
  if (rootEl) {
    musicPlayer.bindMusicTabEvents(rootEl);
    bindThumbLoaders(rootEl);
  }
}

function renderGalleryFilterHtml(items = loadGalleryItems()) {
  const mediaItems = items.filter((x) => x.mediaType !== "audio");
  const fotoCount = mediaItems.filter((x) => x.mediaType === "image").length;
  const videoCount = mediaItems.filter((x) => x.mediaType !== "image").length;
  const tabs = [
    { id: "ALL", label: `SEMUA (${mediaItems.length})` },
    { id: "FOTO", label: `FOTO (${fotoCount})` },
    { id: "VIDEO", label: `VIDEO (${videoCount})` },
  ];
  const active = ["ALL", "FOTO", "VIDEO"].includes(galleryFilter) ? galleryFilter : "ALL";
  return tabs
    .map(
      (tab) => `
      <button
        type="button"
        class="cat-pill ${tab.id === active ? "active" : ""}"
        data-gfilter="${tab.id}"
      >
        ${tab.label}
      </button>
    `
    )
    .join("");
}

function renderGalleryItemsHtml(items) {
  const apiBase = getApiBase();
  const active = ["ALL", "FOTO", "VIDEO"].includes(galleryFilter) ? galleryFilter : "ALL";
  const indexed = items
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => {
      if (item.mediaType === "audio") return false;
      if (active === "FOTO") return item.mediaType === "image";
      if (active === "VIDEO") return item.mediaType !== "image";
      return true;
    });

  if (!indexed.length) {
    return `<div class="alert alert-info">Belum ada foto atau video tersimpan. Hasil download foto/video akan otomatis muncul di galeri ini.</div>`;
  }

  return `
    <div class="gallery-grid">
      ${indexed
      .map(({ item, idx }) => {
        const isImage = item.mediaType === "image";
        const rawThumb = item.thumbnail || (isImage ? item.mediaUrl : "");
        const thumbSrc = rawThumb
          ? `${apiBase}/api/media?${new URLSearchParams({ url: rawThumb }).toString()}`
          : "";
        const coverHtml = thumbSrc
          ? `<span class="gallery-thumb-wrap is-loading"><img class="gallery-thumb" data-thumb-idx="${idx}" src="${escapeHtml(thumbSrc)}" alt="Media" loading="lazy" /></span>`
          : `<span class="gallery-thumb gallery-thumb-fallback">${isImage ? "IMG" : "VID"}</span>`;
        const badgeHtml = isImage
          ? `<span class="gallery-grid-badge">FOTO</span>`
          : `<span class="gallery-grid-badge is-video" aria-label="Video">▶</span>`;

        return `
            <button type="button" class="gallery-grid-item" data-open-gallery="${idx}" title="${escapeHtml(item.title || item.author || "Media")}">
              ${coverHtml}
              ${badgeHtml}
              <span class="gallery-grid-cap">${escapeHtml(item.author || (isImage ? "Foto" : "Video"))}</span>
            </button>
          `;
      })
      .join("")}
    </div>
  `;
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
        <h2 class="stage-title">${escapeHtml(t("nav_gallery"))}</h2>
        <p class="stage-desc">${getLang() === "en" ? "Saved photos &amp; videos." : "Koleksi foto &amp; video tersimpan."}</p>
      </div>
      ${items.some((x) => x.mediaType !== "audio") ? `<button type="button" class="btn btn-sm" id="clearGalleryBtn">${getLang() === "en" ? "Clear" : "Bersihkan"}</button>` : ""}
    </div>

    <div class="cat-bar" id="galleryFilterBar">${renderGalleryFilterHtml(items)}</div>
    <div id="galleryList">${renderGalleryItemsHtml(items)}</div>
  `;
  playPageEnter();

  const filterBar = stageEl.querySelector("#galleryFilterBar");
  const listEl = stageEl.querySelector("#galleryList");
  const clearBtn = stageEl.querySelector("#clearGalleryBtn");
  bindThumbLoaders(listEl);
  const hydrateOfflineThumbs = (container) => {
    const apiBase = getApiBase();
    const allItems = loadGalleryItems();
    container.querySelectorAll("img.gallery-thumb[data-thumb-idx]").forEach((img) => {
      const it = allItems[Number(img.dataset.thumbIdx)];
      if (!it) return;
      resolveOfflineThumbSrc(apiBase, it).then((localThumb) => {
        if (localThumb && img.isConnected) img.src = localThumb;
      });
    });
  };
  hydrateOfflineThumbs(listEl);

  filterBar.addEventListener("click", (e) => {
    const pill = e.target.closest("[data-gfilter]");
    if (!pill) return;
    galleryFilter = pill.dataset.gfilter;
    const latest = loadGalleryItems();
    filterBar.innerHTML = renderGalleryFilterHtml(latest);
    listEl.innerHTML = renderGalleryItemsHtml(latest);
    bindThumbLoaders(listEl);
    hydrateOfflineThumbs(listEl);
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      const onlyMusic = loadGalleryItems().filter((x) => x.mediaType === "audio");
      localStorage.setItem(TT_HISTORY_KEY, JSON.stringify(onlyMusic));
      renderGallery();
    });
  }
}

async function resolveOfflineMediaSrc(item) {
  const cap = window.Capacitor;
  const fs = cap?.Plugins?.Filesystem;
  if (!cap?.isNativePlatform?.() || !fs || !item?.filename) return "";
  const subDir = item.mediaType === "audio" ? "audio" : item.mediaType === "image" ? "image" : "video";
  const path = `Download/Blackpage/${subDir}/${item.filename}`;
  try {
    await fs.stat({ path, directory: "EXTERNAL_STORAGE" });
    const res = await fs.getUri({ path, directory: "EXTERNAL_STORAGE" });
    const uri = res?.uri || "";
    if (!uri) return "";
    return typeof cap.convertFileSrc === "function" ? cap.convertFileSrc(uri) : uri;
  } catch {
    return "";
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
  const isImage = item.mediaType === "image";
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
      filename: item.filename || (isAudio ? "blackpage.mp3" : isImage ? "blackpage.jpg" : "blackpage.mp4"),
    }).toString()}`
    : "#";

  const playerHtml =
    mediaSrc && isImage
      ? `<img class="thumb" src="${escapeHtml(mediaSrc)}" alt="Foto" style="max-height:420px;object-fit:contain;background:var(--ink);" />`
      : mediaSrc && !isAudio
        ? `<div class="video-wrap is-loading" id="galVideoWrap">
            <div class="video-loader">MEMUAT VIDEO...</div>
            <video class="video-preview" src="${escapeHtml(mediaSrc)}" ${thumbSrc ? `poster="${escapeHtml(thumbSrc)}"` : ""} controls autoplay playsinline preload="auto"></video>
          </div>`
        : mediaSrc && isAudio
          ? `${thumbSrc ? `<img class="thumb" src="${escapeHtml(thumbSrc)}" alt="Sampul" />` : ""}<audio class="audio-preview" src="${escapeHtml(mediaSrc)}" controls preload="metadata"></audio>`
          : "";

  const hasCaption = Boolean(item.title && item.title.trim());

  const isEn = getLang() === "en";
  stageEl.innerHTML = `
    <div class="tool-topbar">
      <button type="button" class="btn btn-sm" data-page="${isAudio ? "music" : "gallery"}">${isAudio ? (isEn ? "← Back to Music" : "← Kembali ke Music") : (isEn ? "← Back to Gallery" : "← Kembali ke Galeri")}</button>
      <div style="display:flex;gap:6px;align-items:center;">
        <span class="tag" id="galOfflineTag" hidden>OFFLINE</span>
        <span class="tag">${isAudio ? "MP3" : isImage ? "FOTO" : "VIDEO"}</span>
      </div>
    </div>

    <article class="result-card">
      ${playerHtml}
      <div class="result-meta">
        <div class="author-row">
          <span class="author-avatar author-fallback">${isAudio ? "MP3" : isImage ? "IMG" : "VID"}</span>
          <div class="author-info">
            <h3>${escapeHtml(item.author || "Media")}</h3>
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
          <button type="button" class="btn" id="galDeleteBtn">${isAudio ? (isEn ? "Delete from Music" : "Hapus dari Music") : (isEn ? "Delete from Gallery" : "Hapus dari Galeri")}</button>
        </div>
      </div>
    </article>
  `;

  const videoWrap = stageEl.querySelector("#galVideoWrap");
  const videoEl = stageEl.querySelector("video.video-preview");
  const audioEl = stageEl.querySelector("audio.audio-preview");
  const offlineTag = stageEl.querySelector("#galOfflineTag");
  playPageEnter();
  if (videoEl) {
    const finishLoad = () => videoWrap && videoWrap.classList.remove("is-loading");
    videoEl.addEventListener("loadeddata", finishLoad, { once: true });
    videoEl.addEventListener("canplay", finishLoad, { once: true });
    videoEl.addEventListener("error", finishLoad, { once: true });
    videoEl.addEventListener("play", () => musicPlayer.pause());
    videoEl.play().catch(() => { });
  }
  if (audioEl) {
    audioEl.addEventListener("play", () => musicPlayer.pause());
  }

  resolveOfflineMediaSrc(item).then((localSrc) => {
    if (!localSrc || !stageEl.isConnected) return;
    const mediaEl = videoEl || audioEl;
    if (!mediaEl || !mediaEl.isConnected) return;
    if (offlineTag) offlineTag.hidden = false;
    mediaEl.src = localSrc;
    mediaEl.load?.();
    if (videoEl) videoEl.play?.().catch(() => { });
  });

  resolveOfflineThumbSrc(apiBase, item).then((localThumb) => {
    if (!localThumb || !stageEl.isConnected) return;
    const thumbImg = stageEl.querySelector(".result-card img.thumb");
    if (thumbImg) thumbImg.src = localThumb;
    if (videoEl) videoEl.poster = localThumb;
  });

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
    musicPlayer.refreshTracks();
    if (isAudio) renderMusicPage();
    else renderGallery();
  });
}

const SETTINGS_SECTIONS = [
  { id: "umum", num: "01", titleId: "UMUM", titleEn: "GENERAL", descId: "Bahasa aplikasi", descEn: "App language" },
  { id: "tampilan", num: "02", titleId: "TAMPILAN & RASA", titleEn: "APPEARANCE", descId: "Tema & kenyamanan visual", descEn: "Theme & visual comfort" },
  { id: "penyimpanan", num: "03", titleId: "PENYIMPANAN & UNDUHAN", titleEn: "STORAGE & DOWNLOADS", descId: "Folder download, galeri & cache", descEn: "Download folder, gallery & cache" },
  { id: "backup", num: "04", titleId: "CADANGKAN & PULIHKAN", titleEn: "BACKUP & RESTORE", descId: "Ekspor/impor data & cek server", descEn: "Export/import data & server check" },
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
      <span class="tag">V${APP_VERSION}</span>
    </div>
    <div class="tool-list">${menuHtml}</div>
  `;
  playPageEnter();
}

function getBgEffectLabel(mode) {
  const isEn = getLang() === "en";
  if (mode === "stars") return isEn ? "Constellation Stars" : "Bintang (Rasi)";
  if (mode === "rain") return isEn ? "Rain" : "Hujan";
  return isEn ? "Off" : "Mati";
}

function renderTampilanSettings() {
  const current = getThemeMode();
  const isEn = getLang() === "en";
  const prefs = getPrefs();
  const isSystem = current === "auto";
  const isDarkActive = isSystem
    ? Boolean(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches)
    : current === "dark";

  return `
    <div class="setting-group">
      <div class="field-label">${isEn ? "THEME" : "TEMA"}</div>
      <button type="button" class="toggle-row" id="darkModeToggleBtn" role="switch" aria-checked="${isDarkActive ? "true" : "false"}">
        <div class="toggle-text">
          <div class="theme-option-title">${isEn ? "Dark Mode" : "Mode Gelap"}</div>
          <div class="theme-option-sub">${isDarkActive ? (isEn ? "Dark theme active" : "Tema gelap aktif") : (isEn ? "Light theme active" : "Tema terang aktif")}</div>
        </div>
        <span class="toggle-switch ${isDarkActive ? "on" : ""}"><span class="toggle-knob"></span></span>
      </button>

      <button type="button" class="toggle-row" id="systemThemeToggleBtn" role="switch" aria-checked="${isSystem ? "true" : "false"}">
        <div class="toggle-text">
          <div class="theme-option-title">${isEn ? "Follow System" : "Gunakan Bawaan Sistem"}</div>
          <div class="theme-option-sub">${isEn ? "Match device light/dark mode" : "Ikuti mode terang/gelap perangkat"}</div>
        </div>
        <span class="toggle-switch ${isSystem ? "on" : ""}"><span class="toggle-knob"></span></span>
      </button>
    </div>

    <div class="setting-group">
      <div class="field-label">${isEn ? "BACKGROUND &amp; MOTION" : "LATAR &amp; ANIMASI"}</div>
      <button type="button" class="toggle-row" id="openBgEffectPageBtn">
        <div class="toggle-text">
          <div class="theme-option-title">${isEn ? "Animated Background" : "Latar Belakang Bergerak"}</div>
          <div class="theme-option-sub">${isEn ? "Active" : "Aktif"}: <strong>${escapeHtml(getBgEffectLabel(prefs.bgEffect))}</strong></div>
        </div>
        <span class="tool-arrow" aria-hidden="true">→</span>
      </button>

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

const BG_EFFECT_ICONS = {
  none: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><line x1="6.5" y1="6.5" x2="17.5" y2="17.5"/></svg>`,
  stars: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="16" r="1.8" fill="currentColor"/><circle cx="11" cy="7" r="1.8" fill="currentColor"/><circle cx="18" cy="14" r="1.8" fill="currentColor"/><circle cx="17" cy="6" r="1.4" fill="currentColor"/><path d="M6 16 L11 7 L18 14 M11 7 L17 6"/></svg>`,
  rain: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="7" y1="5" x2="5" y2="11"/><line x1="13" y1="4" x2="11" y2="10"/><line x1="18" y1="6" x2="16" y2="12"/><line x1="9" y1="13" x2="7" y2="19"/><line x1="15" y1="13" x2="13" y2="19"/></svg>`,
};

function renderBgEffectSettings(fromPopstate = false) {
  activePage = "settings:tampilan:bg";
  pushRoute(activePage, fromPopstate);
  renderNav();
  stageEl.classList.remove("stage-split");

  const isEn = getLang() === "en";
  const prefs = getPrefs();
  const current = prefs.bgEffect || "none";
  const brightness = Number(prefs.bgBrightness) || 100;
  const speed = Number(prefs.bgSpeed) || 100;
  const options = [
    { id: "none", title: isEn ? "Off" : "Mati" },
    { id: "stars", title: isEn ? "Constellation Stars" : "Bintang" },
    { id: "rain", title: isEn ? "Rain" : "Hujan" },
  ];

  const isDisabled = current === "none";

  stageEl.innerHTML = `
    <div class="tool-topbar">
      <button type="button" class="btn btn-sm" id="backToTampilanBtn">${isEn ? "← Back to Appearance" : "← Kembali ke Tampilan"}</button>
      <span class="tag">${isEn ? "BACKGROUND" : "LATAR"}</span>
    </div>

    <div class="stage-head" style="margin-bottom:12px;">
      <div>
        <h2 class="stage-title">${isEn ? "ANIMATED BACKGROUND" : "LATAR BELAKANG BERGERAK"}</h2>
      </div>
    </div>

    <div class="bp-bg-bento" id="bgEffectOptions">
      ${options
      .map(
        (o, idx) => `
          <button type="button" class="bp-bg-bento-card ${current === o.id ? "active" : ""}" style="--i:${idx}" data-set-bg="${o.id}">
            <span class="bp-bg-bento-icon">${BG_EFFECT_ICONS[o.id]}</span>
            <strong class="bp-bg-bento-title">${escapeHtml(o.title)}</strong>
            <span class="tag">${current === o.id ? (isEn ? "ACTIVE" : "AKTIF") : (isEn ? "SELECT" : "PILIH")}</span>
          </button>
        `
      )
      .join("")}
    </div>

    ${isDisabled
      ? `<div class="bp-bg-warn">${isEn ? "Enable an animated background first (Stars or Rain) to adjust brightness &amp; speed." : "Aktifkan animasi latar belakang terlebih dahulu untuk mengatur kecerahan &amp; kecepatan."}</div>`
      : ""}

    <div class="bp-bg-sliders ${isDisabled ? "is-disabled" : ""}">
      <div class="bp-bg-slider-row">
        <div class="bp-bg-slider-head">
          <span>${isEn ? "Brightness" : "Kecerahan"}</span>
          <strong class="tag" id="bgBrightVal">${brightness}%</strong>
        </div>
        <input type="range" class="bp-music-seek" id="bgBrightSlider" min="20" max="200" step="5" value="${brightness}" ${isDisabled ? "disabled" : ""} aria-label="${isEn ? "Brightness" : "Kecerahan"}" />
      </div>

      <div class="bp-bg-slider-row">
        <div class="bp-bg-slider-head">
          <span>${isEn ? "Speed" : "Kecepatan"}</span>
          <strong class="tag" id="bgSpeedVal">${speed}%</strong>
        </div>
        <input type="range" class="bp-music-seek" id="bgSpeedSlider" min="20" max="200" step="5" value="${speed}" ${isDisabled ? "disabled" : ""} aria-label="${isEn ? "Speed" : "Kecepatan"}" />
      </div>
    </div>
  `;
  playPageEnter();

  stageEl.querySelector("#backToTampilanBtn")?.addEventListener("click", () => renderSettingDetail("tampilan"));
  stageEl.querySelector("#bgEffectOptions")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-set-bg]");
    if (!btn) return;
    const p = getPrefs();
    p.bgEffect = btn.dataset.setBg;
    savePrefs(p);
    applyBgEffectPref();
    renderBgEffectSettings(true);
  });

  const brightSlider = stageEl.querySelector("#bgBrightSlider");
  const brightVal = stageEl.querySelector("#bgBrightVal");
  if (brightSlider) {
    brightSlider.addEventListener("input", () => {
      const val = Number(brightSlider.value);
      if (brightVal) brightVal.textContent = `${val}%`;
      const p = getPrefs();
      p.bgBrightness = val;
      savePrefs(p);
      applyBgEffectPref();
    });
  }

  const speedSlider = stageEl.querySelector("#bgSpeedSlider");
  const speedVal = stageEl.querySelector("#bgSpeedVal");
  if (speedSlider) {
    speedSlider.addEventListener("input", () => {
      const val = Number(speedSlider.value);
      if (speedVal) speedVal.textContent = `${val}%`;
      const p = getPrefs();
      p.bgSpeed = val;
      savePrefs(p);
      applyBgEffectPref();
    });
  }
}

function getMaxRetryLabel(val, isEn) {
  const n = Number(val) || 3;
  if (n === 1) return isEn ? "1 (no retry)" : "1 (tanpa ulang)";
  return isEn ? `${n} attempts` : `${n} percobaan`;
}

function renderPenyimpananSettings() {
  const isEn = getLang() === "en";
  const prefs = getPrefs();
  const items = loadGalleryItems();
  const videoCount = items.filter((x) => x.mediaType !== "audio").length;
  const audioCount = items.filter((x) => x.mediaType === "audio").length;
  const bytes = new Blob([localStorage.getItem(TT_HISTORY_KEY) || ""]).size;
  const kb = (bytes / 1024).toFixed(1);
  const videoFolder = prefs.videoFolder || "Download/Blackpage/video";
  const audioFolder = prefs.audioFolder || "Download/Blackpage/audio";

  return `
    <div class="setting-group">
      <div class="field-label">${isEn ? "DOWNLOAD FOLDERS" : "LOKASI UNDUHAN"}</div>
      <button type="button" class="toggle-row" id="openDownloadLocBtn">
        <div class="toggle-text">
          <div class="theme-option-title">${isEn ? "Download Location" : "Lokasi Unduhan"}</div>
          <div class="theme-option-sub">Video: <code>${escapeHtml(videoFolder)}</code></div>
          <div class="theme-option-sub">Audio: <code>${escapeHtml(audioFolder)}</code></div>
        </div>
        <span class="tool-arrow" aria-hidden="true">→</span>
      </button>
    </div>

    <div class="setting-group">
      <div class="field-label">AUTO-RETRY DOWNLOAD</div>
      <button type="button" class="toggle-row" id="autoRetryToggleBtn" role="switch" aria-checked="${prefs.autoRetry !== false ? "true" : "false"}">
        <div class="toggle-text">
          <div class="theme-option-title">Auto-Retry Download</div>
          <div class="theme-option-sub">${isEn ? "Retry automatically if download fails" : "Ulangi otomatis jika unduhan gagal"}</div>
        </div>
        <span class="toggle-switch ${prefs.autoRetry !== false ? "on" : ""}"><span class="toggle-knob"></span></span>
      </button>

      <button type="button" class="toggle-row" id="openMaxRetryBtn">
        <div class="toggle-text">
          <div class="theme-option-title">${isEn ? "MAX RETRIES" : "MAKS PERCOBAAN ULANG"}</div>
          <div class="theme-option-sub">${escapeHtml(getMaxRetryLabel(prefs.maxRetry, isEn))}</div>
        </div>
        <span class="tag">${Number(prefs.maxRetry) || 3}X</span>
      </button>
    </div>

    <div class="setting-group">
      <div class="field-label">${isEn ? "GALLERY &amp; DATA" : "GALERI &amp; DATA"}</div>
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

      <div class="bp-storage-actions">
        <button type="button" class="toggle-row" id="clearStorageGalBtn" ${items.length ? "" : "disabled"}>
          <div class="toggle-text">
            <div class="theme-option-title">${isEn ? "Clear Cache" : "Hapus Cache"}</div>
            <div class="theme-option-sub">${isEn ? "Clear saved gallery history" : "Bersihkan riwayat cache galeri"}</div>
          </div>
          <span class="tag bp-tag-danger">${isEn ? "CLEAR" : "BERSIHKAN"}</span>
        </button>

        <button type="button" class="toggle-row" id="resetAllDataBtn">
          <div class="toggle-text">
            <div class="theme-option-title">${isEn ? "Delete All Data" : "Hapus Semua Data"}</div>
            <div class="theme-option-sub">${isEn ? "Reset all settings, theme &amp; gallery" : "Reset semua pengaturan, tema &amp; galeri"}</div>
          </div>
          <span class="tag bp-tag-danger">RESET</span>
        </button>
      </div>
    </div>
  `;
}

function renderBackupSettings() {
  const isEn = getLang() === "en";
  const items = loadGalleryItems();
  return `
    <div class="setting-group">
      <div class="field-label">${isEn ? "DATA BACKUP" : "CADANGKAN DATA"}</div>
      <div class="alert alert-info path-info" style="margin-bottom:10px;">
        ${isEn
      ? `Back up your ${items.length} saved Music &amp; Gallery items, custom titles, and app preferences to a JSON file.`
      : `Simpan ${items.length} item Music &amp; Galeri, judul kustom, dan semua pengaturan aplikasi ke file JSON.`}
      </div>
      <div class="bp-storage-actions">
        <button type="button" class="btn btn-primary" id="exportBackupBtn">
          ${isEn ? "Export Backup (.json)" : "Ekspor Backup (.json)"}
        </button>
        <label class="btn" style="text-align:center;cursor:pointer;">
          ${isEn ? "Import / Restore (.json)" : "Impor / Pulihkan (.json)"}
          <input type="file" id="importBackupInput" accept="application/json,.json" hidden />
        </label>
      </div>
    </div>

    <div class="setting-group" style="margin-top:14px;">
      <div class="field-label">${isEn ? "CONNECTION" : "KONEKSI SERVER"}</div>
      <button type="button" class="btn" id="pingApiBtn">${isEn ? "Test Server Latency" : "Tes Kecepatan Server"}</button>
    </div>

    <div id="backupFeedback" style="margin-top:10px;"></div>
  `;
}

const ABOUT_ICONS = {
  version: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 2.5"/></svg>`,
  platform: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2"/><line x1="10" y1="18" x2="14" y2="18"/></svg>`,
  about: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none"/></svg>`,
  guide: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5Z"/><path d="M4 5.5v16"/></svg>`,
  github: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.18-3.37-1.18-.45-1.15-1.11-1.46-1.11-1.46-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.35 1.08 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 6.84c.85 0 1.71.11 2.51.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.85-2.34 4.7-4.57 4.95.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>`,
};

function renderTentangSettings() {
  const isEn = getLang() === "en";
  const isApk = Boolean(window.Capacitor?.isNativePlatform?.());
  const releaseUrl = `https://github.com/${GITHUB_REPO}/releases/latest`;
  const repoUrl = `https://github.com/${GITHUB_REPO}`;

  return `
    <div class="setting-group">
      <div class="bp-about-list">
        <div class="bp-about-row">
          <div class="bp-about-left">
            <span class="bp-about-icon">${ABOUT_ICONS.version}</span>
            <div class="bp-about-text">
              <strong>${isEn ? "VERSION" : "VERSI"}</strong>
              <span>v${APP_VERSION}</span>
            </div>
          </div>
          <button type="button" class="btn btn-sm bp-about-cek-btn" id="checkUpdateBtn">${isEn ? "CHECK" : "CEK"}</button>
        </div>

        <div id="updateStatusBox"></div>

        <div class="bp-about-row">
          <div class="bp-about-left">
            <span class="bp-about-icon">${ABOUT_ICONS.platform}</span>
            <div class="bp-about-text">
              <strong>PLATFORM</strong>
              <span>${isApk ? "Android (APK)" : (isEn ? "Website — Install the Android APK for full offline mode!" : "Website — Install aplikasi Android untuk fitur offline penuh!")}</span>
            </div>
          </div>
          ${!isApk ? `<a class="tag bp-tag-danger" href="${escapeHtml(releaseUrl)}" target="_blank" rel="noopener">INSTALL</a>` : `<span class="tag">APK</span>`}
        </div>

        <button type="button" class="bp-about-row is-clickable" id="openAboutDescBtn">
          <div class="bp-about-left">
            <span class="bp-about-icon">${ABOUT_ICONS.about}</span>
            <div class="bp-about-text">
              <strong>${isEn ? "ABOUT BLACKPAGE" : "TENTANG BLACKPAGE"}</strong>
            </div>
          </div>
          <span class="tag">${isEn ? "VIEW" : "LIHAT"}</span>
        </button>

        <button type="button" class="bp-about-row is-clickable" id="openAboutGuideBtn">
          <div class="bp-about-left">
            <span class="bp-about-icon">${ABOUT_ICONS.guide}</span>
            <div class="bp-about-text">
              <strong>${isEn ? "HOW TO USE" : "CARA PENGGUNAAN"}</strong>
            </div>
          </div>
          <span class="tag">${isEn ? "VIEW" : "LIHAT"}</span>
        </button>
      </div>
    </div>

    <div class="setting-group" style="margin-top:16px;">
      <div class="field-label">${isEn ? "COMMUNITY" : "KOMUNITAS"}</div>
      <a class="bp-about-row is-clickable" href="${escapeHtml(repoUrl)}" target="_blank" rel="noopener" style="text-decoration:none;">
        <div class="bp-about-left">
          <span class="bp-about-icon">${ABOUT_ICONS.github}</span>
          <div class="bp-about-text">
            <strong>GitHub — Ricardo169zzz</strong>
            <span>${escapeHtml(repoUrl)}</span>
          </div>
        </div>
        <span class="tool-arrow" aria-hidden="true">→</span>
      </a>
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

function showLanguageRestartModal(nextLang, onDone) {
  document.querySelector("#bpLangModal")?.remove();
  const toEn = nextLang === "en";
  const isUiEn = getLang() === "en";
  const host = document.querySelector(".app-shell") || document.body;
  const modal = document.createElement("div");
  modal.id = "bpLangModal";
  modal.className = "comic-modal-backdrop";
  modal.innerHTML = `
    <div class="comic-modal-card" role="dialog" aria-modal="true" aria-labelledby="bpLangTitle">
      <div class="stage-head" style="margin-bottom:8px;">
        <h3 id="bpLangTitle" style="margin:0;font-size:0.95rem;">${toEn ? "SWITCH TO ENGLISH" : "UBAH KE BAHASA INDONESIA"}</h3>
        <span class="tag">${toEn ? "EN" : "ID"}</span>
      </div>
      <p class="stage-desc" style="margin:0 0 12px;line-height:1.45;">
        ${toEn
      ? "Restart the app to apply English across all menus &amp; pages."
      : "Restart aplikasi agar Bahasa Indonesia diterapkan penuh di semua menu &amp; halaman."
    }
      </p>
      <label class="comic-modal-check">
        <input type="checkbox" id="langComicServerCheck" />
        <span class="comic-check-box" aria-hidden="true"></span>
        <span>${toEn
      ? "Also switch Comic/Anime server to English (MangaDex EN)"
      : "Ubah juga server Komik/Anime ke Bahasa Indonesia (Auto)"
    }</span>
      </label>
      <div id="langModalActions" style="display:grid;grid-template-columns:1fr;gap:8px;margin-top:14px;">
        <button type="button" class="btn btn-primary" id="langRestartLater" style="transform-origin:left center;">${isUiEn ? "Done" : "Selesai"}</button>
        <button type="button" class="btn btn-primary" id="langRestartNow" hidden>${isUiEn ? "Restart Now" : "Restart Sekarang"}</button>
      </div>
    </div>
  `;

  const actionsEl = modal.querySelector("#langModalActions");
  const chkEl = modal.querySelector("#langComicServerCheck");
  const laterBtn = modal.querySelector("#langRestartLater");
  const nowBtn = modal.querySelector("#langRestartNow");
  let hideNowTimer = null;

  chkEl?.addEventListener("change", () => {
    clearTimeout(hideNowTimer);
    const checked = chkEl.checked;
    const reduce = getPrefs().reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const prevRect = !reduce ? laterBtn.getBoundingClientRect() : null;

    if (checked) {
      actionsEl.style.gridTemplateColumns = "1fr 1fr";
      laterBtn.className = "btn";
      laterBtn.textContent = isUiEn ? "Later" : "Nanti";
      nowBtn.hidden = false;

      if (!reduce && typeof laterBtn.animate === "function") {
        const nextRect = laterBtn.getBoundingClientRect();
        const sx = prevRect && nextRect.width ? prevRect.width / nextRect.width : 1;
        laterBtn.animate(
          [
            { opacity: 0.72, transform: `scaleX(${sx})` },
            { opacity: 1, transform: "scaleX(1)" },
          ],
          { duration: 240, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
        );
        nowBtn.animate(
          [
            { opacity: 0, transform: "translate3d(16px, 0, 0) scale(0.94)" },
            { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
          ],
          { duration: 240, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
        );
      }
      return;
    }

    const collapseToDone = () => {
      const beforeRect = !reduce ? laterBtn.getBoundingClientRect() : null;
      nowBtn.hidden = true;
      actionsEl.style.gridTemplateColumns = "1fr";
      laterBtn.className = "btn btn-primary";
      laterBtn.textContent = isUiEn ? "Done" : "Selesai";

      if (!reduce && beforeRect && typeof laterBtn.animate === "function") {
        const afterRect = laterBtn.getBoundingClientRect();
        const sx = afterRect.width ? beforeRect.width / afterRect.width : 1;
        laterBtn.animate(
          [
            { opacity: 0.78, transform: `scaleX(${sx})` },
            { opacity: 1, transform: "scaleX(1)" },
          ],
          { duration: 240, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
        );
      }
    };

    if (!reduce && !nowBtn.hidden && typeof nowBtn.animate === "function") {
      nowBtn.animate(
        [
          { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
          { opacity: 0, transform: "translate3d(14px, 0, 0) scale(0.94)" },
        ],
        { duration: 160, easing: "cubic-bezier(0.4, 0, 1, 1)" }
      );
      hideNowTimer = setTimeout(collapseToDone, 150);
    } else {
      collapseToDone();
    }
  });

  const applyChoice = () => {
    localStorage.setItem(LANG_KEY, nextLang);
    if (chkEl?.checked) {
      localStorage.setItem("blackpage_comic_lang_v1", nextLang);
      localStorage.setItem("blackpage_comic_server_v1", nextLang === "en" ? "mangadex" : "auto");
    }
  };

  modal.querySelector("#langRestartLater")?.addEventListener("click", () => {
    applyChoice();
    modal.remove();
    onDone?.();
  });
  modal.querySelector("#langRestartNow")?.addEventListener("click", () => {
    applyChoice();
    window.location.reload();
  });
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
  host.appendChild(modal);
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
          : section.id === "backup"
            ? renderBackupSettings()
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

  const darkModeToggleBtn = stageEl.querySelector("#darkModeToggleBtn");
  if (darkModeToggleBtn) {
    darkModeToggleBtn.addEventListener("click", () => {
      const cur = getThemeMode();
      const sysDark = Boolean(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
      const isCurrentlyDark = cur === "auto" ? sysDark : cur === "dark";
      const next = isCurrentlyDark ? "light" : "dark";
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
      renderSettingDetail("tampilan", true);
    });
  }

  const systemThemeToggleBtn = stageEl.querySelector("#systemThemeToggleBtn");
  if (systemThemeToggleBtn) {
    systemThemeToggleBtn.addEventListener("click", () => {
      const cur = getThemeMode();
      let next = "auto";
      if (cur === "auto") {
        const sysDark = Boolean(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
        next = sysDark ? "dark" : "light";
      }
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
      renderSettingDetail("tampilan", true);
    });
  }

  const openBgBtn = stageEl.querySelector("#openBgEffectPageBtn");
  if (openBgBtn) {
    openBgBtn.addEventListener("click", () => renderBgEffectSettings());
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
    const openLocBtn = stageEl.querySelector("#openDownloadLocBtn");
    const autoRetryBtn = stageEl.querySelector("#autoRetryToggleBtn");
    const openRetryBtn = stageEl.querySelector("#openMaxRetryBtn");
    const autoSaveBtn = stageEl.querySelector("#autoSaveGalBtn");
    const clearBtn = stageEl.querySelector("#clearStorageGalBtn");
    const resetAllBtn = stageEl.querySelector("#resetAllDataBtn");

    openLocBtn?.addEventListener("click", () => {
      if (document.querySelector("#bpDownloadLocModal")) return;
      const isEn = getLang() === "en";
      const prefs = getPrefs();
      let activeKind = "video";
      let draftVideo = prefs.videoFolder || "Download/Blackpage/video";
      let draftAudio = prefs.audioFolder || "Download/Blackpage/audio";

      const videoPresets = [
        "Download/Blackpage/video",
        "Movies/Blackpage",
        "DCIM/Blackpage",
        "Download",
      ];
      const audioPresets = [
        "Download/Blackpage/audio",
        "Music/Blackpage",
      ];

      const host = document.querySelector(".app-shell") || document.body;
      const el = document.createElement("div");
      el.id = "bpDownloadLocModal";
      el.className = "bp-modal-backdrop";

      const renderLocModal = () => {
        const presets = activeKind === "video" ? videoPresets : audioPresets;
        const curVal = activeKind === "video" ? draftVideo : draftAudio;
        const isCustom = !presets.includes(curVal);
        el.innerHTML = `
          <div class="bp-modal-card bp-sp-modal-card">
            <div class="bp-modal-head">
              <span class="tag">${isEn ? "DOWNLOAD LOCATION" : "LOKASI UNDUHAN"}</span>
              <button type="button" class="btn btn-sm" id="locCloseBtn">✕</button>
            </div>

            <div class="bp-loc-targets">
              <button type="button" class="bp-loc-target ${activeKind === "video" ? "active" : ""}" data-loc-kind="video">
                <strong>${isEn ? "Default Video Location" : "Lokasi Bawaan Video"}</strong>
                <span>${escapeHtml(draftVideo)}</span>
              </button>
              <button type="button" class="bp-loc-target ${activeKind === "audio" ? "active" : ""}" data-loc-kind="audio">
                <strong>${isEn ? "Default Audio Location" : "Lokasi Bawaan Audio"}</strong>
                <span>${escapeHtml(draftAudio)}</span>
              </button>
            </div>

            <div class="field-label" style="margin-top:12px;">${isEn ? "QUICK PRESETS" : "SARAN LOKASI"}</div>
            <div class="bp-loc-presets">
              ${presets
            .map(
              (p, i) => `
                  <button type="button" class="bp-loc-preset-btn ${curVal === p ? "active" : ""}" data-loc-preset="${escapeHtml(p)}">
                    <span>${i + 1}. ${escapeHtml(p)}</span>
                    ${curVal === p ? `<span class="tag">${isEn ? "ACTIVE" : "AKTIF"}</span>` : ""}
                  </button>
                `
            )
            .join("")}
              <button type="button" class="bp-loc-preset-btn ${isCustom ? "active" : ""}" id="locPickFolderBtn">
                <span>${presets.length + 1}. ${isEn ? "Choose folder" : "Pilih folder"}</span>
                ${isCustom ? `<span class="tag">${isEn ? "CUSTOM" : "KUSTOM"}</span>` : ""}
              </button>
            </div>

            <div id="locCustomWrap" style="margin-top:8px;${isCustom ? "" : "display:none;"}">
              <input type="text" class="brutal-input" id="locCustomInput" value="${escapeHtml(curVal)}" placeholder="Download/Blackpage/..." />
            </div>

            <div class="bp-loc-footer">
              <button type="button" class="btn" id="locCancelBtn">${isEn ? "Cancel" : "Batal"}</button>
              <button type="button" class="btn btn-primary" id="locSaveBtn">${isEn ? "Save" : "Simpan"}</button>
            </div>
          </div>
        `;

        el.querySelector("#locCloseBtn")?.addEventListener("click", () => el.remove());
        el.querySelector("#locCancelBtn")?.addEventListener("click", () => el.remove());
        el.querySelectorAll("[data-loc-kind]").forEach((btn) => {
          btn.addEventListener("click", () => {
            activeKind = btn.dataset.locKind;
            renderLocModal();
          });
        });
        el.querySelectorAll("[data-loc-preset]").forEach((btn) => {
          btn.addEventListener("click", () => {
            if (activeKind === "video") draftVideo = btn.dataset.locPreset;
            else draftAudio = btn.dataset.locPreset;
            renderLocModal();
          });
        });
        el.querySelector("#locPickFolderBtn")?.addEventListener("click", async () => {
          const wrap = el.querySelector("#locCustomWrap");
          const inp = el.querySelector("#locCustomInput");
          if (wrap) wrap.style.display = "block";
          if (typeof window.showDirectoryPicker === "function") {
            try {
              const dirHandle = await window.showDirectoryPicker();
              if (dirHandle?.name) {
                if (activeKind === "video") draftVideo = dirHandle.name;
                else draftAudio = dirHandle.name;
                renderLocModal();
                return;
              }
            } catch { }
          }
          inp?.focus();
        });
        el.querySelector("#locCustomInput")?.addEventListener("input", (ev) => {
          const val = ev.target.value.trim();
          if (activeKind === "video") draftVideo = val || "Download/Blackpage/video";
          else draftAudio = val || "Download/Blackpage/audio";
        });
        el.querySelector("#locSaveBtn")?.addEventListener("click", () => {
          const p = getPrefs();
          p.videoFolder = (draftVideo || "Download/Blackpage/video").replace(/^\/+|\/+$/g, "");
          p.audioFolder = (draftAudio || "Download/Blackpage/audio").replace(/^\/+|\/+$/g, "");
          savePrefs(p);
          el.remove();
          renderSettingDetail("penyimpanan", true);
        });
      };

      host.appendChild(el);
      renderLocModal();
      el.addEventListener("click", (e) => {
        if (e.target === el) el.remove();
      });
    });

    autoRetryBtn?.addEventListener("click", () => {
      const p = getPrefs();
      p.autoRetry = p.autoRetry === false ? true : false;
      savePrefs(p);
      renderSettingDetail("penyimpanan", true);
    });

    openRetryBtn?.addEventListener("click", () => {
      if (document.querySelector("#bpMaxRetryModal")) return;
      const isEn = getLang() === "en";
      const cur = Number(getPrefs().maxRetry) || 3;
      const opts = [
        { val: 1, label: isEn ? "1. 1 (no retry)" : "1. 1 (tanpa ulang)" },
        { val: 2, label: isEn ? "2. 2 attempts" : "2. 2 percobaan" },
        { val: 3, label: isEn ? "3. 3 attempts" : "3. 3 percobaan" },
        { val: 5, label: isEn ? "4. 5 attempts" : "4. 5 percobaan" },
      ];
      const host = document.querySelector(".app-shell") || document.body;
      const el = document.createElement("div");
      el.id = "bpMaxRetryModal";
      el.className = "bp-modal-backdrop";
      el.innerHTML = `
        <div class="bp-modal-card">
          <div class="bp-modal-head">
            <span class="tag">${isEn ? "MAX RETRIES" : "MAKS PERCOBAAN ULANG"}</span>
            <button type="button" class="btn btn-sm" id="retryCloseBtn">✕</button>
          </div>
          <div class="bp-loc-presets">
            ${opts
          .map(
            (o) => `
                <button type="button" class="bp-loc-preset-btn ${cur === o.val ? "active" : ""}" data-set-retry="${o.val}">
                  <span>${escapeHtml(o.label)}</span>
                  ${cur === o.val ? `<span class="tag">${isEn ? "ACTIVE" : "AKTIF"}</span>` : ""}
                </button>
              `
          )
          .join("")}
          </div>
        </div>
      `;
      host.appendChild(el);
      el.querySelector("#retryCloseBtn")?.addEventListener("click", () => el.remove());
      el.addEventListener("click", (e) => {
        if (e.target === el) el.remove();
      });
      el.querySelectorAll("[data-set-retry]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const p = getPrefs();
          p.maxRetry = Number(btn.dataset.setRetry);
          savePrefs(p);
          el.remove();
          renderSettingDetail("penyimpanan", true);
        });
      });
    });

    autoSaveBtn?.addEventListener("click", () => {
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
    resetAllBtn?.addEventListener("click", () => {
      localStorage.removeItem(TT_HISTORY_KEY);
      localStorage.removeItem(PREFS_KEY);
      localStorage.removeItem(THEME_KEY);
      localStorage.removeItem(API_BASE_KEY);
      applyTheme("auto");
      applyMotionPref();
      applyBgEffectPref();
      renderSettingDetail("penyimpanan", true);
    });
  }

  if (section.id === "backup") {
    const isEn = getLang() === "en";
    const exportBtn = stageEl.querySelector("#exportBackupBtn");
    const importInput = stageEl.querySelector("#importBackupInput");
    const pingBtn = stageEl.querySelector("#pingApiBtn");
    const feedback = stageEl.querySelector("#backupFeedback");

    exportBtn?.addEventListener("click", async () => {
      const payload = {
        app: "Blackpage",
        version: APP_VERSION,
        exportedAt: new Date().toISOString(),
        history: loadGalleryItems(),
        prefs: getPrefs(),
        theme: getThemeMode(),
        lang: getLang(),
      };
      const jsonStr = JSON.stringify(payload, null, 2);
      const filename = `blackpage-backup-${new Date().toISOString().slice(0, 10)}.json`;
      try {
        const cap = window.Capacitor;
        const fs = cap?.Plugins?.Filesystem;
        if (cap?.isNativePlatform?.() && fs) {
          await fs.mkdir({ path: "Download/Blackpage", directory: "EXTERNAL_STORAGE", recursive: true }).catch(() => { });
          const b64 = btoa(unescape(encodeURIComponent(jsonStr)));
          await fs.writeFile({
            path: `Download/Blackpage/${filename}`,
            data: b64,
            directory: "EXTERNAL_STORAGE",
            recursive: true,
          });
          feedback.innerHTML = `<div class="alert alert-info">${isEn ? "Saved to" : "Tersimpan di"} Download/Blackpage/${escapeHtml(filename)}</div>`;
        } else {
          const blob = new Blob([jsonStr], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 10000);
          feedback.innerHTML = `<div class="alert alert-info">${isEn ? "Backup file downloaded!" : "File backup berhasil diunduh!"}</div>`;
        }
      } catch (err) {
        feedback.innerHTML = `<div class="alert alert-error">${escapeHtml(err?.message || "Gagal ekspor backup.")}</div>`;
      }
    });

    importInput?.addEventListener("change", async () => {
      const file = importInput.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data || typeof data !== "object" || data.app !== "Blackpage") {
          throw new Error(isEn ? "Invalid Blackpage backup file" : "File backup Blackpage tidak valid");
        }
        if (Array.isArray(data.history)) {
          localStorage.setItem(TT_HISTORY_KEY, JSON.stringify(data.history.slice(0, 30)));
        }
        if (data.prefs && typeof data.prefs === "object") {
          savePrefs({ ...DEFAULT_PREFS, ...data.prefs });
        }
        if (typeof data.theme === "string") {
          localStorage.setItem(THEME_KEY, data.theme);
          applyTheme(data.theme);
        }
        if (typeof data.lang === "string") {
          localStorage.setItem(LANG_KEY, data.lang);
        }
        applyMotionPref();
        applyBgEffectPref();
        musicPlayer.refreshTracks();
        renderSettingDetail("backup", true);
        const fb = stageEl.querySelector("#backupFeedback");
        if (fb) fb.innerHTML = `<div class="alert alert-info">${isEn ? "Backup restored successfully!" : "Data & pengaturan berhasil dipulihkan!"}</div>`;
      } catch (err) {
        feedback.innerHTML = `<div class="alert alert-error">${escapeHtml(err?.message || "Gagal membaca file backup.")}</div>`;
      }
    });

    pingBtn?.addEventListener("click", async () => {
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
  }

  if (section.id === "tentang") {
    const isEn = getLang() === "en";
    const checkBtn = stageEl.querySelector("#checkUpdateBtn");
    const box = stageEl.querySelector("#updateStatusBox");
    const aboutDescBtn = stageEl.querySelector("#openAboutDescBtn");
    const aboutGuideBtn = stageEl.querySelector("#openAboutGuideBtn");

    const showInfoModal = (tagText, titleText, bodyHtml) => {
      if (document.querySelector("#bpAboutInfoModal")) return;
      const host = document.querySelector(".app-shell") || document.body;
      const el = document.createElement("div");
      el.id = "bpAboutInfoModal";
      el.className = "bp-modal-backdrop";
      el.innerHTML = `
        <div class="bp-modal-card">
          <div class="bp-modal-head">
            <span class="tag">${escapeHtml(tagText)}</span>
            <button type="button" class="btn btn-sm" id="aboutModalCloseBtn">✕</button>
          </div>
          <h3 class="bp-modal-title">${escapeHtml(titleText)}</h3>
          <div class="bp-modal-desc" style="margin-bottom:0;">${bodyHtml}</div>
        </div>
      `;
      host.appendChild(el);
      el.querySelector("#aboutModalCloseBtn")?.addEventListener("click", () => el.remove());
      el.addEventListener("click", (e) => {
        if (e.target === el) el.remove();
      });
    };

    aboutDescBtn?.addEventListener("click", () => {
      showInfoModal(
        isEn ? "ABOUT BLACKPAGE" : "TENTANG BLACKPAGE",
        "Blackpage",
        isEn
          ? "Blackpage is a media downloader and versatile multi-tool utility, made with love by <strong>Ricardo</strong>."
          : "Blackpage adalah pengunduh media dan berbagai tools serbaguna, dibuat dengan penuh cinta oleh <strong>Ricardo</strong>."
      );
    });

    aboutGuideBtn?.addEventListener("click", () => {
      showInfoModal(
        isEn ? "HOW TO USE" : "CARA PENGGUNAAN",
        isEn ? "Quick Guide" : "Panduan Singkat",
        isEn
          ? "1. Paste any supported link on <strong>Home</strong> and tap Process.<br/>2. Search &amp; download Spotify songs in the <strong>Music</strong> tab for offline &amp; background play.<br/>3. View downloaded photos &amp; videos in <strong>Gallery</strong>.<br/>4. Read manga/manhwa via <strong>Baca Komik</strong> and customize theme or background in <strong>Settings</strong>."
          : "1. Tempel link media di tab <strong>Utama</strong> lalu tekan Proses.<br/>2. Cari &amp; unduh lagu Spotify di tab <strong>Music</strong> untuk diputar offline dan di latar belakang.<br/>3. Lihat foto &amp; video hasil unduhan di tab <strong>Galeri</strong>.<br/>4. Baca manga/manhwa di <strong>Baca Komik</strong> dan atur tema/latar di <strong>Setting</strong>."
      );
    });

    const renderUpdateState = (info) => {
      if (!info) return;
      if (info.hasUpdate) {
        box.innerHTML = `<div class="alert alert-info"><strong>Update tersedia: v${escapeHtml(info.latest)}</strong> (saat ini v${APP_VERSION}). <a href="${escapeHtml(info.url)}" target="_blank" rel="noopener">Unduh APK terbaru</a></div>`;
      } else {
        box.innerHTML = `<div class="alert alert-info">${isEn ? `App is up to date (v${APP_VERSION}).` : `Aplikasi sudah versi terbaru (v${APP_VERSION}).`}</div>`;
      }
    };
    if (latestUpdateInfo) renderUpdateState(latestUpdateInfo);
    checkBtn?.addEventListener("click", async () => {
      checkBtn.disabled = true;
      checkBtn.textContent = "...";
      box.innerHTML = `<div class="alert alert-info">${isEn ? "Checking latest version..." : "Mengecek versi terbaru di GitHub..."}</div>`;
      try {
        const info = await checkAppUpdate();
        renderUpdateState(info);
      } catch (err) {
        box.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message || "Gagal mengecek update.")}</div>`;
      } finally {
        checkBtn.disabled = false;
        checkBtn.textContent = isEn ? "CHECK" : "CEK";
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
      const nextLang = btn.dataset.setLang;
      langRow.hidden = true;
      langSelectBtn.setAttribute("aria-expanded", "false");
      if (nextLang === getLang()) return;
      showLanguageRestartModal(nextLang, () => renderSettingDetail("umum", true));
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

function formatAudioTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const PLAY_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg>`;
const PAUSE_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
const VOL_ON_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
const VOL_OFF_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;

function upgradeAudioPlayer(audioEl) {
  if (!audioEl || audioEl.dataset.bpAudioReady || !audioEl.parentNode) return;
  audioEl.dataset.bpAudioReady = "1";
  audioEl.removeAttribute("controls");
  audioEl.style.display = "none";

  const player = document.createElement("div");
  player.className = "bp-audio-player";
  player.innerHTML = `
    <button type="button" class="bp-audio-play" aria-label="Putar / Jeda">${PLAY_ICON}</button>
    <div class="bp-audio-mid">
      <input type="range" class="bp-audio-seek" min="0" max="1000" value="0" aria-label="Posisi audio" />
      <div class="bp-audio-time">
        <span class="bp-audio-cur">00:00</span>
        <span class="bp-audio-dur">00:00</span>
      </div>
    </div>
    <button type="button" class="bp-audio-mute" aria-label="Bisukan">${VOL_ON_ICON}</button>
  `;

  audioEl.parentNode.insertBefore(player, audioEl);
  player.appendChild(audioEl);

  const playBtn = player.querySelector(".bp-audio-play");
  const seekEl = player.querySelector(".bp-audio-seek");
  const curEl = player.querySelector(".bp-audio-cur");
  const durEl = player.querySelector(".bp-audio-dur");
  const muteBtn = player.querySelector(".bp-audio-mute");

  let isSeeking = false;

  const syncPlay = () => {
    const playing = !audioEl.paused && !audioEl.ended;
    player.classList.toggle("is-playing", playing);
    playBtn.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
  };

  const syncTime = () => {
    const dur = Number.isFinite(audioEl.duration) ? audioEl.duration : 0;
    const cur = Number.isFinite(audioEl.currentTime) ? audioEl.currentTime : 0;
    durEl.textContent = formatAudioTime(dur);
    if (!isSeeking) {
      curEl.textContent = formatAudioTime(cur);
      const pct = dur > 0 ? Math.round((cur / dur) * 1000) : 0;
      seekEl.value = String(pct);
      seekEl.style.setProperty("--seek-pct", `${(pct / 10).toFixed(1)}%`);
    }
  };

  playBtn.addEventListener("click", () => {
    if (audioEl.paused) audioEl.play().catch(() => { });
    else audioEl.pause();
  });

  muteBtn.addEventListener("click", () => {
    audioEl.muted = !audioEl.muted;
    muteBtn.innerHTML = audioEl.muted ? VOL_OFF_ICON : VOL_ON_ICON;
  });

  seekEl.addEventListener("input", () => {
    isSeeking = true;
    const pct = Number(seekEl.value) / 1000;
    seekEl.style.setProperty("--seek-pct", `${(pct * 100).toFixed(1)}%`);
    if (Number.isFinite(audioEl.duration) && audioEl.duration > 0) {
      curEl.textContent = formatAudioTime(pct * audioEl.duration);
    }
  });

  seekEl.addEventListener("change", () => {
    const pct = Number(seekEl.value) / 1000;
    if (Number.isFinite(audioEl.duration) && audioEl.duration > 0) {
      audioEl.currentTime = pct * audioEl.duration;
    }
    isSeeking = false;
  });

  audioEl.addEventListener("play", syncPlay);
  audioEl.addEventListener("pause", syncPlay);
  audioEl.addEventListener("ended", syncPlay);
  audioEl.addEventListener("loadedmetadata", syncTime);
  audioEl.addEventListener("durationchange", syncTime);
  audioEl.addEventListener("timeupdate", syncTime);

  syncPlay();
  syncTime();
}

const FS_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;

function upgradeVideoPlayer(videoEl) {
  if (!videoEl || videoEl.dataset.bpVideoReady || !videoEl.parentNode) return;
  videoEl.dataset.bpVideoReady = "1";
  videoEl.removeAttribute("controls");
  videoEl.removeAttribute("muted");
  videoEl.muted = false;

  const wrap = document.createElement("div");
  wrap.className = "bp-video-player";
  videoEl.parentNode.insertBefore(wrap, videoEl);
  wrap.appendChild(videoEl);

  const centerBtn = document.createElement("button");
  centerBtn.type = "button";
  centerBtn.className = "bp-vid-center";
  centerBtn.setAttribute("aria-label", "Putar video");
  centerBtn.innerHTML = PLAY_ICON;

  const bar = document.createElement("div");
  bar.className = "bp-vid-bar";
  bar.innerHTML = `
    <button type="button" class="bp-audio-play bp-vid-play" aria-label="Putar / Jeda">${PLAY_ICON}</button>
    <div class="bp-audio-mid">
      <input type="range" class="bp-audio-seek bp-vid-seek" min="0" max="1000" value="0" aria-label="Posisi video" />
      <div class="bp-audio-time">
        <span class="bp-vid-cur">00:00</span>
        <span class="bp-vid-dur">00:00</span>
      </div>
    </div>
    <button type="button" class="bp-audio-mute bp-vid-mute" aria-label="Bisukan">${VOL_ON_ICON}</button>
    <button type="button" class="bp-audio-mute bp-vid-fs" aria-label="Layar penuh">${FS_ICON}</button>
  `;
  wrap.appendChild(centerBtn);
  wrap.appendChild(bar);

  const playBtn = bar.querySelector(".bp-vid-play");
  const seekEl = bar.querySelector(".bp-vid-seek");
  const curEl = bar.querySelector(".bp-vid-cur");
  const durEl = bar.querySelector(".bp-vid-dur");
  const muteBtn = bar.querySelector(".bp-vid-mute");
  const fsBtn = bar.querySelector(".bp-vid-fs");

  let isSeeking = false;

  const syncPlay = () => {
    const playing = !videoEl.paused && !videoEl.ended;
    wrap.classList.toggle("is-playing", playing);
    playBtn.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
    centerBtn.hidden = playing;
  };

  const syncMute = () => {
    muteBtn.innerHTML = videoEl.muted ? VOL_OFF_ICON : VOL_ON_ICON;
  };

  const syncTime = () => {
    const dur = Number.isFinite(videoEl.duration) ? videoEl.duration : 0;
    const cur = Number.isFinite(videoEl.currentTime) ? videoEl.currentTime : 0;
    durEl.textContent = formatAudioTime(dur);
    if (!isSeeking) {
      curEl.textContent = formatAudioTime(cur);
      const pct = dur > 0 ? Math.round((cur / dur) * 1000) : 0;
      seekEl.value = String(pct);
      seekEl.style.setProperty("--seek-pct", `${(pct / 10).toFixed(1)}%`);
    }
  };

  const togglePlay = () => {
    if (videoEl.paused) {
      videoEl.muted = false;
      syncMute();
      videoEl.play().catch(() => {
        videoEl.muted = true;
        syncMute();
        videoEl.play().catch(() => { });
      });
    } else {
      videoEl.pause();
    }
  };

  videoEl.addEventListener("click", togglePlay);
  centerBtn.addEventListener("click", togglePlay);
  playBtn.addEventListener("click", togglePlay);

  muteBtn.addEventListener("click", () => {
    videoEl.muted = !videoEl.muted;
    syncMute();
  });

  fsBtn.addEventListener("click", () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => { });
    } else if (wrap.requestFullscreen) {
      wrap.requestFullscreen().catch(() => videoEl.webkitEnterFullscreen?.());
    } else {
      videoEl.webkitEnterFullscreen?.();
    }
  });

  seekEl.addEventListener("input", () => {
    isSeeking = true;
    const pct = Number(seekEl.value) / 1000;
    seekEl.style.setProperty("--seek-pct", `${(pct * 100).toFixed(1)}%`);
    if (Number.isFinite(videoEl.duration) && videoEl.duration > 0) {
      curEl.textContent = formatAudioTime(pct * videoEl.duration);
    }
  });

  seekEl.addEventListener("change", () => {
    const pct = Number(seekEl.value) / 1000;
    if (Number.isFinite(videoEl.duration) && videoEl.duration > 0) {
      videoEl.currentTime = pct * videoEl.duration;
    }
    isSeeking = false;
  });

  videoEl.addEventListener("play", syncPlay);
  videoEl.addEventListener("pause", syncPlay);
  videoEl.addEventListener("ended", syncPlay);
  videoEl.addEventListener("volumechange", syncMute);
  videoEl.addEventListener("loadedmetadata", syncTime);
  videoEl.addEventListener("durationchange", syncTime);
  videoEl.addEventListener("timeupdate", syncTime);

  syncPlay();
  syncMute();
  syncTime();

  if (videoEl.autoplay) {
    videoEl.play().catch(() => {
      videoEl.muted = true;
      syncMute();
      videoEl.play().catch(() => { });
    });
  }
}

const audioMo = new MutationObserver(() => {
  stageEl.querySelectorAll("audio.audio-preview:not([data-bp-audio-ready])").forEach(upgradeAudioPlayer);
  stageEl.querySelectorAll("video.video-preview:not([data-bp-video-ready])").forEach(upgradeVideoPlayer);
});
audioMo.observe(stageEl, { childList: true, subtree: true });

function navigate(page, fromPopstate = false) {
  document.querySelectorAll(".comic-float-back, .comic-as-float, .comic-top-float-back").forEach((n) => n.remove());
  if (page !== "comic") comicController = null;
  if (page !== "anime") animeController = null;
  const ws = stageEl.closest(".workspace");
  if (ws && ws.scrollTop > 0) {
    const reduce = getPrefs().reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ws.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }
  if (page === "home") renderHome(fromPopstate);
  else if (page === "tools") renderToolsPage(fromPopstate);
  else if (page === "music") renderMusicPage(fromPopstate);
  else if (page === "gallery") renderGallery(fromPopstate);
  else if (page === "settings") renderSettings(fromPopstate);
  else if (page === "comic") mountComicPage(fromPopstate);
  else if (page === "anime") mountAnimePage(fromPopstate);
  else if (page.startsWith("tool:")) mountTool(page.slice(5), "", fromPopstate);
  else if (page.startsWith("gallery:")) renderGalleryDetail(Number(page.slice(8)), fromPopstate);
  else if (page === "settings:tampilan:bg") renderBgEffectSettings(fromPopstate);
  else if (page.startsWith("settings:")) renderSettingDetail(page.slice(9), fromPopstate);
  else renderHome(fromPopstate);
}

window.addEventListener("popstate", (e) => {
  const nextPage = e.state?.page || "home";
  if (nextPage === "comic" && activePage === "comic" && comicController) {
    document.querySelectorAll(".comic-float-back, .comic-as-float, .comic-top-float-back").forEach((n) => n.remove());
    comicController.syncView(e.state?.comicView || "search");
    playPageEnter();
    return;
  }
  navigate(nextPage, true);
});

let lastBackPressAt = 0;
let exitToastTimer = null;

function showExitToast() {
  document.querySelector("#bpExitToast")?.remove();
  clearTimeout(exitToastTimer);
  const host = document.querySelector(".app-shell") || document.body;
  const el = document.createElement("div");
  el.id = "bpExitToast";
  el.className = "bp-exit-toast";
  el.textContent = getLang() === "en" ? "Press back again to exit" : "Tekan sekali lagi untuk keluar";
  host.appendChild(el);
  exitToastTimer = setTimeout(() => el.remove(), 2000);
}

function showMusicExitWarningModal() {
  if (document.querySelector("#bpMusicExitModal")) return;
  const isEn = getLang() === "en";
  const host = document.querySelector(".app-shell") || document.body;
  const el = document.createElement("div");
  el.id = "bpMusicExitModal";
  el.className = "bp-modal-backdrop";
  el.innerHTML = `
    <div class="bp-modal-card">
      <div class="bp-modal-head">
        <span class="tag">${isEn ? "MUSIC WARNING" : "PERINGATAN MUSIK"}</span>
        <button type="button" class="btn btn-sm" id="musicExitCancelBtn">✕</button>
      </div>
      <h3 class="bp-modal-title">${isEn ? "Music Is Still Playing!" : "Lagu Masih Diputar!"}</h3>
      <p class="bp-modal-desc">${isEn ? "If you exit now without enabling <strong>Notifications &amp; Background Play</strong>, playback will stop." : "Kalau kamu keluar dari aplikasi sekarang tanpa mengizinkan <strong>Notifikasi &amp; Background Play</strong>, lagu akan otomatis berhenti."}</p>
      <div class="bp-modal-actions">
        <button type="button" class="btn btn-primary" id="musicExitAllowBtn">${isEn ? "Allow &amp; Keep Playing" : "Izinkan &amp; Tetap Putar"}</button>
        <button type="button" class="btn btn-danger" id="musicExitStopBtn">${isEn ? "Exit &amp; Stop Music" : "Keluar &amp; Matikan Lagu"}</button>
      </div>
    </div>
  `;
  host.appendChild(el);
  el.querySelector("#musicExitCancelBtn")?.addEventListener("click", () => el.remove());
  el.querySelector("#musicExitAllowBtn")?.addEventListener("click", async () => {
    await musicPlayer.requestBackgroundPermission();
    el.remove();
    if (musicPlayer.hasBackgroundPermission()) {
      window.BlackpageNative?.moveToBackground?.();
    }
  });
  el.querySelector("#musicExitStopBtn")?.addEventListener("click", () => {
    musicPlayer.stop();
    el.remove();
    window.Capacitor?.Plugins?.App?.exitApp?.();
  });
}

function openGalleryFullscreen(idx) {
  const items = loadGalleryItems();
  const initialItem = items[idx];
  if (!initialItem) return;
  if (initialItem.mediaType === "audio") {
    renderGalleryDetail(idx);
    return;
  }
  document.querySelector("#bpGalleryFullscreen")?.remove();

  const mediaEntries = items
    .map((it, origIdx) => ({ item: it, origIdx }))
    .filter(({ item }) => item.mediaType !== "audio");
  let pos = Math.max(0, mediaEntries.findIndex((e) => e.origIdx === idx));

  const apiBase = getApiBase();
  const isEn = getLang() === "en";
  const host = document.querySelector(".app-shell") || document.body;
  const fsEl = document.createElement("div");
  fsEl.id = "bpGalleryFullscreen";
  fsEl.className = "bp-gal-fs";
  host.appendChild(fsEl);

  const renderSlide = (slideDir = 0) => {
    const curVideo = fsEl.querySelector("video");
    if (curVideo) curVideo.pause();

    const entry = mediaEntries[pos];
    if (!entry) {
      fsEl.remove();
      return;
    }
    const { item, origIdx } = entry;
    const isImage = item.mediaType === "image";
    const mediaSrc = item.mediaUrl
      ? `${apiBase}/api/media?${new URLSearchParams({ url: item.mediaUrl }).toString()}`
      : "";
    const thumbSrc = item.thumbnail
      ? `${apiBase}/api/media?${new URLSearchParams({ url: item.thumbnail }).toString()}`
      : "";

    const mediaHtml = isImage
      ? `<img class="bp-gal-fs-media" id="galFsMedia" src="${escapeHtml(mediaSrc || thumbSrc)}" alt="Foto" />`
      : `<video class="video-preview bp-gal-fs-media" id="galFsMedia" src="${escapeHtml(mediaSrc)}" ${thumbSrc ? `poster="${escapeHtml(thumbSrc)}"` : ""} autoplay playsinline preload="auto"></video>`;

    fsEl.innerHTML = `
      <div class="bp-gal-fs-top">
        <button type="button" class="bp-gal-fs-btn" id="galFsCloseBtn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
          <span>${isEn ? "Back" : "Tutup"}</span>
        </button>
        <div class="bp-gal-fs-meta">
          ${mediaEntries.length > 1 ? `<span class="bp-gal-fs-count">${pos + 1}/${mediaEntries.length}</span>` : ""}
          <span class="bp-gal-fs-tag" id="galFsOfflineTag" hidden>OFFLINE</span>
          <span class="bp-gal-fs-tag">${isImage ? (isEn ? "PHOTO" : "FOTO") : "VIDEO"}</span>
          <button type="button" class="bp-gal-fs-btn is-icon" id="galFsInfoBtn" aria-label="Info">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
          </button>
        </div>
      </div>
      <div class="bp-gal-fs-stage" id="galFsStage">${mediaHtml}</div>
      ${mediaEntries.length > 1
        ? `<button type="button" class="bp-gal-fs-nav prev" id="galFsPrevBtn" aria-label="Previous">‹</button>
           <button type="button" class="bp-gal-fs-nav next" id="galFsNextBtn" aria-label="Next">›</button>`
        : ""}
      <div class="bp-gal-fs-sheet" id="galFsSheet" hidden>
        <div class="caption-head" style="margin-bottom:6px;">
          <strong>${escapeHtml(item.author || "Media")}</strong>
          <button type="button" class="btn btn-sm" id="galFsSheetClose">✕</button>
        </div>
        ${item.title ? `<p class="result-caption" style="margin:0 0 10px;">${escapeHtml(item.title)}</p>` : ""}
        <div id="galFsFeedback"></div>
        <div class="dl-list">
          <button type="button" class="btn btn-success" id="galFsDlBtn">${isEn ? "Download Again" : "Unduh Lagi"}</button>
          <button type="button" class="btn" id="galFsDelBtn">${isEn ? "Delete from Gallery" : "Hapus dari Galeri"}</button>
        </div>
      </div>
    `;

    const stage = fsEl.querySelector("#galFsStage");
    if (slideDir && stage?.animate) {
      stage.animate(
        [
          { opacity: 0.35, transform: `translate3d(${slideDir * 36}px, 0, 0)` },
          { opacity: 1, transform: "translate3d(0, 0, 0)" },
        ],
        { duration: 210, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
      );
    }

    const mediaEl = fsEl.querySelector("#galFsMedia");
    const offlineTag = fsEl.querySelector("#galFsOfflineTag");
    const sheet = fsEl.querySelector("#galFsSheet");
    const feedbackEl = fsEl.querySelector("#galFsFeedback");

    if (!isImage && mediaEl) {
      upgradeVideoPlayer(mediaEl);
      mediaEl.addEventListener("play", () => musicPlayer.pause());
      mediaEl.play?.().catch(() => {});
    }

    resolveOfflineMediaSrc(item).then((localSrc) => {
      if (!localSrc || !fsEl.isConnected || !mediaEl) return;
      if (offlineTag) offlineTag.hidden = false;
      mediaEl.src = localSrc;
      mediaEl.load?.();
      if (!isImage) mediaEl.play?.().catch(() => {});
    });

    const goNext = () => {
      if (mediaEntries.length < 2) return;
      pos = (pos + 1) % mediaEntries.length;
      renderSlide(1);
    };
    const goPrev = () => {
      if (mediaEntries.length < 2) return;
      pos = (pos - 1 + mediaEntries.length) % mediaEntries.length;
      renderSlide(-1);
    };

    if (stage && mediaEntries.length > 1) {
      let startX = 0;
      let startY = 0;
      let tracking = false;
      stage.addEventListener("pointerdown", (e) => {
        if (e.target.closest(".bp-video-bar, button, input")) return;
        startX = e.clientX;
        startY = e.clientY;
        tracking = true;
      });
      stage.addEventListener("pointerup", (e) => {
        if (!tracking) return;
        tracking = false;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          if (dx < 0) goNext();
          else goPrev();
        }
      });
      stage.addEventListener("pointercancel", () => {
        tracking = false;
      });
    }

    fsEl.querySelector("#galFsPrevBtn")?.addEventListener("click", goPrev);
    fsEl.querySelector("#galFsNextBtn")?.addEventListener("click", goNext);
    fsEl.querySelector("#galFsCloseBtn")?.addEventListener("click", () => {
      fsEl.querySelector("video")?.pause();
      fsEl.remove();
    });
    fsEl.querySelector("#galFsInfoBtn")?.addEventListener("click", () => {
      if (sheet) sheet.hidden = !sheet.hidden;
    });
    fsEl.querySelector("#galFsSheetClose")?.addEventListener("click", () => {
      if (sheet) sheet.hidden = true;
    });

    const dlBtn = fsEl.querySelector("#galFsDlBtn");
    dlBtn?.addEventListener("click", async () => {
      const orig = dlBtn.textContent;
      dlBtn.disabled = true;
      dlBtn.textContent = "...";
      try {
        const res = await downloadMediaFile({
          API_BASE: apiBase,
          remoteUrl: item.mediaUrl,
          mediaType: isImage ? "image" : "video",
          filename: item.filename || `blackpage_${Date.now()}.${isImage ? "jpg" : "mp4"}`,
          onProgress: (p) => {
            if (typeof p.percent === "number") dlBtn.textContent = `${p.percent}%`;
          },
        });
        if (feedbackEl) {
          feedbackEl.innerHTML = `<div class="alert alert-info">${res.native ? `Tersimpan di ${escapeHtml(res.path)}!` : "Download dimulai!"}</div>`;
        }
      } catch (err) {
        if (feedbackEl) {
          feedbackEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err?.message || "Gagal mengunduh.")}</div>`;
        }
      } finally {
        dlBtn.disabled = false;
        dlBtn.textContent = orig;
      }
    });

    fsEl.querySelector("#galFsDelBtn")?.addEventListener("click", () => {
      fsEl.querySelector("video")?.pause();
      const updated = loadGalleryItems().filter((_, i) => i !== origIdx);
      localStorage.setItem(TT_HISTORY_KEY, JSON.stringify(updated));
      fsEl.remove();
      renderGallery();
    });
  };

  renderSlide(0);
}

window.Capacitor?.Plugins?.App?.addListener?.("backButton", () => {
  const modal = document.querySelector("#bpStickerLightbox, #comicAsTipModal, #pinLightbox, #bpLangModal, #bpMusicExitModal, #bpMusicRenameModal, #bpSpotifyModal, #bpUpdateModal, #bpDownloadLocModal, #bpMaxRetryModal, #bpAboutInfoModal, #bpGalleryFullscreen");
  if (modal) {
    modal.remove();
    return;
  }
  if (activePage === "anime" && animeController?.handleBack()) {
    return;
  }
  if (activePage !== "home") {
    history.back();
    return;
  }
  const snap = musicPlayer.getSnapshot();
  if (snap.isPlaying) {
    if (!musicPlayer.hasBackgroundPermission()) {
      showMusicExitWarningModal();
      return;
    }
    if (window.BlackpageNative?.moveToBackground) {
      window.BlackpageNative.moveToBackground();
      return;
    }
  }
  const now = Date.now();
  if (now - lastBackPressAt < 2000) {
    document.querySelector("#bpExitToast")?.remove();
    window.Capacitor.Plugins.App.exitApp?.();
  } else {
    lastBackPressAt = now;
    showExitToast();
  }
});

navEl.addEventListener("click", (e) => {
  const animeBtn = e.target.closest("[data-anime-nav]");
  if (animeBtn && animeController) {
    animeController.switchNav(animeBtn.dataset.animeNav);
    return;
  }
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
    openGalleryFullscreen(Number(openGal.dataset.openGallery));
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

let hasShownUpdateModal = false;

function showUpdatePopupModal(info) {
  if (!info?.hasUpdate || hasShownUpdateModal || document.querySelector("#bpUpdateModal")) return;
  hasShownUpdateModal = true;
  const isEn = getLang() === "en";
  const host = document.querySelector(".app-shell") || document.body;
  const el = document.createElement("div");
  el.id = "bpUpdateModal";
  el.className = "bp-modal-backdrop";
  el.innerHTML = `
    <div class="bp-modal-card">
      <div class="bp-modal-head">
        <span class="tag">${isEn ? "UPDATE AVAILABLE" : "UPDATE TERSEDIA"}</span>
        <button type="button" class="btn btn-sm" id="bpUpdateCloseBtn">✕</button>
      </div>
      <h3 class="bp-modal-title">${isEn ? `Blackpage v${escapeHtml(info.latest)} Is Out!` : `Blackpage v${escapeHtml(info.latest)} Sudah Rilis!`}</h3>
      <p class="bp-modal-desc">${isEn ? `You are currently using <strong>v${APP_VERSION}</strong>. Update to the latest release for new features and fixes.` : `Kamu masih memakai versi <strong>v${APP_VERSION}</strong>. Perbarui ke rilis terbaru untuk fitur dan perbaikan terbaru.`}</p>
      <div class="bp-modal-actions">
        <a class="btn btn-primary" href="${escapeHtml(info.url)}" target="_blank" rel="noopener">${isEn ? "Update Now" : "Update Sekarang"}</a>
        <button type="button" class="btn" id="bpUpdateLaterBtn">${isEn ? "Later" : "Nanti"}</button>
      </div>
    </div>
  `;
  host.appendChild(el);
  const close = () => el.remove();
  el.querySelector("#bpUpdateCloseBtn")?.addEventListener("click", close);
  el.querySelector("#bpUpdateLaterBtn")?.addEventListener("click", close);
  el.addEventListener("click", (e) => {
    if (e.target === el) close();
  });
}

async function checkAppUpdate() {
  let latest = "";
  let url = `https://github.com/${GITHUB_REPO}/releases/latest`;
  try {
    const healthRes = await fetch(`${getApiBase()}/api/health`, { cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (healthRes.ok) {
      const info = await healthRes.json();
      if (info?.version) latest = String(info.version).replace(/^v/i, "");
    }
  } catch { }

  try {
    const ghRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(4000),
    });
    if (ghRes.ok) {
      const gh = await ghRes.json();
      const tagVer = String(gh?.tag_name || "").replace(/^v/i, "");
      if (tagVer && (!latest || compareSemver(tagVer, latest) > 0)) {
        latest = tagVer;
      }
      if (gh?.html_url) url = gh.html_url;
    }
  } catch { }

  const hasUpdate = Boolean(latest && compareSemver(latest, APP_VERSION) > 0);
  latestUpdateInfo = { latest: latest || APP_VERSION, hasUpdate, url };
  if (hasUpdate && statusEl?.lastElementChild && !statusEl.classList.contains("offline")) {
    statusEl.lastElementChild.textContent = `UPDATE v${latest}`;
  }
  if (hasUpdate && getPrefs().autoUpdate) {
    showUpdatePopupModal(latestUpdateInfo);
  }
  return latestUpdateInfo;
}

let offlinePollTimer = null;

function setOfflineBadge() {
  clearTimeout(offlinePollTimer);
  statusEl.classList.add("offline");
  statusEl.lastElementChild.textContent = "OFFLINE";
  offlinePollTimer = setTimeout(() => {
    if (document.visibilityState === "visible") checkHealth();
  }, 8000);
}

async function checkHealth() {
  clearTimeout(offlinePollTimer);
  try {
    const res = await fetch(`${getApiBase()}/api/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error();
    const info = await res.json();
    statusEl.classList.remove("offline");
    const hasUpdate = getPrefs().autoUpdate && info.version && info.version !== APP_VERSION;
    statusEl.lastElementChild.textContent = hasUpdate ? `UPDATE ${info.version}` : "ONLINE";
    if (getPrefs().autoUpdate) {
      checkAppUpdate().catch(() => { });
    }
  } catch {
    setOfflineBadge();
  }
}

window.addEventListener("online", () => checkHealth());
window.addEventListener("offline", () => setOfflineBadge());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkHealth();
});
window.Capacitor?.Plugins?.Network?.addListener?.("networkStatusChange", (st) => {
  if (st?.connected) checkHealth();
  else setOfflineBadge();
});
statusEl?.addEventListener("click", () => checkHealth());

history.replaceState({ page: "home" }, "");
renderHome(true);
checkHealth();

const bpIntroEl = document.getElementById("bpIntro");
if (bpIntroEl) {
  const prefs = getPrefs();
  const reduce = prefs.reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const finishIntro = (delayMs) => {
    setTimeout(() => {
      bpIntroEl.classList.add("is-exit");
      if (activePage === "home" && stageEl.classList.contains("is-waiting")) {
        stageEl.classList.remove("is-waiting");
        stageEl.classList.add("is-entering");
      }
      setTimeout(() => {
        bpIntroEl.remove();
        stageEl.classList.remove("home-stagger", "is-entering");
      }, 650);
    }, delayMs);
  };

  if (!prefs.onboardingDone) {
    bpIntroEl.removeAttribute("aria-hidden");
    mountOnboarding(bpIntroEl, {
      prefs,
      githubUser: "Ricardo169zzz",
      githubRepo: GITHUB_REPO,
      appVersion: APP_VERSION,
      onSavePrefs: (patch) => savePrefs({ ...getPrefs(), ...patch }),
      onToggleTheme: () => {
        const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
        const next = current === "dark" ? "light" : "dark";
        localStorage.setItem(THEME_KEY, next);
        applyTheme(next);
      },
      getThemeLabel: () => (document.documentElement.dataset.theme === "dark" ? "DARK" : "LIGHT"),
      onFinish: () => finishIntro(60),
    });
  } else {
    bpIntroEl.innerHTML = renderSplashMarkup(prefs.introStyle || "bauhaus");
    finishIntro(reduce ? 50 : 1250);
  }
}
