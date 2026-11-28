export function makeProxyUrl(API_BASE, remoteUrl, { download = false, filename = "", referer = "", fallback = false } = {}) {
  if (remoteUrl.startsWith(`${API_BASE}/api/`) || remoteUrl.startsWith("/api/")) {
    const u = new URL(remoteUrl, window.location.origin);
    if (download) u.searchParams.set("download", "1");
    if (filename) u.searchParams.set("filename", filename);
    return remoteUrl.startsWith("/") ? `${u.pathname}${u.search}` : u.toString();
  }
  const params = new URLSearchParams({ url: remoteUrl });
  if (download) params.set("download", "1");
  if (filename) params.set("filename", filename);
  if (referer) params.set("ref", referer);
  if (fallback) params.set("fallback", "1");
  return `${API_BASE}/api/media?${params.toString()}`;
}

const THUMB_CACHE_NAME = "blackpage-thumbs-v1";

export async function cacheOfflineThumb(API_BASE, thumbUrl, thumbFilename = "") {
  if (!thumbUrl) return;
  const proxyUrl = makeProxyUrl(API_BASE, thumbUrl);
  const cap = window.Capacitor;
  const fs = cap?.Plugins?.Filesystem;
  if (cap?.isNativePlatform?.() && fs && thumbFilename) {
    try {
      await fs.mkdir({ path: "thumbs", directory: "DATA", recursive: true }).catch(() => {});
      await fs.downloadFile({
        url: proxyUrl,
        path: `thumbs/${thumbFilename}`,
        directory: "DATA",
        recursive: true,
      });
    } catch {
      try {
        await fs.mkdir({ path: "Download/Blackpage/thumb", directory: "EXTERNAL_STORAGE", recursive: true }).catch(() => {});
        await fs.downloadFile({
          url: proxyUrl,
          path: `Download/Blackpage/thumb/${thumbFilename}`,
          directory: "EXTERNAL_STORAGE",
          recursive: true,
        });
      } catch {}
    }
  }
  if (typeof caches !== "undefined") {
    try {
      const cache = await caches.open(THUMB_CACHE_NAME);
      await cache.add(proxyUrl);
    } catch {}
  }
}

export async function resolveOfflineThumbSrc(API_BASE, item) {
  if (!item) return "";
  const cap = window.Capacitor;
  const fs = cap?.Plugins?.Filesystem;
  if (cap?.isNativePlatform?.() && fs) {
    const stem = item.filename ? String(item.filename).replace(/\.[^.]+$/, "") : "";
    const candidates = [];
    if (item.thumbFilename) {
      candidates.push(["DATA", `thumbs/${item.thumbFilename}`]);
      candidates.push(["EXTERNAL_STORAGE", `Download/Blackpage/thumb/${item.thumbFilename}`]);
    }
    if (stem) {
      candidates.push(["DATA", `thumbs/thumb_${stem}.jpg`]);
      candidates.push(["EXTERNAL_STORAGE", `Download/Blackpage/thumb/thumb_${stem}.jpg`]);
      candidates.push(["EXTERNAL_STORAGE", `Download/Blackpage/thumb/${stem}.jpg`]);
    }
    if (item.mediaType === "image") {
      if (item.localPath) candidates.push(["EXTERNAL_STORAGE", item.localPath]);
      if (item.filename) {
        candidates.push(["EXTERNAL_STORAGE", `Download/Blackpage/image/${item.filename}`]);
        candidates.push(["EXTERNAL_STORAGE", `Download/Blackpage/${item.filename}`]);
      }
    }
    for (const [dir, path] of candidates) {
      try {
        await fs.stat({ path, directory: dir });
        const res = await fs.getUri({ path, directory: dir });
        const uri = res?.uri || "";
        if (uri) return typeof cap.convertFileSrc === "function" ? cap.convertFileSrc(uri) : uri;
      } catch {}
    }
  }
  if (typeof caches !== "undefined") {
    const urls = [item.thumbnail, item.mediaType === "image" ? item.mediaUrl : ""].filter(Boolean);
    for (const u of urls) {
      try {
        const cache = await caches.open(THUMB_CACHE_NAME);
        const match = await cache.match(makeProxyUrl(API_BASE, u));
        if (match) {
          const blob = await match.blob();
          return URL.createObjectURL(blob);
        }
      } catch {}
    }
  }
  return "";
}

function escapeAttr(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderProgressHtml({ label = "Mengunduh...", percent = null, bytes = 0, total = 0 } = {}) {
  const pctText =
    typeof percent === "number"
      ? `${percent}%`
      : bytes > 0
        ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
        : "...";
  const isIndet = typeof percent !== "number";
  const widthStyle = isIndet ? "" : `style="width:${Math.max(0, Math.min(100, percent))}%"`;
  const totalText = total > 0 ? ` (${(bytes / (1024 * 1024)).toFixed(1)}/${(total / (1024 * 1024)).toFixed(1)} MB)` : "";

  return `
    <div class="dl-progress-wrap">
      <div class="dl-progress-meta">
        <span>${escapeAttr(label)}${escapeAttr(totalText)}</span>
        <span>${escapeAttr(pctText)}</span>
      </div>
      <div class="dl-progress-bar">
        <div class="dl-progress-fill ${isIndet ? "indeterminate" : ""}" ${widthStyle}></div>
      </div>
    </div>
  `;
}

// --- Global Floating Download Toast (3s Rectangle -> Bottom-Left Circle) ---
const toastState = {
  el: null,
  morphTimer: null,
  hideTimer: null,
  activeCount: 0,
  isCircle: false,
  status: "idle", // "downloading" | "done" | "error"
  filename: "",
  percent: null,
  bytes: 0,
  total: 0,
  errorMsg: "",
};

function ensureToastEl() {
  if (toastState.el && document.body.contains(toastState.el)) return toastState.el;
  const host = document.querySelector(".app-shell") || document.body;
  const el = document.createElement("div");
  el.id = "dlToast";
  el.className = "dl-toast";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.hidden = true;

  el.addEventListener("click", (e) => {
    if (e.target.closest("[data-toast-close]")) {
      e.stopPropagation();
      hideToastNow();
      return;
    }
    if (toastState.isCircle) {
      toastState.isCircle = false;
      renderToast();
      scheduleMorphToCircle();
    } else if (toastState.status === "downloading") {
      clearTimeout(toastState.morphTimer);
      toastState.isCircle = true;
      renderToast();
    } else {
      hideToastNow();
    }
  });

  host.appendChild(el);
  toastState.el = el;
  return el;
}

function hideToastNow() {
  clearTimeout(toastState.morphTimer);
  clearTimeout(toastState.hideTimer);
  if (toastState.el) {
    toastState.el.classList.add("is-hiding");
    const target = toastState.el;
    setTimeout(() => {
      if (toastState.status === "idle") {
        target.hidden = true;
        target.classList.remove("is-hiding");
      }
    }, 240);
  }
  toastState.isCircle = false;
  toastState.status = "idle";
}

function scheduleMorphToCircle() {
  clearTimeout(toastState.morphTimer);
  if (toastState.status !== "downloading") return;
  toastState.morphTimer = setTimeout(() => {
    if (toastState.status === "downloading") {
      toastState.isCircle = true;
      renderToast();
    }
  }, 3000);
}

const RING_CIRCUMFERENCE = 113.1; // 2 * PI * 18

function renderToast() {
  const el = ensureToastEl();
  el.hidden = false;
  el.classList.remove("is-hiding");
  el.classList.toggle("is-circle", toastState.isCircle);
  el.classList.toggle("is-done", toastState.status === "done");
  el.classList.toggle("is-error", toastState.status === "error");

  const pct = typeof toastState.percent === "number" ? Math.max(0, Math.min(100, toastState.percent)) : null;

  const iconSvg =
    toastState.status === "done"
      ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
      : toastState.status === "error"
        ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
        : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><polyline points="7 11 12 16 17 11"/><path d="M5 20h14"/></svg>`;

  if (!el.querySelector(".dl-toast-rect") || !el.querySelector(".dl-circle-badge")) {
    el.innerHTML = `
      <div class="dl-toast-rect">
        <div class="dl-toast-row">
          <span class="dl-toast-badge"></span>
          <div class="dl-toast-info">
            <div class="dl-toast-title"></div>
            <div class="dl-toast-sub"></div>
          </div>
          <span class="dl-toast-pct"></span>
          <button type="button" class="dl-toast-close" data-toast-close aria-label="Tutup">&times;</button>
        </div>
        <div class="dl-progress-bar dl-toast-bar">
          <div class="dl-progress-fill"></div>
        </div>
      </div>
      <div class="dl-circle-badge">
        <svg class="dl-circle-ring" viewBox="0 0 44 44">
          <circle class="dl-ring-track" cx="22" cy="22" r="18" />
          <circle class="dl-ring-fill" cx="22" cy="22" r="18" style="stroke-dasharray:${RING_CIRCUMFERENCE};stroke-dashoffset:${RING_CIRCUMFERENCE}" />
        </svg>
        <span class="dl-circle-icon"></span>
        <span class="dl-circle-pct" hidden></span>
      </div>
    `;
  }

  const circleBadge = el.querySelector(".dl-circle-badge");
  const ringEl = el.querySelector(".dl-circle-ring");
  const ringFill = el.querySelector(".dl-ring-fill");
  const circleIcon = el.querySelector(".dl-circle-icon");
  const pctBadge = el.querySelector(".dl-circle-pct");
  const isSpin = pct === null && toastState.status === "downloading";
  const ringOffset =
    toastState.status === "done"
      ? 0
      : pct === null
        ? RING_CIRCUMFERENCE * 0.68
        : RING_CIRCUMFERENCE * (1 - pct / 100);

  if (circleBadge) circleBadge.title = toastState.filename || "Mengunduh";
  if (circleIcon) circleIcon.innerHTML = iconSvg;
  if (ringEl) ringEl.classList.toggle("is-spin", isSpin);
  if (ringFill) ringFill.style.strokeDashoffset = ringOffset.toFixed(2);
  if (pctBadge) {
    if (pct !== null && toastState.status === "downloading") {
      pctBadge.hidden = false;
      pctBadge.textContent = `${pct}%`;
    } else {
      pctBadge.hidden = true;
    }
  }

  const rectBadge = el.querySelector(".dl-toast-badge");
  if (rectBadge) rectBadge.innerHTML = iconSvg;

  const pctLabel =
    toastState.status === "done"
      ? "100%"
      : toastState.status === "error"
        ? "GAGAL"
        : pct !== null
          ? `${pct}%`
          : toastState.bytes > 0
            ? `${(toastState.bytes / (1024 * 1024)).toFixed(1)} MB`
            : "...";

  const titleText =
    toastState.status === "done"
      ? "Unduhan selesai"
      : toastState.status === "error"
        ? toastState.errorMsg || "Gagal mengunduh"
        : "Mengunduh file...";

  const isIndet = toastState.status === "downloading" && pct === null;
  const fillWidth = toastState.status === "done" ? 100 : pct ?? 0;

  const titleEl = el.querySelector(".dl-toast-title");
  const subEl = el.querySelector(".dl-toast-sub");
  const pctEl = el.querySelector(".dl-toast-pct");
  const fillEl = el.querySelector(".dl-progress-fill");

  if (titleEl) titleEl.textContent = titleText;
  if (subEl) subEl.textContent = toastState.filename || "media";
  if (pctEl) pctEl.textContent = pctLabel;
  if (fillEl) {
    fillEl.classList.toggle("indeterminate", isIndet);
    fillEl.style.width = isIndet ? "" : `${fillWidth}%`;
  }
}

function beginGlobalToast(filename) {
  clearTimeout(toastState.hideTimer);
  toastState.activeCount += 1;
  toastState.status = "downloading";
  toastState.filename = filename;
  toastState.percent = 0;
  toastState.bytes = 0;
  toastState.total = 0;
  toastState.errorMsg = "";
  toastState.isCircle = false;
  renderToast();
  scheduleMorphToCircle();
}

function updateGlobalToast({ bytes = 0, total = 0, percent = null } = {}) {
  if (toastState.status !== "downloading") return;
  toastState.bytes = bytes;
  toastState.total = total;
  toastState.percent = percent;
  renderToast();
}

function endGlobalToast(ok, errorMsg = "") {
  toastState.activeCount = Math.max(0, toastState.activeCount - 1);
  if (toastState.activeCount > 0) return;

  clearTimeout(toastState.morphTimer);
  clearTimeout(toastState.hideTimer);

  if (ok) {
    toastState.status = "done";
    toastState.percent = 100;
    renderToast();
    toastState.hideTimer = setTimeout(hideToastNow, 3200);
  } else {
    toastState.status = "error";
    toastState.isCircle = false;
    toastState.errorMsg = errorMsg || "Gagal mengunduh.";
    renderToast();
    toastState.hideTimer = setTimeout(hideToastNow, 4500);
  }
}

export function openStickerLightbox(imgSrc, title = "Preview Sticker") {
  if (!imgSrc) return;
  document.querySelector("#bpStickerLightbox")?.remove();
  const host = document.querySelector(".app-shell") || document.body;
  const modal = document.createElement("div");
  modal.id = "bpStickerLightbox";
  modal.className = "sticker-lightbox-backdrop";
  modal.innerHTML = `
    <div class="sticker-lightbox-frame" role="dialog" aria-modal="true">
      <div class="sticker-lightbox-head">
        <span class="tag">${escapeAttr(title)}</span>
        <button type="button" class="btn btn-sm" id="stickerLbClose">&times; Tutup</button>
      </div>
      <div class="sticker-lightbox-mat">
        <img class="sticker-lightbox-img" src="${escapeAttr(imgSrc)}" alt="${escapeAttr(title)}" />
      </div>
    </div>
  `;
  const close = () => modal.remove();
  modal.querySelector("#stickerLbClose")?.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  host.appendChild(modal);
}

function triggerBrowserDownload(href, filename) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function getSavedPrefs() {
  try {
    const raw = localStorage.getItem("tools_op_prefs_v1");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function downloadMediaFile({ API_BASE, remoteUrl, mediaType, filename, onProgress }) {
  const cap = window.Capacitor;
  const fs = cap?.Plugins?.Filesystem;
  const prefs = getSavedPrefs();
  const maxAttempts = prefs.autoRetry === false ? 1 : Math.max(1, Math.min(5, Number(prefs.maxRetry) || 3));

  const emitProgress = (p) => {
    updateGlobalToast(p);
    onProgress?.(p);
  };

  beginGlobalToast(filename);

  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (cap?.isNativePlatform?.()) {
        if (!fs) {
          throw new Error("Plugin Filesystem belum aktif di APK. Silakan update/build ulang APK.");
        }
        if (!API_BASE) {
          throw new Error("API Base URL belum diisi. Buka Setting -> Lanjutan lalu isi URL server.");
        }

        const subDir = mediaType === "audio" ? "audio" : mediaType === "image" ? "image" : "video";
        const customDir =
          mediaType === "audio"
            ? prefs.audioFolder
            : mediaType === "video"
              ? prefs.videoFolder
              : "";
        const dirPath = (customDir || `Download/Blackpage/${subDir}`).replace(/^\/+|\/+$/g, "");
      const targetPath = `${dirPath}/${filename}`;
      const sourceUrl = makeProxyUrl(API_BASE, remoteUrl, { download: true, filename });

      try {
        await fs.requestPermissions?.();
      } catch {
        // Android 13+ may not require legacy storage permission for Download/
      }

      try {
        await fs.mkdir({
          path: dirPath,
          directory: "EXTERNAL_STORAGE",
          recursive: true,
        });
      } catch {
        // Folder may already exist
      }

      if (typeof fs.downloadFile === "function") {
        let progressHandle = null;
        if (typeof fs.addListener === "function") {
          try {
            progressHandle = await fs.addListener("progress", (ev) => {
              if (ev?.url && ev.url !== sourceUrl) return;
              const total = Number(ev?.contentLength || 0);
              const bytes = Number(ev?.bytes || 0);
              const percent = total > 0 ? Math.min(100, Math.round((bytes / total) * 100)) : null;
              emitProgress({ bytes, total, percent });
            });
          } catch {
            progressHandle = null;
          }
        }

        try {
          emitProgress({ bytes: 0, total: 0, percent: 0 });
          await fs.downloadFile({
            url: sourceUrl,
            path: targetPath,
            directory: "EXTERNAL_STORAGE",
            recursive: true,
            progress: true,
          });
          emitProgress({ bytes: 1, total: 1, percent: 100 });
          endGlobalToast(true);
          return { native: true, path: targetPath };
        } finally {
          await progressHandle?.remove?.().catch?.(() => { });
        }
      }

      // Fallback for older Filesystem plugin without downloadFile
      const res = await fetch(makeProxyUrl(API_BASE, remoteUrl));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || "").split(",")[1] || "");
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      await fs.writeFile({
        path: targetPath,
        data: base64,
        directory: "EXTERNAL_STORAGE",
        recursive: true,
      });
      emitProgress({ bytes: blob.size, total: blob.size, percent: 100 });
      endGlobalToast(true);
      return { native: true, path: targetPath };
    }

    // Web: stream with progress when available, then save via Blob URL
    const dlUrl = makeProxyUrl(API_BASE, remoteUrl, { download: true, filename });
    if (typeof ReadableStream !== "undefined") {
      try {
        emitProgress({ bytes: 0, total: 0, percent: 0 });
        const res = await fetch(dlUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (res.body) {
          const total = Number(res.headers.get("content-length") || 0);
          const reader = res.body.getReader();
          const chunks = [];
          let bytes = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            bytes += value.byteLength;
            const percent = total > 0 ? Math.min(100, Math.round((bytes / total) * 100)) : null;
            emitProgress({ bytes, total, percent });
          }
          const blob = new Blob(chunks, {
            type: res.headers.get("content-type") || "application/octet-stream",
          });
          const objUrl = URL.createObjectURL(blob);
          triggerBrowserDownload(objUrl, filename);
          setTimeout(() => URL.revokeObjectURL(objUrl), 30000);
          emitProgress({ bytes, total: total || bytes, percent: 100 });
          endGlobalToast(true);
          return { native: false, path: filename };
        }
      } catch {
        // Fallback to direct anchor if CORS/stream fails
      }
    }

    triggerBrowserDownload(dlUrl, filename);
    endGlobalToast(true);
    return { native: false, path: filename };
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 700));
        continue;
      }
      endGlobalToast(false, err?.message || "Gagal mengunduh.");
      throw err;
    }
  }
}
