/**
 * Blackpage Offline Music Player
 * Supports local offline MP3s (Capacitor Filesystem), MediaSession controls,
 * and Android BlackpageNative Foreground Service notification sync.
 */

import { getTrackFallbackCover } from "./music-covers.js";

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const SPOTIFY_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#1DB954" stroke="#141414" stroke-width="1.8"/><path d="M7.2 9.7c3.3-1 6.9-.8 9.8.7M7.8 12.6c2.7-.8 5.7-.6 8.1.6M8.5 15.3c2.1-.6 4.4-.4 6.2.5" fill="none" stroke="#141414" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const SEARCH_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.5" y2="16.5"/></svg>`;
const PLAY_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6,4 20,12 6,20"/></svg>`;
const PAUSE_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4.5" height="16" rx="1"/><rect x="13.5" y="4" width="4.5" height="16" rx="1"/></svg>`;
const PREV_ICON_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="4" y="5" width="2.5" height="14"/><polygon points="20,5 9,12 20,19"/></svg>`;
const NEXT_ICON_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="4,5 15,12 4,19"/><rect x="17.5" y="5" width="2.5" height="14"/></svg>`;
const CLOSE_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const DL_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><polyline points="7 11 12 16 17 11"/><path d="M5 20h14"/></svg>`;
const CIRCLE_EQ_SVG = `<svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="1" y="5" width="2" height="6" rx="1"/><rect x="5" y="2" width="2" height="9" rx="1"/><rect x="9" y="4" width="2" height="7" rx="1"/></svg>`;
const CIRCLE_PAUSE_SVG = `<svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="2.5" y="2" width="2.5" height="8" rx="0.8"/><rect x="7" y="2" width="2.5" height="8" rx="0.8"/></svg>`;

const POPULAR_SONGS = [
  { title: "Karena Kamu", artist: "Geisha" },
  { title: "Komang", artist: "Raim Laode" },
  { title: "Sial", artist: "Mahalini" },
  { title: "Runtuh", artist: "Feby Putri" },
  { title: "Tak Segampang Itu", artist: "Anggi Marito" },
  { title: "Monokrom", artist: "Tulus" },
];

export function createMusicPlayer({
  loadGalleryItems,
  renameGalleryItem,
  saveTrack,
  downloadTrack,
  resolveOfflineMediaSrc,
  resolveOfflineThumbSrc,
  getApiBase,
  getLang,
  onStateChange,
}) {
  const isEn = () => (typeof getLang === "function" ? getLang() === "en" : false);
  const audio = new Audio();
  audio.preload = "auto";

  const state = {
    tracks: [],
    currentIdx: -1,
    isPlaying: false,
    isOffline: false,
    repeat: "all", // "off" | "all" | "one"
    shuffle: false,
    currentTime: 0,
    duration: 0,
    error: "",
  };

  let loadSeq = 0;

  function getNativeBridge() {
    return typeof window !== "undefined" ? window.BlackpageNative : null;
  }

  function isAndroidApp() {
    return Boolean(window.Capacitor?.isNativePlatform?.() || getNativeBridge());
  }

  function hasBackgroundPermission() {
    const bridge = getNativeBridge();
    if (bridge && typeof bridge.hasBackgroundMusicPermission === "function") {
      try {
        return Boolean(bridge.hasBackgroundMusicPermission());
      } catch {
        return false;
      }
    }
    if (typeof Notification !== "undefined") {
      return Notification.permission === "granted";
    }
    return true;
  }

  async function requestBackgroundPermission() {
    const bridge = getNativeBridge();
    if (bridge && typeof bridge.requestBackgroundMusicPermission === "function") {
      try {
        bridge.requestBackgroundMusicPermission();
      } catch {}
      setTimeout(() => notify(), 600);
      return hasBackgroundPermission();
    }
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {}
    }
    notify();
    return hasBackgroundPermission();
  }

  function getTrackCoverSrc(track) {
    if (track?.thumbnail) {
      const apiBase = getApiBase();
      return `${apiBase}/api/media?${new URLSearchParams({ url: track.thumbnail }).toString()}`;
    }
    return getTrackFallbackCover(track);
  }

  function renameTrack(galleryIdx, newTitle) {
    const clean = String(newTitle || "").trim();
    if (!clean || typeof renameGalleryItem !== "function") return false;
    const ok = renameGalleryItem(galleryIdx, clean);
    if (!ok) return false;
    refreshTracks();
    syncNativeNotification();
    notify();
    return true;
  }

  function showRenameModal(track) {
    if (!track || document.querySelector("#bpMusicRenameModal")) return;
    const en = isEn();
    const host = document.querySelector(".app-shell") || document.body;
    const curTitle = track.title?.trim() || track.author?.trim() || "Blackpage Audio";
    const el = document.createElement("div");
    el.id = "bpMusicRenameModal";
    el.className = "bp-modal-backdrop";
    el.innerHTML = `
      <div class="bp-modal-card">
        <div class="bp-modal-head">
          <span class="tag">${en ? "RENAME TRACK" : "GANTI JUDUL LAGU"}</span>
          <button type="button" class="btn btn-sm" id="musicRenameCancelBtn">✕</button>
        </div>
        <input type="text" class="brutal-input" id="musicRenameInput" value="${escapeHtml(curTitle)}" maxlength="120" placeholder="${en ? "Enter track title..." : "Masukkan judul lagu..."}" />
        <div class="bp-modal-actions" style="margin-top:12px;">
          <button type="button" class="btn btn-primary" id="musicRenameSaveBtn">${en ? "Save Title" : "Simpan Judul"}</button>
        </div>
      </div>
    `;
    host.appendChild(el);
    const input = el.querySelector("#musicRenameInput");
    input?.focus();
    input?.select();
    const save = () => {
      const val = input?.value?.trim();
      if (val) renameTrack(track.galleryIdx, val);
      el.remove();
    };
    el.querySelector("#musicRenameCancelBtn")?.addEventListener("click", () => el.remove());
    el.querySelector("#musicRenameSaveBtn")?.addEventListener("click", save);
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") save();
    });
  }

  function syncNativeNotification() {
    const track = getCurrentTrack();
    const bridge = getNativeBridge();
    if (bridge) {
      try {
        if (!track || (!state.isPlaying && state.currentTime === 0)) {
          bridge.stopMusicNotification?.();
        } else {
          bridge.startMusicNotification?.(
            track.title || "Blackpage Music",
            track.author || "Offline Audio",
            Boolean(state.isPlaying)
          );
        }
      } catch {}
    }

    if ("mediaSession" in navigator && track) {
      const thumb = getTrackCoverSrc(track);
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title || "Blackpage Music",
          artist: track.author || "Blackpage Offline",
          album: state.isOffline ? "Offline Library" : "Blackpage",
          artwork: [{ src: thumb, sizes: "512x512", type: track.thumbnail ? "image/png" : "image/svg+xml" }],
        });
        navigator.mediaSession.playbackState = state.isPlaying ? "playing" : "paused";
      } catch {}
    }
  }

  function notify() {
    onStateChange?.(getSnapshot());
  }

  function refreshTracks() {
    const prevTrack = getCurrentTrack();
    const all = loadGalleryItems();
    state.tracks = all
      .map((item, galleryIdx) => ({ ...item, galleryIdx }))
      .filter((item) => item.mediaType === "audio")
      .sort((a, b) => (b.downloadedAt || 0) - (a.downloadedAt || 0));

    if (prevTrack) {
      const keptIdx = state.tracks.findIndex(
        (t) =>
          (prevTrack.mediaUrl && t.mediaUrl === prevTrack.mediaUrl) ||
          (prevTrack.url && t.url === prevTrack.url && t.title === prevTrack.title)
      );
      if (keptIdx >= 0) {
        state.currentIdx = keptIdx;
      } else if (state.currentIdx >= state.tracks.length) {
        state.currentIdx = state.tracks.length - 1;
      }
    } else if (state.currentIdx >= state.tracks.length) {
      state.currentIdx = state.tracks.length - 1;
    }
    return state.tracks;
  }

  function getCurrentTrack() {
    return state.currentIdx >= 0 ? state.tracks[state.currentIdx] || null : null;
  }

  function getSnapshot() {
    return {
      ...state,
      track: getCurrentTrack(),
      hasBgPerm: hasBackgroundPermission(),
      isAndroid: isAndroidApp(),
    };
  }

  async function playIndex(idx) {
    refreshTracks();
    if (!state.tracks.length) return;
    const targetIdx = ((idx % state.tracks.length) + state.tracks.length) % state.tracks.length;
    const track = state.tracks[targetIdx];
    if (!track) return;

    const seq = ++loadSeq;
    state.currentIdx = targetIdx;
    state.error = "";
    state.isOffline = false;
    state.currentTime = 0;
    state.duration = 0;
    notify();

    let src = "";
    try {
      src = await resolveOfflineMediaSrc(track);
      if (src) state.isOffline = true;
    } catch {}
    if (seq !== loadSeq) return;

    if (!src && track.mediaUrl) {
      const apiBase = getApiBase();
      src = `${apiBase}/api/media?${new URLSearchParams({ url: track.mediaUrl }).toString()}`;
    }

    if (!src) {
      state.error = "Sumber audio tidak tersedia.";
      state.isPlaying = false;
      notify();
      return;
    }

    audio.src = src;
    audio.load();
    try {
      await audio.play();
      state.isPlaying = true;
    } catch {
      state.isPlaying = false;
    }
    syncNativeNotification();
    notify();
  }

  function togglePlay() {
    if (!getCurrentTrack()) {
      refreshTracks();
      if (state.tracks.length) return playIndex(0);
      return;
    }
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }

  function next() {
    refreshTracks();
    if (!state.tracks.length) return;
    if (state.shuffle && state.tracks.length > 1) {
      let r = state.currentIdx;
      while (r === state.currentIdx) r = Math.floor(Math.random() * state.tracks.length);
      return playIndex(r);
    }
    return playIndex(state.currentIdx + 1);
  }

  function prev() {
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    refreshTracks();
    if (!state.tracks.length) return;
    return playIndex(state.currentIdx - 1);
  }

  function pause() {
    if (!audio.paused) {
      audio.pause();
    }
    state.isPlaying = false;
    syncNativeNotification();
    notify();
  }

  function stop() {
    audio.pause();
    audio.currentTime = 0;
    state.isPlaying = false;
    state.currentTime = 0;
    syncNativeNotification();
    notify();
  }

  function seekRatio(ratio) {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    audio.currentTime = Math.max(0, Math.min(1, ratio)) * audio.duration;
    state.currentTime = audio.currentTime;
    notify();
  }

  function cycleRepeat() {
    state.repeat = state.repeat === "all" ? "one" : state.repeat === "one" ? "off" : "all";
    notify();
  }

  function toggleShuffle() {
    state.shuffle = !state.shuffle;
    notify();
  }

  audio.addEventListener("play", () => {
    state.isPlaying = true;
    syncNativeNotification();
    notify();
  });

  audio.addEventListener("pause", () => {
    state.isPlaying = false;
    syncNativeNotification();
    notify();
  });

  audio.addEventListener("timeupdate", () => {
    state.currentTime = audio.currentTime || 0;
    state.duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    notify();
  });

  audio.addEventListener("loadedmetadata", () => {
    state.duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    notify();
  });

  audio.addEventListener("ended", () => {
    if (state.repeat === "one") {
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }
    if (state.repeat === "all" || state.currentIdx < state.tracks.length - 1) {
      next();
    } else {
      state.isPlaying = false;
      syncNativeNotification();
      notify();
    }
  });

  audio.addEventListener("error", () => {
    state.isPlaying = false;
    state.error = "Gagal memutar audio (cek koneksi atau file offline).";
    syncNativeNotification();
    notify();
  });

  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.setActionHandler("play", () => togglePlay());
      navigator.mediaSession.setActionHandler("pause", () => togglePlay());
      navigator.mediaSession.setActionHandler("previoustrack", () => prev());
      navigator.mediaSession.setActionHandler("nexttrack", () => next());
      navigator.mediaSession.setActionHandler("stop", () => stop());
    } catch {}
  }

  window.__bpMusicAction = (action) => {
    if (action === "toggle") togglePlay();
    else if (action === "next") next();
    else if (action === "prev") prev();
    else if (action === "stop") stop();
  };

  window.__bpMusicPermChanged = () => {
    notify();
  };

  function renderMusicTabHtml() {
    refreshTracks();
    const snap = getSnapshot();
    const apiBase = getApiBase();
    const cur = snap.track;
    const pct = snap.duration > 0 ? Math.min(100, (snap.currentTime / snap.duration) * 100) : 0;

    const en = isEn();
    const permBanner = !snap.hasBgPerm
      ? `
        <div class="bp-music-perm-card">
          <div class="bp-music-perm-text">
            <strong>${en ? "BACKGROUND &amp; NOTIFICATION PERMISSION" : "IZIN BACKGROUND &amp; NOTIFIKASI"}</strong>
            <p>${en ? "Enable notifications &amp; ignore battery optimization so music keeps playing in the background with Blackpage media controls." : "Aktifkan izin notifikasi &amp; abaikan optimasi baterai agar musik tetap jalan saat keluar aplikasi dengan banner kontrol Blackpage."}</p>
          </div>
          <button type="button" class="btn btn-sm btn-primary" id="musicAllowBgBtn">${en ? "ALLOW NOW" : "IZINKAN SEKARANG"}</button>
        </div>
      `
      : `
        <div class="bp-music-perm-ok">
          <span>${en ? "BACKGROUND PLAY &amp; NOTIFICATIONS ACTIVE" : "BACKGROUND PLAY &amp; NOTIFIKASI AKTIF"}</span>
          <span class="tag">${en ? "READY" : "SIAP"}</span>
        </div>
      `;

    const searchBarHtml = `
      <button type="button" class="bp-sp-cta-card" id="musicOpenSearchBtn">
        <div class="bp-sp-cta-left">
          <span class="bp-sp-cta-logo">${SPOTIFY_SVG}</span>
          <div class="bp-sp-cta-text">
            <strong>${en ? "FIND YOUR FAVORITE SONG" : "CARI LAGU FAVORITMU"}</strong>
            <span>${en ? "Search and download directly for offline playback!" : "Cari dan langsung unduh agar bisa diputar saat offline!"}</span>
          </div>
        </div>
        <span class="bp-sp-cta-icon">${SEARCH_SVG}</span>
      </button>
    `;

    if (!snap.tracks.length) {
      return `
        ${searchBarHtml}
        ${permBanner}
        <div class="alert alert-info">${en ? "No saved music/MP3 yet. Search a song above or download audio to play here." : "Belum ada musik/MP3 tersimpan. Cari lagu di atas atau download audio untuk diputar di sini."}</div>
      `;
    }

    const curThumb = cur ? getTrackCoverSrc(cur) : "";
    const curFallback = cur ? getTrackFallbackCover(cur) : "";
    const curTitle = cur?.title?.trim() || cur?.author?.trim() || "Blackpage Audio";
    const curArtist = cur?.author?.trim() || (snap.isOffline ? (en ? "Saved Offline" : "Tersimpan Offline") : "Blackpage Music");

    const isSavedOffline = snap.isOffline || Boolean(cur?.offlineSaved);

    const playerCard = cur
      ? `
        <div class="bp-spotify-hero">
          <div class="bp-spotify-top">
            <div class="bp-spotify-art-wrap ${snap.isPlaying ? "is-playing" : ""}">
              <img class="bp-spotify-art" src="${escapeHtml(curThumb)}" alt="Cover" data-music-cover-idx="${cur.galleryIdx}" onerror="this.onerror=null;this.src='${escapeHtml(curFallback)}';" />
            </div>
            <div class="bp-spotify-meta">
              <div class="bp-music-badges">
                <span class="tag ${isSavedOffline ? "is-offline-tag" : "is-online-tag"}">${isSavedOffline ? (en ? "OFFLINE READY" : "OFFLINE SIAP") : "ONLINE"}</span>
                <span class="tag">${snap.isPlaying ? (en ? "PLAYING" : "MEMUTAR") : (en ? "PAUSED" : "JEDA")}</span>
              </div>
              <div class="bp-spotify-title-row">
                <strong class="bp-spotify-title">${escapeHtml(curTitle)}</strong>
                <button type="button" class="btn btn-sm bp-sp-rename-btn" id="musicRenameBtn" title="${en ? "Rename" : "Ganti Judul"}">✎</button>
              </div>
              <span class="bp-spotify-artist">${escapeHtml(curArtist)}</span>
            </div>
          </div>

          ${!isSavedOffline
            ? `<div class="bp-sp-offline-notice">
                <span>${en ? "Not downloaded yet. Download to listen offline without data." : "Lagu ini belum diunduh. Unduh agar bisa didengar offline tanpa kuota."}</span>
                <button type="button" class="btn btn-sm btn-success" id="musicDownloadOfflineBtn">${en ? "⬇ DOWNLOAD OFFLINE" : "⬇ UNDUH OFFLINE"}</button>
              </div>`
            : ""}

          ${snap.error ? `<div class="alert alert-error" style="margin-top:8px;">${escapeHtml(snap.error)}</div>` : ""}

          <div class="bp-music-seek-wrap">
            <input type="range" class="bp-music-seek" id="musicSeekInput" min="0" max="1000" value="${Math.round(pct * 10)}" aria-label="${en ? "Track position" : "Posisi lagu"}" />
            <div class="bp-music-times">
              <span id="musicCurTime">${fmtTime(snap.currentTime)}</span>
              <span id="musicDurTime">${fmtTime(snap.duration)}</span>
            </div>
          </div>

          <div class="bp-spotify-controls">
            <button type="button" class="bp-sp-icon-btn ${snap.shuffle ? "is-on" : ""}" id="musicShuffleBtn" title="${en ? "Shuffle" : "Acak"}" aria-label="${en ? "Shuffle" : "Acak"}">⇄</button>
            <button type="button" class="bp-sp-icon-btn" id="musicPrevBtn" title="${en ? "Previous" : "Sebelumnya"}" aria-label="${en ? "Previous" : "Sebelumnya"}">${PREV_ICON_SVG}</button>
            <button type="button" class="bp-sp-play-btn" id="musicPlayBtn" aria-label="${snap.isPlaying ? (en ? "Pause" : "Jeda") : (en ? "Play" : "Putar")}">${snap.isPlaying ? PAUSE_ICON_SVG : PLAY_ICON_SVG}</button>
            <button type="button" class="bp-sp-icon-btn" id="musicNextBtn" title="${en ? "Next" : "Berikutnya"}" aria-label="${en ? "Next" : "Berikutnya"}">${NEXT_ICON_SVG}</button>
            <button type="button" class="bp-sp-icon-btn ${snap.repeat !== "off" ? "is-on" : ""}" id="musicRepeatBtn" title="${en ? "Repeat" : "Ulangi"}" aria-label="${en ? "Repeat" : "Ulangi"}">${snap.repeat === "one" ? "1↻" : "↻"}</button>
          </div>
        </div>
      `
      : `
        <div class="bp-music-hint">
          <span>${en ? "Tap a track below to play offline &amp; in the background." : "Ketuk lagu di bawah untuk memutar secara offline &amp; latar belakang."}</span>
        </div>
      `;

    const listHtml = snap.tracks
      .map((item, idx) => {
        const isCurrent = idx === snap.currentIdx;
        const fallbackUri = getTrackFallbackCover(item);
        const thumbSrc = getTrackCoverSrc(item);
        const coverHtml = `<span class="bp-sp-thumb-wrap gallery-thumb-wrap is-loading"><img class="gallery-thumb" data-thumb-idx="${item.galleryIdx}" src="${escapeHtml(thumbSrc)}" alt="Sampul" loading="lazy" onerror="this.onerror=null;this.src='${escapeHtml(fallbackUri)}';" /></span>`;
        const rowTitle = item.title?.trim() || item.author?.trim() || `Track ${idx + 1}`;
        const rowArtist = item.author?.trim() || "Audio";

        return `
          <div class="bp-sp-row ${isCurrent ? "is-active" : ""}" style="--i:${Math.min(idx, 12)}">
            <button type="button" class="bp-sp-row-main" data-play-music="${idx}">
              <span class="bp-sp-num">${isCurrent && snap.isPlaying ? `<span class="bp-eq"><i></i><i></i><i></i></span>` : idx + 1}</span>
              ${coverHtml}
              <div class="bp-sp-row-body">
                <strong class="bp-sp-row-title">${escapeHtml(rowTitle)}</strong>
                <span class="bp-sp-row-artist">${escapeHtml(rowArtist)}</span>
              </div>
            </button>
            <button type="button" class="btn btn-sm bp-music-detail-btn" data-open-gallery="${item.galleryIdx}" title="Detail">•••</button>
          </div>
        `;
      })
      .join("");

    return `
      ${searchBarHtml}
      ${permBanner}
      ${playerCard}
      <div class="bp-sp-queue-head">${en ? "TRACK QUEUE" : "ANTREAN LAGU"} (${snap.tracks.length})</div>
      <div class="bp-sp-queue">${listHtml}</div>
    `;
  }

  function openSpotifySearchModal() {
    if (document.querySelector("#bpSpotifyModal")) return;
    const en = isEn();
    const host = document.querySelector(".app-shell") || document.body;
    const el = document.createElement("div");
    el.id = "bpSpotifyModal";
    el.className = "bp-modal-backdrop";

    const popHtml = POPULAR_SONGS.map(
      (s) => `
        <button type="button" class="bp-sp-pop-chip" data-pop-q="${escapeHtml(`${s.title} ${s.artist}`)}">
          <strong>${escapeHtml(s.title)}</strong>
          <span>${escapeHtml(s.artist)}</span>
        </button>
      `
    ).join("");

    el.innerHTML = `
      <div class="bp-modal-card bp-sp-modal-card">
        <button type="button" class="btn btn-sm bp-sp-modal-close" id="spModalCloseBtn" aria-label="${en ? "Close" : "Tutup"}">✕</button>
        <div class="bp-sp-modal-brand">
          ${SPOTIFY_SVG}
          <span>Spotify</span>
        </div>
        <form class="bp-sp-search-row" id="spModalForm">
          <input type="text" class="brutal-input" id="spModalInput" placeholder="${en ? "Type song title or artist..." : "Ketik judul lagu atau artis..."}" />
          <button type="submit" class="btn bp-sp-search-btn" id="spModalSubmitBtn" aria-label="${en ? "Search" : "Cari"}">${SEARCH_SVG}</button>
        </form>
        <div id="spModalResult" style="margin-top:12px;"></div>
        <div class="bp-sp-pop-section">
          <div class="bp-sp-queue-head">${en ? "POPULAR TRACKS" : "LAGU POPULER"}</div>
          <div class="bp-sp-pop-grid">${popHtml}</div>
        </div>
      </div>
    `;

    host.appendChild(el);
    const input = el.querySelector("#spModalInput");
    const resultEl = el.querySelector("#spModalResult");
    const submitBtn = el.querySelector("#spModalSubmitBtn");
    input?.focus();

    const close = () => el.remove();
    el.querySelector("#spModalCloseBtn")?.addEventListener("click", close);
    el.addEventListener("click", (e) => {
      if (e.target === el) close();
    });

    async function runSearch(query) {
      const q = String(query || "").trim();
      if (!q) return;
      if (input) input.value = q;
      if (submitBtn) submitBtn.disabled = true;
      resultEl.innerHTML = `
        <div class="bp-sp-skeleton">
          <div class="bp-skel-box bp-skel-art"></div>
          <div class="bp-skel-lines">
            <div class="bp-skel-box bp-skel-line"></div>
            <div class="bp-skel-box bp-skel-line short"></div>
            <div class="bp-skel-btns">
              <div class="bp-skel-box bp-skel-btn"></div>
              <div class="bp-skel-box bp-skel-btn"></div>
            </div>
          </div>
        </div>
      `;
      try {
        const res = await fetch(`${getApiBase()}/api/spotify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q }),
        });
        const data = await res.json();
        if (!res.ok || !data?.mp3Url) {
          throw new Error(data?.message || "Lagu tidak ditemukan");
        }
        const trackEntry = {
          url: data.spotifyUrl || data.mp3Url,
          author: data.artist || "Spotify",
          title: data.title || q,
          thumbnail: data.cover || null,
          mediaUrl: data.mp3Url,
          filename: `${(data.title || q).replace(/[^a-z0-9_-]+/gi, "_").slice(0, 40)}.mp3`,
        };
        const coverSrc = data.cover
          ? `${getApiBase()}/api/media?${new URLSearchParams({ url: data.cover }).toString()}`
          : getTrackFallbackCover(trackEntry);

        resultEl.innerHTML = `
          <div class="bp-sp-result-banner">
            <div class="bp-sp-result-head">
              <img class="bp-sp-result-art" src="${escapeHtml(coverSrc)}" alt="Cover" />
              <div class="bp-sp-result-meta">
                <strong>${escapeHtml(trackEntry.title)}</strong>
                <span>${escapeHtml(trackEntry.author)}${data.duration ? ` • ${escapeHtml(data.duration)}` : ""}</span>
              </div>
            </div>
            <div class="bp-sp-result-actions">
              <button type="button" class="btn btn-primary bp-sp-act-btn" id="spResPlayBtn">${PLAY_ICON_SVG}<span>${en ? "Play" : "Putar"}</span></button>
              <button type="button" class="btn btn-success bp-sp-act-btn" id="spResDlBtn">${DL_ICON_SVG}<span>Download</span></button>
            </div>
          </div>
        `;

        const ensureSavedIndex = () => {
          if (typeof saveTrack === "function") saveTrack(trackEntry);
          refreshTracks();
          const idx = state.tracks.findIndex((t) => t.mediaUrl === trackEntry.mediaUrl);
          return idx >= 0 ? idx : 0;
        };

        resultEl.querySelector("#spResPlayBtn")?.addEventListener("click", async () => {
          const idx = ensureSavedIndex();
          close();
          await playIndex(idx);
        });

        const dlBtn = resultEl.querySelector("#spResDlBtn");
        dlBtn?.addEventListener("click", async () => {
          if (typeof downloadTrack !== "function") return;
          const idx = ensureSavedIndex();
          const savedTrack = state.tracks[idx];
          dlBtn.disabled = true;
          const labelSpan = dlBtn.querySelector("span");
          if (labelSpan) labelSpan.textContent = "0%";
          try {
            await downloadTrack(savedTrack, (p) => {
              if (labelSpan && typeof p?.percent === "number") {
                labelSpan.textContent = `${p.percent}%`;
              }
            });
            if (labelSpan) labelSpan.textContent = en ? "Saved ✓" : "Tersimpan ✓";
            refreshTracks();
            notify();
          } catch {
            dlBtn.disabled = false;
            if (labelSpan) labelSpan.textContent = "Download";
          }
        });
      } catch (err) {
        resultEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message || "Gagal mencari lagu.")}</div>`;
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    }

    el.querySelector("#spModalForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      runSearch(input?.value);
    });
    el.querySelectorAll("[data-pop-q]").forEach((chip) => {
      chip.addEventListener("click", () => runSearch(chip.dataset.popQ));
    });
  }

  function bindMusicTabEvents(container) {
    if (!container) return;
    const allowBtn = container.querySelector("#musicAllowBgBtn");
    if (allowBtn) allowBtn.addEventListener("click", () => requestBackgroundPermission());

    const openSearchBtn = container.querySelector("#musicOpenSearchBtn");
    if (openSearchBtn) openSearchBtn.addEventListener("click", () => openSpotifySearchModal());

    const dlOfflineBtn = container.querySelector("#musicDownloadOfflineBtn");
    if (dlOfflineBtn && typeof downloadTrack === "function") {
      dlOfflineBtn.addEventListener("click", async () => {
        const cur = getCurrentTrack();
        if (!cur) return;
        const orig = dlOfflineBtn.textContent;
        dlOfflineBtn.disabled = true;
        dlOfflineBtn.textContent = "MENGUNDUH...";
        try {
          await downloadTrack(cur, (p) => {
            if (typeof p?.percent === "number") {
              dlOfflineBtn.textContent = `${p.percent}%`;
            }
          });
          dlOfflineBtn.textContent = "100% ✓";
          const noticeEl = dlOfflineBtn.closest(".bp-sp-offline-notice");
          setTimeout(() => {
            if (noticeEl) noticeEl.classList.add("is-exit");
            setTimeout(() => {
              refreshTracks();
              notify();
            }, 320);
          }, 220);
        } catch (err) {
          dlOfflineBtn.disabled = false;
          dlOfflineBtn.textContent = orig;
          state.error = err?.message || "Gagal mengunduh lagu offline.";
          notify();
        }
      });
    }

    const renameBtn = container.querySelector("#musicRenameBtn");
    if (renameBtn) {
      renameBtn.addEventListener("click", () => {
        const cur = getCurrentTrack();
        if (cur) showRenameModal(cur);
      });
    }

    const playBtn = container.querySelector("#musicPlayBtn");
    const prevBtn = container.querySelector("#musicPrevBtn");
    const nextBtn = container.querySelector("#musicNextBtn");
    const shuffleBtn = container.querySelector("#musicShuffleBtn");
    const repeatBtn = container.querySelector("#musicRepeatBtn");
    const seekInput = container.querySelector("#musicSeekInput");

    if (playBtn) playBtn.addEventListener("click", () => togglePlay());
    if (prevBtn) prevBtn.addEventListener("click", () => prev());
    if (nextBtn) nextBtn.addEventListener("click", () => next());
    if (shuffleBtn) shuffleBtn.addEventListener("click", () => toggleShuffle());
    if (repeatBtn) repeatBtn.addEventListener("click", () => cycleRepeat());
    if (seekInput) {
      seekInput.addEventListener("input", () => {
        seekRatio(Number(seekInput.value) / 1000);
      });
    }

    container.querySelectorAll("[data-play-music]").forEach((btn) => {
      btn.addEventListener("click", () => {
        playIndex(Number(btn.dataset.playMusic));
      });
    });

    const apiBase = getApiBase();
    const cur = getCurrentTrack();
    const coverImg = container.querySelector("[data-music-cover-idx]");
    if (cur && coverImg) {
      resolveOfflineThumbSrc(apiBase, cur).then((localThumb) => {
        if (localThumb && coverImg.isConnected) coverImg.src = localThumb;
      });
    }

    container.querySelectorAll("img.gallery-thumb[data-thumb-idx]").forEach((img) => {
      const gIdx = Number(img.dataset.thumbIdx);
      const track = state.tracks.find((t) => t.galleryIdx === gIdx);
      if (!track) return;
      resolveOfflineThumbSrc(apiBase, track).then((localThumb) => {
        if (localThumb && img.isConnected) img.src = localThumb;
      });
    });
  }

  function renderMiniPlayer(miniEl) {
    if (!miniEl) return;
    const snap = getSnapshot();
    const cur = snap.track;
    if (!cur) {
      miniEl.hidden = true;
      miniEl.innerHTML = "";
      return;
    }
    miniEl.hidden = false;
    const pct = snap.duration > 0 ? Math.min(100, (snap.currentTime / snap.duration) * 100) : 0;
    const apiBase = getApiBase();
    const thumb = getTrackCoverSrc(cur);
    const fallbackUri = getTrackFallbackCover(cur);
    const titleText = cur.title?.trim() || cur.author?.trim() || "Blackpage Music";
    const artistText = cur.author?.trim() || "Audio";

    miniEl.innerHTML = `
      <div class="bp-mini-banner-view">
        <div class="bp-mini-progress" style="transform:scaleX(${(pct / 100).toFixed(3)})"></div>
        <button type="button" class="bp-mini-info" id="miniOpenMusicBtn">
          <img class="bp-mini-thumb" src="${escapeHtml(thumb)}" alt="" onerror="this.onerror=null;this.src='${escapeHtml(fallbackUri)}';" />
          <div class="bp-mini-meta">
            <strong>${escapeHtml(titleText)}</strong>
            <span>${escapeHtml(artistText)} • ${snap.isOffline ? "OFFLINE" : "STREAM"}</span>
          </div>
        </button>
        <div class="bp-mini-actions">
          <button type="button" class="btn btn-sm btn-primary bp-mini-svg-btn" id="miniPlayBtn" aria-label="Play/Pause">${snap.isPlaying ? PAUSE_ICON_SVG : PLAY_ICON_SVG}</button>
          <button type="button" class="btn btn-sm bp-mini-svg-btn" id="miniNextBtn" aria-label="Next">${NEXT_ICON_SVG}</button>
          <button type="button" class="btn btn-sm bp-mini-svg-btn" id="miniCloseBtn" title="Tutup" aria-label="Close">${CLOSE_ICON_SVG}</button>
        </div>
      </div>
      <div class="bp-mini-circle-view" aria-label="Musik sedang diputar">
        <img class="bp-mini-circle-img ${snap.isPlaying ? "is-spinning" : ""}" src="${escapeHtml(thumb)}" alt="" onerror="this.onerror=null;this.src='${escapeHtml(fallbackUri)}';" />
        <span class="bp-mini-circle-dot">${snap.isPlaying ? CIRCLE_EQ_SVG : CIRCLE_PAUSE_SVG}</span>
      </div>
    `;

    resolveOfflineThumbSrc(apiBase, cur).then((localThumb) => {
      if (!localThumb || !miniEl.isConnected) return;
      const latest = getCurrentTrack();
      if (!latest || latest.galleryIdx !== cur.galleryIdx) return;
      const miniThumb = miniEl.querySelector(".bp-mini-thumb");
      const circleImg = miniEl.querySelector(".bp-mini-circle-img");
      if (miniThumb) miniThumb.src = localThumb;
      if (circleImg) circleImg.src = localThumb;
    });
  }

  return {
    refreshTracks,
    getSnapshot,
    playIndex,
    togglePlay,
    next,
    prev,
    pause,
    stop,
    hasBackgroundPermission,
    requestBackgroundPermission,
    renderMusicTabHtml,
    bindMusicTabEvents,
    renderMiniPlayer,
    fmtTime,
  };
}
