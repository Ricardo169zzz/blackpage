import { makeProxyUrl, downloadMediaFile } from "./download.js";

const GALLERY_KEY = "tools_op_tiktok_history_v1";
const MAX_GALLERY = 30;

function loadGallery() {
  try {
    const raw = localStorage.getItem(GALLERY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToGallery(entry) {
  const list = loadGallery().filter((x) => !(x.url === entry.url && x.mediaUrl === entry.mediaUrl));
  list.unshift({
    url: entry.url,
    author: entry.author || "Blackpage",
    title: entry.title || entry.url,
    thumbnail: entry.thumbnail || null,
    mediaUrl: entry.mediaUrl,
    mediaType: entry.mediaType || "video",
    filename: entry.filename,
    downloadedAt: Date.now(),
  });
  localStorage.setItem(GALLERY_KEY, JSON.stringify(list.slice(0, MAX_GALLERY)));
}

export function detectPlatform(raw) {
  let u;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();

  if (/(^|\.)tiktok\.com$/.test(host)) return "tiktok";
  if (/^(www\.|m\.|music\.)?(youtube\.com|youtu\.be)$/.test(host)) return "youtube";
  if (/^(open\.)?spotify\.com$/.test(host)) {
    return /\/playlist\//i.test(u.pathname) ? "spotify_playlist" : "spotify";
  }
  if (/^(www\.|m\.)?(instagram\.com|instagr\.am)$/.test(host)) return "instagram";
  if (/^(www\.|m\.|web\.|mbasic\.)?(facebook\.com|fb\.watch)$/.test(host)) return "facebook";
  if (/(^|\.)capcut\.com$/.test(host)) return "capcut";
  if (/^(www\.|id\.)?(pin\.it|pinterest\.[a-z.]+)$/.test(host)) return "pinterest";
  return null;
}

export function renderUniversalBoxHtml(lang = "id") {
  const isEn = lang === "en";
  return `
    <section class="uni-box">
      <div class="dash-head" style="margin-bottom:10px;">
        <div>
          <h2 class="stage-title">${isEn ? "Paste Any Link" : "Tempel Link Otomatis"}</h2>
          <p class="stage-desc">${isEn ? "Auto-detects TikTok, YouTube, Spotify, IG, FB, CapCut & Pinterest." : "Otomatis deteksi TikTok, YouTube, Spotify, IG, FB, CapCut & Pinterest."}</p>
        </div>
        <span class="tag" id="uniDetectTag">AUTO</span>
      </div>

      <form id="uniForm" class="input-row">
        <input
          id="uniInput"
          class="brutal-input"
          type="url"
          placeholder="${isEn ? "Paste video, audio, or image link here..." : "Tempel link video, musik, atau foto di sini..."}"
          autocomplete="off"
          required
        />
        <button type="button" id="uniPaste" class="btn btn-cyan">${isEn ? "Paste" : "Tempel"}</button>
        <button type="submit" id="uniSubmit" class="btn btn-primary">${isEn ? "Process" : "Proses"}</button>
      </form>

      <div id="uniFeedback"></div>
      <div id="uniResult"></div>
    </section>
  `;
}

export function initUniversalBox(root, { API_BASE, escapeHtml, prefs = { autoPaste: false, autoAnalyze: true, autoSaveGallery: true } }) {
  const form = root.querySelector("#uniForm");
  const input = root.querySelector("#uniInput");
  const pasteBtn = root.querySelector("#uniPaste");
  const submitBtn = root.querySelector("#uniSubmit");
  const detectTag = root.querySelector("#uniDetectTag");
  const feedback = root.querySelector("#uniFeedback");
  const resultEl = root.querySelector("#uniResult");

  let activeDownloadFn = null;
  let activeCopyText = "";

  function setFeedback(type, msg) {
    if (!msg) {
      feedback.innerHTML = "";
      return;
    }
    const cls = type === "error" ? "alert alert-error" : "alert alert-info";
    feedback.innerHTML = `<div class="${cls}">${escapeHtml(msg)}</div>`;
  }

  function updateDetectBadge(val) {
    const p = detectPlatform(val);
    if (p) {
      detectTag.textContent = p.replace("_", " ").toUpperCase();
    } else if (/^https?:\/\//i.test(val.trim())) {
      detectTag.textContent = "ALL LINK";
    } else {
      detectTag.textContent = "AUTO";
    }
  }

  async function triggerDownload(btn, { remoteUrl, mediaType, filename, galleryMeta }) {
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Menyiapkan...";
    try {
      const res = await downloadMediaFile({ API_BASE, remoteUrl, mediaType, filename });
      if (mediaType !== "image" && prefs.autoSaveGallery !== false) {
        saveToGallery({ ...galleryMeta, mediaUrl: remoteUrl, mediaType, filename });
      }
      if (res.native) {
        setFeedback("info", `Tersimpan di ${res.path}!`);
      } else if (mediaType !== "image" && prefs.autoSaveGallery !== false) {
        setFeedback("info", "Download dimulai & otomatis tersimpan di Galeri!");
      } else {
        setFeedback("info", "Download dimulai!");
      }
    } catch (err) {
      setFeedback("error", err.message || "Gagal mengunduh file.");
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }

  function renderFrame({ badge, mediaHtml, author, avatarUrl, title, chips = [], actionsHtml, extraHtml = "", onDownload }) {
    activeDownloadFn = onDownload;
    activeCopyText = title || "";
    setFeedback("", "");

    const avatarHtml = avatarUrl
      ? `<img class="author-avatar" src="${escapeHtml(makeProxyUrl(API_BASE, avatarUrl))}" alt="Avatar" loading="lazy" />`
      : `<span class="author-avatar author-fallback">${escapeHtml(badge.slice(0, 2))}</span>`;

    const captionHtml = title
      ? `<div class="caption-box">
          <div class="caption-head">
            <span class="caption-label">CAPTION / JUDUL</span>
            <div class="caption-actions">
              <button type="button" class="btn btn-sm" id="uniCopySel">Salin Pilihan</button>
              <button type="button" class="btn btn-sm btn-primary" id="uniCopyAll">Salin Semua</button>
            </div>
          </div>
          <p class="result-caption" id="uniCaptionText">${escapeHtml(title)}</p>
        </div>`
      : "";

    const chipsHtml = chips.length
      ? `<div class="stats-row">${chips.map((c) => `<span class="stat-chip">${escapeHtml(c)}</span>`).join("")}</div>`
      : "";

    resultEl.innerHTML = `
      <article class="result-card uni-frame">
        <div class="uni-frame-head">
          <span class="tag">${escapeHtml(badge)}</span>
        </div>
        ${mediaHtml}
        <div class="result-meta">
          <div class="author-row">
            ${avatarHtml}
            <div class="author-info">
              <h3>${escapeHtml(author || badge)}</h3>
            </div>
          </div>
          ${captionHtml}
          ${chipsHtml}
          ${extraHtml}
          <div class="dl-list">${actionsHtml}</div>
        </div>
      </article>
    `;

    const v = resultEl.querySelector("video.video-preview");
    if (v) v.play().catch(() => {});
    const a = resultEl.querySelector("audio.audio-preview");
    if (a) a.play().catch(() => {});
  }

  async function processUrl(rawUrl, ytOpts = { type: "video", quality: "720p" }) {
    const url = rawUrl.trim();
    updateDetectBadge(url);
    const platform = detectPlatform(url);

    if (!/^https?:\/\//i.test(url)) {
      resultEl.innerHTML = "";
      setFeedback("error", "Masukkan URL yang valid (diawali http:// atau https://).");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Memproses...";
    setFeedback("info", `Mendeteksi ${(platform || "all link").replace("_", " ").toUpperCase()}...`);
    resultEl.innerHTML = "";

    try {
      if (platform === "tiktok") {
        const res = await fetch(`${API_BASE}/api/tiktok`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (!res.ok || (data.status !== "success" && !(data.downloads || []).length)) {
          throw new Error(data.message || "Gagal mengambil video TikTok");
        }
        const downloads = [...(data.downloads || [])];
        if (data.music && !downloads.some((d) => d.url === data.music.url)) {
          downloads.push({ type: "audio_mp3", label: data.music.label || "Unduh MP3", url: data.music.url });
        }
        const preview =
          downloads.find((d) => d.type === "video_hd_no_watermark") ||
          downloads.find((d) => d.type === "video_no_watermark") ||
          downloads.find((d) => d.type !== "audio_mp3");

        renderFrame({
          badge: "TIKTOK",
          mediaHtml: preview
            ? `<video class="video-preview" src="${escapeHtml(makeProxyUrl(API_BASE, preview.url))}" ${data.thumbnail ? `poster="${escapeHtml(data.thumbnail)}"` : ""} controls autoplay muted playsinline loop preload="auto"></video>`
            : "",
          author: data.author || "TikTok",
          avatarUrl: data.avatar,
          title: data.title,
          chips: data.stats ? Object.entries(data.stats).map(([k, v]) => `${k}: ${v}`) : [],
          actionsHtml: downloads
            .map((dl, i) => `<button type="button" class="${i === 0 ? "btn btn-success" : "btn"}" data-uni-dl="${i}">${escapeHtml(dl.label)}</button>`)
            .join(""),
          onDownload: (btn, idx) => {
            const dl = downloads[idx];
            const isAudio = dl.type === "audio_mp3";
            const ext = isAudio ? "mp3" : "mp4";
            triggerDownload(btn, {
              remoteUrl: dl.url,
              mediaType: isAudio ? "audio" : "video",
              filename: `tiktok_${Date.now().toString().slice(-6)}.${ext}`,
              galleryMeta: { url, author: data.author, title: data.title, thumbnail: data.thumbnail },
            });
          },
        });
      } else if (platform === "youtube") {
        const res = await fetch(`${API_BASE}/api/youtube`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, type: ytOpts.type, quality: ytOpts.quality }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Gagal mengambil video YouTube");
        const isAudio = data.type === "audio";
        const mediaProxy = makeProxyUrl(API_BASE, data.downloadUrl);

        renderFrame({
          badge: "YOUTUBE",
          mediaHtml: isAudio
            ? `${data.thumbnail ? `<img class="thumb" src="${escapeHtml(data.thumbnail)}" alt="Cover" />` : ""}<audio class="audio-preview" src="${escapeHtml(mediaProxy)}" controls autoplay preload="auto"></audio>`
            : `<video class="video-preview" src="${escapeHtml(mediaProxy)}" ${data.thumbnail ? `poster="${escapeHtml(data.thumbnail)}"` : ""} controls autoplay muted playsinline preload="auto"></video>`,
          author: data.channel || "YouTube",
          title: data.title,
          chips: [data.quality, data.size, data.duration].filter(Boolean),
          extraHtml: `
            <select id="uniYtQuality" class="brutal-input" style="margin-bottom:10px;" aria-label="Pilih Kualitas YouTube">
              ${[
                ["video:720p", "Video 720p (MP4)"],
                ["video:1080p", "Video 1080p (MP4)"],
                ["video:480p", "Video 480p (MP4)"],
                ["video:360p", "Video 360p (MP4)"],
                ["audio:720p", "Audio (MP3)"],
              ]
                .map(([val, lbl]) => `<option value="${val}" ${val === `${ytOpts.type}:${ytOpts.quality}` ? "selected" : ""}>${lbl}</option>`)
                .join("")}
            </select>
          `,
          actionsHtml: `<button type="button" class="btn btn-success" data-uni-dl="0">Unduh ${isAudio ? "MP3" : `MP4 (${escapeHtml(data.quality)})`}</button>`,
          onDownload: (btn) => {
            const ext = data.extension || (isAudio ? "mp3" : "mp4");
            triggerDownload(btn, {
              remoteUrl: data.downloadUrl,
              mediaType: isAudio ? "audio" : "video",
              filename: data.filename || `youtube_${Date.now().toString().slice(-6)}.${ext}`,
              galleryMeta: { url, author: data.channel, title: data.title, thumbnail: data.thumbnail },
            });
          },
        });

        const qSel = resultEl.querySelector("#uniYtQuality");
        if (qSel) {
          qSel.addEventListener("change", () => {
            const [type, quality] = qSel.value.split(":");
            processUrl(url, { type, quality });
          });
        }
      } else if (platform === "spotify") {
        const res = await fetch(`${API_BASE}/api/spotify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: url }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Gagal mengambil lagu Spotify");
        renderFrame({
          badge: "SPOTIFY",
          mediaHtml: `${data.cover ? `<img class="thumb" src="${escapeHtml(makeProxyUrl(API_BASE, data.cover))}" alt="Cover" />` : ""}<audio class="audio-preview" src="${escapeHtml(makeProxyUrl(API_BASE, data.mp3Url))}" controls autoplay preload="auto"></audio>`,
          author: data.artist,
          title: data.title,
          chips: [data.album, data.duration, data.year].filter(Boolean).map(String),
          actionsHtml: `<button type="button" class="btn btn-success" data-uni-dl="0">Unduh MP3</button>`,
          onDownload: (btn) =>
            triggerDownload(btn, {
              remoteUrl: data.mp3Url,
              mediaType: "audio",
              filename: `spotify_${Date.now().toString().slice(-6)}.mp3`,
              galleryMeta: { url, author: data.artist, title: `${data.title} — ${data.artist}`, thumbnail: data.cover },
            }),
        });
      } else if (platform === "spotify_playlist") {
        const res = await fetch(`${API_BASE}/api/spotify/playlist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Gagal mengambil playlist Spotify");
        setFeedback("", "");
        const tracksHtml = (data.tracks || [])
          .map(
            (tr) => `
            <div class="gallery-row-card">
              ${tr.cover ? `<img class="gallery-thumb" src="${escapeHtml(makeProxyUrl(API_BASE, tr.cover))}" alt="Cover" loading="lazy" />` : `<span class="gallery-thumb gallery-thumb-fallback">MP3</span>`}
              <div class="gallery-row-body">
                <div class="gallery-row-top">
                  ${tr.duration ? `<span class="tag">${escapeHtml(tr.duration)}</span>` : ""}
                  <strong class="gallery-author">${escapeHtml(tr.artists || "Spotify")}</strong>
                </div>
                <p class="gallery-row-title">${escapeHtml(tr.title)}</p>
              </div>
              <button type="button" class="btn btn-sm btn-primary" data-uni-sp-track="${escapeHtml(tr.url || tr.title)}">Ambil</button>
            </div>
          `
          )
          .join("");
        resultEl.innerHTML = `<div class="result-card uni-frame"><div class="stage-head" style="margin-bottom:4px;"><h3 style="margin:0;font-size:0.9rem;">${escapeHtml(data.title)}</h3><span class="tag">${(data.tracks || []).length} LAGU</span></div><div class="gallery-list">${tracksHtml}</div></div>`;
      } else if (platform === "instagram") {
        const res = await fetch(`${API_BASE}/api/instagram`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Gagal mengambil media Instagram");
        const items = data.items || [];
        const mediaHtml = items
          .map((it) => {
            const isVid = it.type === "mp4" || it.type === "video";
            const src = makeProxyUrl(API_BASE, it.url);
            return isVid
              ? `<video class="video-preview" src="${escapeHtml(src)}" controls autoplay muted playsinline loop preload="auto"></video>`
              : `<img class="thumb" src="${escapeHtml(src)}" alt="Instagram" loading="lazy" />`;
          })
          .join("");
        renderFrame({
          badge: "INSTAGRAM",
          mediaHtml,
          author: "Instagram",
          actionsHtml: items
            .map((it, i) => {
              const isVid = it.type === "mp4" || it.type === "video";
              return `<button type="button" class="${i === 0 ? "btn btn-success" : "btn"}" data-uni-dl="${i}">Unduh ${isVid ? "MP4" : "Foto"} ${items.length > 1 ? `#${i + 1}` : ""}</button>`;
            })
            .join(""),
          onDownload: (btn, idx) => {
            const it = items[idx];
            const isVid = it.type === "mp4" || it.type === "video";
            triggerDownload(btn, {
              remoteUrl: it.url,
              mediaType: isVid ? "video" : "image",
              filename: `instagram_${Date.now().toString().slice(-6)}.${it.type || (isVid ? "mp4" : "jpg")}`,
              galleryMeta: { url, author: "Instagram", title: "Instagram Media" },
            });
          },
        });
      } else if (platform === "facebook") {
        const res = await fetch(`${API_BASE}/api/facebook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Gagal mengambil video Facebook");
        const downloads = data.downloads || [];
        const preview = downloads.find((d) => /hd/i.test(d.quality)) || downloads[0];
        renderFrame({
          badge: "FACEBOOK",
          mediaHtml: preview ? `<video class="video-preview" src="${escapeHtml(makeProxyUrl(API_BASE, preview.url))}" controls autoplay muted playsinline loop preload="auto"></video>` : "",
          author: "Facebook",
          actionsHtml: downloads
            .map((dl, i) => `<button type="button" class="${i === 0 ? "btn btn-success" : "btn"}" data-uni-dl="${i}">Unduh MP4 (${escapeHtml(dl.quality)})</button>`)
            .join(""),
          onDownload: (btn, idx) =>
            triggerDownload(btn, {
              remoteUrl: downloads[idx].url,
              mediaType: "video",
              filename: `facebook_${Date.now().toString().slice(-6)}.mp4`,
              galleryMeta: { url, author: "Facebook", title: `Facebook (${downloads[idx].quality})` },
            }),
        });
      } else if (platform === "capcut") {
        const res = await fetch(`${API_BASE}/api/capcut`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Gagal mengambil video CapCut");
        renderFrame({
          badge: "CAPCUT",
          mediaHtml: `<video class="video-preview" src="${escapeHtml(makeProxyUrl(API_BASE, data.video))}" ${data.cover ? `poster="${escapeHtml(makeProxyUrl(API_BASE, data.cover))}"` : ""} controls autoplay muted playsinline loop preload="auto"></video>`,
          author: data.author || "CapCut",
          title: data.title,
          actionsHtml: `<button type="button" class="btn btn-success" data-uni-dl="0">Unduh MP4</button>`,
          onDownload: (btn) =>
            triggerDownload(btn, {
              remoteUrl: data.video,
              mediaType: "video",
              filename: `capcut_${Date.now().toString().slice(-6)}.mp4`,
              galleryMeta: { url, author: data.author, title: data.title, thumbnail: data.cover },
            }),
        });
      } else if (platform === "pinterest") {
        const res = await fetch(`${API_BASE}/api/pinterest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Gagal mengambil media Pinterest");
        const items = data.items || [];
        renderFrame({
          badge: "PINTEREST",
          mediaHtml: items
            .map((it, i) => {
              const src = makeProxyUrl(API_BASE, it.url);
              return it.isVideo
                ? `<video class="video-preview" src="${escapeHtml(src)}" controls autoplay muted playsinline loop preload="auto"></video>`
                : `<img class="thumb pin-zoomable" data-uni-zoom="${escapeHtml(src)}" data-uni-zoom-idx="${i}" src="${escapeHtml(src)}" alt="Pinterest" loading="lazy" title="Klik untuk perbesar" />`;
            })
            .join(""),
          author: "Pinterest",
          chips: items[0]?.width && items[0]?.height ? [`${items[0].width} × ${items[0].height}`] : [],
          actionsHtml: items
            .map((it, i) => `<button type="button" class="${i === 0 ? "btn btn-success" : "btn"}" data-uni-dl="${i}">Unduh ${it.isVideo ? "MP4" : "Gambar"} ${items.length > 1 ? `#${i + 1}` : ""}</button>`)
            .join(""),
          onDownload: (btn, idx) => {
            const it = items[idx];
            triggerDownload(btn, {
              remoteUrl: it.url,
              mediaType: it.isVideo ? "video" : "image",
              filename: `pinterest_${Date.now().toString().slice(-6)}.${it.isVideo ? "mp4" : "png"}`,
              galleryMeta: { url, author: "Pinterest", title: "Pinterest Video" },
            });
          },
        });
      } else {
        const res = await fetch(`${API_BASE}/api/aio`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Link tidak didukung atau gagal diambil");

        const dls = data.downloads || [];
        const vid = dls.find((d) => d.type === "video");
        const img = dls.find((d) => d.type === "image");
        const aud = dls.find((d) => d.type === "audio");
        const mediaHtml = vid
          ? `<video class="video-preview" src="${escapeHtml(makeProxyUrl(API_BASE, vid.url))}" ${data.thumbnail ? `poster="${escapeHtml(data.thumbnail)}"` : ""} controls autoplay muted playsinline loop preload="auto"></video>`
          : img
            ? `<img class="thumb" src="${escapeHtml(makeProxyUrl(API_BASE, img.url))}" alt="Media" loading="lazy" />`
            : aud
              ? `<audio class="audio-preview" src="${escapeHtml(makeProxyUrl(API_BASE, aud.url))}" controls autoplay preload="auto"></audio>`
              : "";

        renderFrame({
          badge: "ALL LINK",
          mediaHtml,
          author: data.author || "AIO Downloader",
          title: data.title,
          actionsHtml: dls
            .map((dl, i) => `<button type="button" class="${i === 0 ? "btn btn-success" : "btn"}" data-uni-dl="${i}">${escapeHtml(dl.label)}</button>`)
            .join(""),
          onDownload: (btn, idx) => {
            const dl = dls[idx];
            const ext = dl.type === "audio" ? "mp3" : dl.type === "image" ? "jpg" : "mp4";
            triggerDownload(btn, {
              remoteUrl: dl.url,
              mediaType: dl.type,
              filename: `blackpage_${Date.now().toString().slice(-6)}.${ext}`,
              galleryMeta: { url, author: data.author, title: data.title || url, thumbnail: data.thumbnail },
            });
          },
        });
      }
    } catch (err) {
      setFeedback("error", err.message || "Gagal memproses link.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Proses";
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (input.value.trim()) processUrl(input.value);
  });

  input.addEventListener("input", () => updateDetectBadge(input.value));

  input.addEventListener("paste", () => {
    setTimeout(() => {
      const val = input.value.trim();
      updateDetectBadge(val);
      if (prefs.autoAnalyze && val) processUrl(val);
    }, 20);
  });

  pasteBtn.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const val = text.trim();
        input.value = val;
        updateDetectBadge(val);
        if (prefs.autoAnalyze) processUrl(val);
        else input.focus();
      }
    } catch {
      setFeedback("error", "Izin clipboard ditolak browser. Tempel manual dengan Ctrl+V.");
    }
  });

  if (prefs.autoPaste && !input.value.trim() && navigator.clipboard?.readText) {
    navigator.clipboard
      .readText()
      .then((text) => {
        const val = (text || "").trim();
        if (detectPlatform(val)) {
          input.value = val;
          updateDetectBadge(val);
          if (prefs.autoAnalyze) processUrl(val);
        }
      })
      .catch(() => {});
  }

  resultEl.addEventListener("click", async (e) => {
    const zoomImg = e.target.closest("[data-uni-zoom]");
    if (zoomImg) {
      const src = zoomImg.dataset.uniZoom;
      const idx = Number(zoomImg.dataset.uniZoomIdx || 0);
      const existing = document.getElementById("pinLightbox");
      if (existing) existing.remove();
      const modal = document.createElement("div");
      modal.id = "pinLightbox";
      modal.className = "pin-lightbox";
      modal.innerHTML = `
        <div class="pin-lightbox-box">
          <div class="pin-lightbox-bar">
            <span class="tag">FULL IMAGE</span>
            <button type="button" class="btn btn-sm" id="pinLbClose">Tutup ✕</button>
          </div>
          <img class="pin-lightbox-img" src="${escapeHtml(src)}" alt="Full Preview" />
          <button type="button" class="btn btn-success pin-lightbox-dl" id="pinLbDl">Unduh Gambar</button>
        </div>
      `;
      const close = () => {
        document.removeEventListener("keydown", onKey);
        modal.remove();
      };
      const onKey = (ev) => {
        if (ev.key === "Escape") close();
      };
      document.addEventListener("keydown", onKey);
      modal.addEventListener("click", (ev) => {
        if (ev.target === modal || ev.target.closest("#pinLbClose")) {
          close();
          return;
        }
        const dl = ev.target.closest("#pinLbDl");
        if (dl && !dl.disabled && activeDownloadFn) {
          activeDownloadFn(dl, idx);
        }
      });
      document.body.appendChild(modal);
      return;
    }

    const spTrack = e.target.closest("[data-uni-sp-track]");
    if (spTrack) {
      const trackVal = spTrack.dataset.uniSpTrack;
      input.value = trackVal;
      processUrl(trackVal);
      return;
    }

    const copyAllBtn = e.target.closest("#uniCopyAll");
    if (copyAllBtn && activeCopyText) {
      try {
        await navigator.clipboard.writeText(activeCopyText);
        copyAllBtn.textContent = "Tersalin!";
        setTimeout(() => (copyAllBtn.textContent = "Salin Semua"), 1400);
      } catch {
        setFeedback("error", "Gagal menyalin teks.");
      }
      return;
    }

    const copySelBtn = e.target.closest("#uniCopySel");
    if (copySelBtn) {
      const capEl = resultEl.querySelector("#uniCaptionText");
      const sel = window.getSelection();
      const selected =
        sel && sel.rangeCount > 0 && capEl && capEl.contains(sel.anchorNode) ? sel.toString() : "";
      if (!selected.trim()) {
        setFeedback("info", "Blok/pilih dulu bagian teks yang mau disalin.");
        return;
      }
      try {
        await navigator.clipboard.writeText(selected);
        copySelBtn.textContent = "Tersalin!";
        setTimeout(() => (copySelBtn.textContent = "Salin Pilihan"), 1400);
      } catch {
        setFeedback("error", "Gagal menyalin teks pilihan.");
      }
      return;
    }

    const dlBtn = e.target.closest("[data-uni-dl]");
    if (dlBtn && !dlBtn.disabled && activeDownloadFn) {
      activeDownloadFn(dlBtn, Number(dlBtn.dataset.uniDl));
    }
  });
}
