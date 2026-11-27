import { makeProxyUrl, downloadMediaFile, cacheOfflineThumb } from "./download.js";

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
    thumbFilename: entry.thumbFilename || "",
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
  if (/(^|\.)(douyin|iesdouyin)\.com$/.test(host)) return "douyin";
  if (/^(www\.|m\.|music\.)?(youtube\.com|youtu\.be)$/.test(host)) return "youtube";
  if (/^(open\.)?spotify\.com$/.test(host)) {
    return /\/playlist\//i.test(u.pathname) ? "spotify_playlist" : "spotify";
  }
  if (/^(www\.|m\.)?(instagram\.com|instagr\.am)$/.test(host)) return "instagram";
  if (/^(www\.|m\.|web\.|mbasic\.)?(facebook\.com|fb\.watch)$/.test(host)) return "facebook";
  if (/(^|\.)threads\.(net|com)$/.test(host)) return "threads";
  if (/(^|\.)(reddit\.com|redd\.it)$/.test(host)) return "reddit";
  if (/(^|\.)capcut\.com$/.test(host)) return "capcut";
  if (/^(www\.|id\.)?(pin\.it|pinterest\.[a-z.]+)$/.test(host)) return "pinterest";
  if (/(^|\.)pixiv\.net$/.test(host)) return "pixiv";
  if (/(^|\.)(bilibili\.(com|tv)|b23\.tv)$/.test(host)) return "bilibili";
  if (/(^|\.)(xiaohongshu\.com|xhslink\.(com|cn)|rednote\.com)$/.test(host)) return "rednote";
  return null;
}

export function renderUniversalBoxHtml(lang = "id") {
  const isEn = lang === "en";
  return `
    <section class="uni-box">
      <div class="dash-head" style="margin-bottom:10px;">
        <div>
          <h2 class="stage-title">${isEn ? "Paste Any Link" : "Tempel Link Otomatis"}</h2>
          <p class="stage-desc">${isEn ? "Auto-detects TikTok, Douyin, YouTube, Spotify, IG, FB, Threads, Reddit, Pixiv, Bilibili, RedNote, CapCut & Pinterest." : "Otomatis deteksi TikTok, Douyin, YouTube, Spotify, IG, FB, Threads, Reddit, Pixiv, Bilibili, RedNote, CapCut & Pinterest."}</p>
        </div>
        <span class="tag" id="uniDetectTag">AUTO</span>
      </div>

      <form id="uniForm" class="input-row">
        <div class="uni-input-wrap">
          <input
            id="uniInput"
            class="brutal-input"
            type="url"
            placeholder="${isEn ? "Paste video, audio, or image link here..." : "Tempel link video, musik, atau foto di sini..."}"
            autocomplete="off"
            required
          />
          <button type="button" id="uniClear" class="uni-clear-btn" aria-label="${isEn ? "Clear link" : "Hapus link"}" hidden>&times;</button>
        </div>
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
  const clearBtn = root.querySelector("#uniClear");
  const pasteBtn = root.querySelector("#uniPaste");
  const submitBtn = root.querySelector("#uniSubmit");
  const detectTag = root.querySelector("#uniDetectTag");
  const feedback = root.querySelector("#uniFeedback");
  const resultEl = root.querySelector("#uniResult");

  let activeDownloadFn = null;
  let activeCopyText = "";
  let procTimers = [];
  let procExitTimer = null;

  const CHECK_SVG = `<svg class="bp-check-svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>`;
  const BUG_SVG = `<svg class="bp-bug-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="6" width="8" height="14" rx="4"/><path d="M19 10h2M3 10h2M19 15h2M3 15h2M17 7l2-2M7 7L5 5M17 19l2 2M7 19l-2 2M12 6V3"/></svg>`;

  function clearProcTimers() {
    procTimers.forEach((id) => clearTimeout(id));
    procTimers = [];
    clearTimeout(procExitTimer);
  }

  function renderProcCard(pct, label, state = "loading") {
    const iconHtml =
      state === "success"
        ? CHECK_SVG
        : state === "error"
          ? BUG_SVG
          : `<span class="bp-proc-spin"></span>`;
    const stateCls = state === "success" ? "is-success" : state === "error" ? "is-error" : "";
    let card = feedback.querySelector(".bp-proc-card");
    if (!card) {
      feedback.innerHTML = `
        <div class="bp-proc-card ${stateCls}">
          <div class="bp-proc-head">
            <div class="bp-proc-status">
              <span class="bp-proc-icon">${iconHtml}</span>
              <span class="bp-proc-label">${escapeHtml(label)}</span>
            </div>
            <span class="bp-proc-pct">${pct}%</span>
          </div>
          <div class="bp-proc-track">
            <div class="bp-proc-fill" style="transform:scaleX(${(pct / 100).toFixed(3)})"></div>
          </div>
        </div>
      `;
      return;
    }
    card.classList.remove("is-success", "is-error", "is-exit");
    if (stateCls) card.classList.add(stateCls);
    card.querySelector(".bp-proc-icon").innerHTML = iconHtml;
    card.querySelector(".bp-proc-label").textContent = label;
    card.querySelector(".bp-proc-pct").textContent = `${pct}%`;
    card.querySelector(".bp-proc-fill").style.transform = `scaleX(${(pct / 100).toFixed(3)})`;
  }

  function setFeedback(type, msg) {
    clearProcTimers();
    if (!msg) {
      feedback.innerHTML = "";
      return;
    }
    const cls = type === "error" ? "alert alert-error" : "alert alert-info";
    feedback.innerHTML = `<div class="${cls}">${escapeHtml(msg)}</div>`;
  }

  function updateDetectBadge(val) {
    if (clearBtn) clearBtn.hidden = !String(val || "").trim();
    const p = detectPlatform(val);
    if (p) {
      detectTag.textContent = p.replace("_", " ").toUpperCase();
      detectTag.classList.add("is-detected");
    } else if (/^https?:\/\//i.test(val.trim())) {
      detectTag.textContent = "ALL LINK";
      detectTag.classList.add("is-detected");
    } else {
      detectTag.textContent = "AUTO";
      detectTag.classList.remove("is-detected");
    }
  }

  async function triggerDownload(btn, { remoteUrl, mediaType, filename, galleryMeta }) {
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Menyiapkan...";
    try {
      const thumbSrc = galleryMeta?.thumbnail || (mediaType === "image" ? remoteUrl : "");
      const thumbFilename = thumbSrc
        ? `thumb_${filename.replace(/\.[^.]+$/, "")}.jpg`
        : "";
      const res = await downloadMediaFile({ API_BASE, remoteUrl, mediaType, filename });
      if (prefs.autoSaveGallery !== false) {
        saveToGallery({ ...galleryMeta, thumbnail: thumbSrc || galleryMeta?.thumbnail || "", mediaUrl: remoteUrl, mediaType, filename, thumbFilename });
        if (thumbSrc) {
          cacheOfflineThumb(API_BASE, thumbSrc, thumbFilename);
        }
      }
      if (res.native) {
        setFeedback("info", `Tersimpan di ${res.path}!`);
      } else if (prefs.autoSaveGallery !== false) {
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

  function renderPhotoCarouselHtml(photos, altText) {
    if (!photos.length) return "";
    if (photos.length === 1) {
      const p = photos[0];
      return `<img class="thumb pin-zoomable" data-uni-zoom="${escapeHtml(p.src)}" data-uni-zoom-idx="${p.dlIdx}" src="${escapeHtml(p.src)}" alt="${escapeHtml(altText)}" loading="lazy" title="Klik untuk perbesar" />`;
    }
    return `
      <div class="uni-carousel" data-uni-carousel>
        <div class="uni-car-track">
          ${photos
            .map(
              (p, n) => `
            <div class="uni-slide">
              <img class="thumb pin-zoomable" data-uni-zoom="${escapeHtml(p.src)}" data-uni-zoom-idx="${p.dlIdx}" src="${escapeHtml(p.src)}" alt="${escapeHtml(altText)} ${n + 1}" loading="lazy" title="Klik untuk perbesar" />
            </div>`
            )
            .join("")}
        </div>
        <button type="button" class="uni-car-btn prev" data-car-dir="-1" aria-label="Foto sebelumnya">&#8249;</button>
        <button type="button" class="uni-car-btn next" data-car-dir="1" aria-label="Foto berikutnya">&#8250;</button>
        <span class="uni-car-count">1 / ${photos.length}</span>
      </div>
    `;
  }

  function renderFrame({ badge, mediaHtml, author, avatarUrl, title, chips = [], actionsHtml, extraHtml = "", onDownload }) {
    activeDownloadFn = onDownload;
    activeCopyText = title || "";

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
    if (v) {
      v.muted = false;
      v.play().catch(() => {
        v.muted = true;
        v.play().catch(() => {});
      });
    }
    const a = resultEl.querySelector("audio.audio-preview");
    if (a) a.play().catch(() => {});

    resultEl.querySelectorAll("[data-uni-carousel]").forEach((car) => {
      const track = car.querySelector(".uni-car-track");
      const countEl = car.querySelector(".uni-car-count");
      const total = car.querySelectorAll(".uni-slide").length;
      if (!track || total < 2) return;
      const syncCount = () => {
        const w = track.clientWidth || 1;
        const idx = Math.max(0, Math.min(total - 1, Math.round(track.scrollLeft / w)));
        if (countEl) countEl.textContent = `${idx + 1} / ${total}`;
      };
      track.addEventListener("scroll", syncCount, { passive: true });
      car.querySelectorAll("[data-car-dir]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const dir = Number(btn.dataset.carDir || 1);
          track.scrollBy({ left: dir * (track.clientWidth || 300), behavior: "smooth" });
        });
      });
    });
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
    resultEl.innerHTML = "";
    clearProcTimers();
    const pName = (platform || "all link").replace("_", " ").toUpperCase();
    renderProcCard(15, `Mendeteksi ${pName}...`, "loading");
    procTimers.push(setTimeout(() => renderProcCard(42, `Menghubungi server ${pName}...`, "loading"), 350));
    procTimers.push(setTimeout(() => renderProcCard(72, `Mengambil media & stream...`, "loading"), 1100));
    procTimers.push(setTimeout(() => renderProcCard(88, `Menyiapkan preview...`, "loading"), 2400));

    const finishSuccess = () => {
      clearProcTimers();
      renderProcCard(100, `Selesai!`, "success");
      procExitTimer = setTimeout(() => {
        const card = feedback.querySelector(".bp-proc-card");
        if (!card) return;
        card.classList.add("is-exit");
        setTimeout(() => {
          if (feedback.contains(card)) feedback.innerHTML = "";
        }, 340);
      }, 520);
    };

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
        const images = downloads.filter((d) => d.type === "image");
        const audio = downloads.find((d) => d.type === "audio_mp3");
        const preview =
          downloads.find((d) => d.type === "video_hd_no_watermark") ||
          downloads.find((d) => d.type === "video_no_watermark") ||
          downloads.find((d) => d.type !== "audio_mp3" && d.type !== "image");

        const photos = downloads
          .map((dl, i) => (dl.type === "image" ? { src: makeProxyUrl(API_BASE, dl.url), dlIdx: i } : null))
          .filter(Boolean);
        const mediaHtml = photos.length
          ? `${renderPhotoCarouselHtml(photos, "TikTok Foto")}${audio ? `<audio class="audio-preview" src="${escapeHtml(makeProxyUrl(API_BASE, audio.url))}" controls preload="auto"></audio>` : ""}`
          : preview
            ? `<video class="video-preview" src="${escapeHtml(makeProxyUrl(API_BASE, preview.url))}" ${data.thumbnail ? `poster="${escapeHtml(data.thumbnail)}"` : ""} controls autoplay muted playsinline loop preload="auto"></video>`
            : "";

        renderFrame({
          badge: "TIKTOK",
          mediaHtml,
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
            const isImg = dl.type === "image";
            const ext = isAudio ? "mp3" : isImg ? "jpg" : "mp4";
            triggerDownload(btn, {
              remoteUrl: dl.url,
              mediaType: isAudio ? "audio" : isImg ? "image" : "video",
              filename: `tiktok_${Date.now().toString().slice(-6)}.${ext}`,
              galleryMeta: { url, author: data.author, title: data.title, thumbnail: data.thumbnail || photos[0] || data.avatar || "" },
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
        const igVideos = items
          .map((it) => {
            const isVid = it.type === "mp4" || it.type === "video";
            return isVid
              ? `<video class="video-preview" src="${escapeHtml(makeProxyUrl(API_BASE, it.url))}" controls autoplay muted playsinline loop preload="auto"></video>`
              : "";
          })
          .join("");
        const igPhotos = items
          .map((it, i) =>
            it.type === "mp4" || it.type === "video" ? null : { src: makeProxyUrl(API_BASE, it.url), dlIdx: i }
          )
          .filter(Boolean);
        const mediaHtml = `${igVideos}${renderPhotoCarouselHtml(igPhotos, "Instagram")}`;
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
        const pinPhotos = items
          .map((it, i) => (it.isVideo ? null : { src: makeProxyUrl(API_BASE, it.url), dlIdx: i }))
          .filter(Boolean);
        const pinVideos = items
          .filter((it) => it.isVideo)
          .map((it) => `<video class="video-preview" src="${escapeHtml(makeProxyUrl(API_BASE, it.url))}" controls autoplay muted playsinline loop preload="auto"></video>`)
          .join("");
        renderFrame({
          badge: "PINTEREST",
          mediaHtml: `${pinVideos}${renderPhotoCarouselHtml(pinPhotos, "Pinterest")}`,
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
      } else if (["douyin", "threads", "reddit", "pixiv", "bilibili", "rednote"].includes(platform)) {
        const res = await fetch(`${API_BASE}/api/${platform}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (!res.ok || !(data.downloads || []).length) {
          throw new Error(data.message || `Gagal mengambil media ${platform.toUpperCase()}`);
        }
        const dls = data.downloads || [];
        const vid = dls.find((d) => d.type === "video");
        const imgs = dls.filter((d) => d.type === "image");
        const aud = dls.find((d) => d.type === "audio");
        const posterAttr = data.thumbnail
          ? `poster="${escapeHtml(makeProxyUrl(API_BASE, data.thumbnail))}"`
          : "";
        const socialPhotos = dls
          .map((im, i) => (im.type === "image" ? { src: makeProxyUrl(API_BASE, im.url), dlIdx: i } : null))
          .filter(Boolean);
        const mediaHtml = vid
          ? `<video class="video-preview" src="${escapeHtml(makeProxyUrl(API_BASE, vid.url))}" ${posterAttr} controls autoplay muted playsinline loop preload="auto"></video>`
          : socialPhotos.length
            ? renderPhotoCarouselHtml(socialPhotos, platform)
            : aud
              ? `<audio class="audio-preview" src="${escapeHtml(makeProxyUrl(API_BASE, aud.url))}" controls autoplay preload="auto"></audio>`
              : "";

        renderFrame({
          badge: platform.toUpperCase(),
          mediaHtml,
          author: data.author || platform.toUpperCase(),
          title: data.title,
          actionsHtml: dls
            .map((dl, i) => {
              const kind = dl.type === "audio" ? "MP3" : dl.type === "image" ? "Foto" : "MP4";
              return `<button type="button" class="${i === 0 ? "btn btn-success" : "btn"}" data-uni-dl="${i}">Unduh ${kind} (${escapeHtml(dl.quality)})</button>`;
            })
            .join(""),
          onDownload: (btn, idx) => {
            const dl = dls[idx];
            const ext = dl.type === "audio" ? "mp3" : dl.type === "image" ? "jpg" : "mp4";
            triggerDownload(btn, {
              remoteUrl: dl.url,
              mediaType: dl.type,
              filename: `${platform}_${Date.now().toString().slice(-6)}.${ext}`,
              galleryMeta: {
                url,
                author: data.author,
                title: data.title || url,
                thumbnail: data.thumbnail,
              },
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
        const imgIdx = dls.findIndex((d) => d.type === "image");
        const mediaHtml = vid
          ? `<video class="video-preview" src="${escapeHtml(makeProxyUrl(API_BASE, vid.url))}" ${data.thumbnail ? `poster="${escapeHtml(data.thumbnail)}"` : ""} controls autoplay muted playsinline loop preload="auto"></video>`
          : img
            ? `<img class="thumb pin-zoomable" data-uni-zoom="${escapeHtml(makeProxyUrl(API_BASE, img.url))}" data-uni-zoom-idx="${imgIdx}" src="${escapeHtml(makeProxyUrl(API_BASE, img.url))}" alt="Media" loading="lazy" title="Klik untuk perbesar" />`
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
      finishSuccess();
    } catch (err) {
      clearProcTimers();
      renderProcCard(100, err.message || "Gagal memproses link.", "error");
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

  clearBtn?.addEventListener("click", () => {
    input.value = "";
    updateDetectBadge("");
    setFeedback("", "");
    resultEl.innerHTML = "";
    input.focus();
  });

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
      const allSlides = Array.from(resultEl.querySelectorAll("[data-uni-zoom]")).map((el) => ({
        src: el.dataset.uniZoom,
        dlIdx: Number(el.dataset.uniZoomIdx || 0),
      }));
      let activeSlideIdx = Math.max(
        0,
        allSlides.findIndex(
          (s) => s.src === zoomImg.dataset.uniZoom && s.dlIdx === Number(zoomImg.dataset.uniZoomIdx || 0)
        )
      );
      if (!allSlides.length) {
        allSlides.push({
          src: zoomImg.dataset.uniZoom,
          dlIdx: Number(zoomImg.dataset.uniZoomIdx || 0),
        });
      }

      const existing = document.getElementById("pinLightbox");
      if (existing) existing.remove();
      const modal = document.createElement("div");
      modal.id = "pinLightbox";
      modal.className = "pin-lightbox";
      const multi = allSlides.length > 1;
      modal.innerHTML = `
        <div class="pin-lightbox-box">
          <div class="pin-lightbox-bar">
            <span class="tag">FULL PHOTO</span>
            <button type="button" class="btn btn-sm" id="pinLbClose">Tutup ✕</button>
          </div>
          <div class="pin-lightbox-mat">
            ${
              multi
                ? `<div class="uni-carousel" id="pinLbCarousel">
                    <div class="uni-car-track">
                      ${allSlides
                        .map(
                          (s, n) => `
                        <div class="uni-slide">
                          <img class="pin-lightbox-img" src="${escapeHtml(s.src)}" alt="Full Preview ${n + 1}" />
                        </div>`
                        )
                        .join("")}
                    </div>
                    <button type="button" class="uni-car-btn prev" data-lb-dir="-1" aria-label="Foto sebelumnya">&#8249;</button>
                    <button type="button" class="uni-car-btn next" data-lb-dir="1" aria-label="Foto berikutnya">&#8250;</button>
                    <span class="uni-car-count" id="pinLbCount">${activeSlideIdx + 1} / ${allSlides.length}</span>
                  </div>`
                : `<img class="pin-lightbox-img" src="${escapeHtml(allSlides[0].src)}" alt="Full Preview" />`
            }
          </div>
          <button type="button" class="btn btn-success pin-lightbox-dl" id="pinLbDl">Unduh Foto</button>
        </div>
      `;

      const track = modal.querySelector(".uni-car-track");
      const countEl = modal.querySelector("#pinLbCount");
      const syncSlide = () => {
        if (!track) return;
        const w = track.clientWidth || 1;
        activeSlideIdx = Math.max(0, Math.min(allSlides.length - 1, Math.round(track.scrollLeft / w)));
        if (countEl) countEl.textContent = `${activeSlideIdx + 1} / ${allSlides.length}`;
      };
      const stepSlide = (dir) => {
        if (!track) return;
        track.scrollBy({ left: dir * (track.clientWidth || 300), behavior: "smooth" });
      };
      if (track) {
        track.addEventListener("scroll", syncSlide, { passive: true });
      }

      const close = () => {
        document.removeEventListener("keydown", onKey);
        modal.remove();
      };
      const onKey = (ev) => {
        if (ev.key === "Escape") close();
        else if (multi && ev.key === "ArrowLeft") stepSlide(-1);
        else if (multi && ev.key === "ArrowRight") stepSlide(1);
      };
      document.addEventListener("keydown", onKey);
      modal.addEventListener("click", (ev) => {
        if (ev.target === modal || ev.target.closest("#pinLbClose")) {
          close();
          return;
        }
        const dirBtn = ev.target.closest("[data-lb-dir]");
        if (dirBtn) {
          stepSlide(Number(dirBtn.dataset.lbDir || 1));
          return;
        }
        const dl = ev.target.closest("#pinLbDl");
        if (dl && !dl.disabled && activeDownloadFn) {
          const targetSlide = allSlides[activeSlideIdx] || allSlides[0];
          activeDownloadFn(dl, targetSlide.dlIdx);
        }
      });
      document.body.appendChild(modal);
      if (track && activeSlideIdx > 0) {
        requestAnimationFrame(() => {
          track.scrollTo({ left: activeSlideIdx * (track.clientWidth || 0), behavior: "auto" });
        });
      }
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
