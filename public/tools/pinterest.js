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
    author: "Pinterest",
    title: entry.title || entry.url,
    thumbnail: entry.thumbnail || null,
    mediaUrl: entry.mediaUrl,
    mediaType: "video",
    filename: entry.filename,
    downloadedAt: Date.now(),
  });
  localStorage.setItem(GALLERY_KEY, JSON.stringify(list.slice(0, MAX_GALLERY)));
}

function makeProxyUrl(API_BASE, remoteUrl, { download = false, filename = "" } = {}) {
  const params = new URLSearchParams({ url: remoteUrl });
  if (download) params.set("download", "1");
  if (filename) params.set("filename", filename);
  return `${API_BASE}/api/media?${params.toString()}`;
}

async function saveOnAndroidCapacitor(blob, filename, isVideo) {
  const cap = window.Capacitor;
  const fs = cap?.Plugins?.Filesystem;
  if (!cap?.isNativePlatform?.() || !fs) return false;

  const subDir = isVideo ? "video" : "image";
  const targetPath = `Download/Blackpage/${subDir}/${filename}`;
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = String(reader.result || "");
      resolve(res.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  await fs.writeFile({
    path: targetPath,
    data: base64,
    directory: "EXTERNAL_STORAGE",
    recursive: true,
  });
  return targetPath;
}

function isPinUrl(val) {
  return /(pin\.it|pinterest\.)/i.test(val);
}

export const pinterestTool = {
  id: "pinterest-dl",
  name: "Pinterest Downloader",
  badge: "READY",
  disabled: false,

  render() {
    return `
      <div class="stage-head">
        <div>
          <h2 class="stage-title">Pinterest Image &amp; Video Downloader</h2>
          <p class="stage-desc">Tempel link pin.it atau pinterest.com — preview HD &amp; unduh cepat.</p>
        </div>
        <span class="tag">HD / MP4</span>
      </div>

      <form id="pinForm" class="input-row">
        <input
          id="pinInput"
          class="brutal-input"
          type="url"
          placeholder="https://pin.it/... atau pinterest.com/pin/..."
          autocomplete="off"
          required
        />
        <button type="button" id="pinPaste" class="btn btn-cyan">Tempel</button>
        <button type="submit" id="pinSubmit" class="btn btn-primary">Ambil Media</button>
      </form>

      <div id="pinFeedback"></div>
      <div id="pinResult"></div>
    `;
  },

  init(root, { API_BASE, escapeHtml, prefs = { autoPaste: false, autoAnalyze: true, autoSaveGallery: true } }) {
    const form = root.querySelector("#pinForm");
    const input = root.querySelector("#pinInput");
    const pasteBtn = root.querySelector("#pinPaste");
    const submitBtn = root.querySelector("#pinSubmit");
    const feedback = root.querySelector("#pinFeedback");
    const resultEl = root.querySelector("#pinResult");

    let currentData = null;

    function setFeedback(type, msg) {
      if (!msg) {
        feedback.innerHTML = "";
        return;
      }
      const cls = type === "error" ? "alert alert-error" : "alert alert-info";
      feedback.innerHTML = `<div class="${cls}">${escapeHtml(msg)}</div>`;
    }

    function renderResult(data) {
      currentData = data;
      setFeedback("", "");

      const cardsHtml = (data.items || [])
        .map((item, idx) => {
          const mediaSrc = makeProxyUrl(API_BASE, item.url);
          const previewHtml = item.isVideo
            ? `<video class="video-preview pin-preview" src="${escapeHtml(mediaSrc)}" controls autoplay muted playsinline loop preload="auto"></video>`
            : `<img class="thumb pin-zoomable" src="${escapeHtml(mediaSrc)}" data-pin-zoom="${idx}" alt="Pinterest Media ${idx + 1}" loading="lazy" title="Klik untuk perbesar" />`;

          const dimChip =
            item.width && item.height
              ? `<div class="stats-row"><span class="stat-chip">${item.width} × ${item.height}</span></div>`
              : "";

          return `
            <article class="result-card">
              ${previewHtml}
              ${dimChip}
              <div class="dl-list">
                <button type="button" class="btn btn-success" data-pin-idx="${idx}">
                  Unduh ${item.isVideo ? "Video (MP4)" : "Gambar"} ${data.items.length > 1 ? `#${idx + 1}` : ""}
                </button>
              </div>
            </article>
          `;
        })
        .join("");

      resultEl.innerHTML = cardsHtml;
      resultEl.querySelectorAll("video.pin-preview").forEach((v) => v.play().catch(() => {}));
    }

    async function handleDownload(btn, idx) {
      const item = currentData?.items?.[idx];
      if (!item) return;

      const extMatch = item.url.match(/\.([a-z0-9]+)(?:\?|$)/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : item.isVideo ? "mp4" : "png";
      const filename = `pinterest_${Date.now().toString().slice(-6)}_${idx + 1}.${ext}`;
      const origText = btn.textContent;

      btn.disabled = true;
      btn.textContent = "Menyiapkan...";

      try {
        if (window.Capacitor?.isNativePlatform?.()) {
          const res = await fetch(makeProxyUrl(API_BASE, item.url));
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          const savedPath = await saveOnAndroidCapacitor(blob, filename, item.isVideo);
          if (savedPath) {
            if (item.isVideo && prefs.autoSaveGallery !== false) {
              saveToGallery({
                url: currentData.url,
                title: "Pinterest Video",
                mediaUrl: item.url,
                filename,
              });
            }
            setFeedback("info", `Tersimpan di ${savedPath}!`);
            return;
          }
        }

        const dlUrl = makeProxyUrl(API_BASE, item.url, { download: true, filename });
        const a = document.createElement("a");
        a.href = dlUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();

        if (item.isVideo && prefs.autoSaveGallery !== false) {
          saveToGallery({
            url: currentData.url,
            title: "Pinterest Video",
            mediaUrl: item.url,
            filename,
          });
          setFeedback("info", "Download dimulai & otomatis tersimpan di Galeri!");
        } else {
          setFeedback("info", "Download dimulai!");
        }
      } catch (err) {
        setFeedback("error", err.message || "Gagal mengunduh media.");
      } finally {
        btn.disabled = false;
        btn.textContent = origText;
      }
    }

    async function runFetch(targetUrl) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Memproses...";
      setFeedback("info", "Mengambil media Pinterest...");
      resultEl.innerHTML = "";

      try {
        const res = await fetch(`${API_BASE}/api/pinterest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: targetUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
        renderResult(data);
      } catch (err) {
        setFeedback("error", err.message || "Gagal mengambil media Pinterest.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Ambil Media";
      }
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = input.value.trim();
      if (val) runFetch(val);
    });

    input.addEventListener("paste", () => {
      setTimeout(() => {
        const val = input.value.trim();
        if (prefs.autoAnalyze && isPinUrl(val)) {
          runFetch(val);
        }
      }, 20);
    });

    pasteBtn.addEventListener("click", async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          const val = text.trim();
          input.value = val;
          if (prefs.autoAnalyze && isPinUrl(val)) {
            runFetch(val);
          } else {
            input.focus();
          }
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
          if (isPinUrl(val)) {
            input.value = val;
            if (prefs.autoAnalyze) runFetch(val);
          }
        })
        .catch(() => {});
    }

    function openImagePopup(idx) {
      const item = currentData?.items?.[idx];
      if (!item || item.isVideo) return;

      const existing = document.getElementById("pinLightbox");
      if (existing) existing.remove();

      const mediaSrc = makeProxyUrl(API_BASE, item.url);
      const modal = document.createElement("div");
      modal.id = "pinLightbox";
      modal.className = "pin-lightbox";
      modal.innerHTML = `
        <div class="pin-lightbox-box">
          <div class="pin-lightbox-bar">
            <span class="tag">${item.width && item.height ? `${item.width} × ${item.height}` : "FULL IMAGE"}</span>
            <button type="button" class="btn btn-sm" id="pinLbClose">Tutup ✕</button>
          </div>
          <img class="pin-lightbox-img" src="${escapeHtml(mediaSrc)}" alt="Full Preview" />
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
        if (dl && !dl.disabled) {
          handleDownload(dl, idx);
        }
      });

      document.body.appendChild(modal);
    }

    resultEl.addEventListener("click", (e) => {
      const zoomImg = e.target.closest("[data-pin-zoom]");
      if (zoomImg) {
        openImagePopup(Number(zoomImg.dataset.pinZoom));
        return;
      }
      const dlBtn = e.target.closest("[data-pin-idx]");
      if (dlBtn && !dlBtn.disabled) {
        handleDownload(dlBtn, Number(dlBtn.dataset.pinIdx));
      }
    });
  },
};
