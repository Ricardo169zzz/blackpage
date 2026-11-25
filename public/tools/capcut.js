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
  const list = loadGallery().filter((x) => !(x.url === entry.url && x.mediaType === "video"));
  list.unshift({
    url: entry.url,
    author: entry.author || "CapCut",
    title: entry.title || entry.url,
    thumbnail: entry.cover || null,
    mediaUrl: entry.video,
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

async function saveOnAndroidCapacitor(blob, filename) {
  const cap = window.Capacitor;
  const fs = cap?.Plugins?.Filesystem;
  if (!cap?.isNativePlatform?.() || !fs) return false;

  const targetPath = `Download/Blackpage/video/${filename}`;
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

function isCcUrl(val) {
  return /capcut\.com/i.test(val);
}

export const capcutTool = {
  id: "capcut-dl",
  name: "CapCut Downloader",
  badge: "READY",
  disabled: false,

  render() {
    return `
      <div class="stage-head">
        <div>
          <h2 class="stage-title">CapCut Template &amp; Video Downloader</h2>
          <p class="stage-desc">Tempel link CapCut — preview otomatis diputar &amp; unduh tanpa watermark.</p>
        </div>
        <span class="tag">NO WATERMARK</span>
      </div>

      <form id="ccForm" class="input-row">
        <input
          id="ccInput"
          class="brutal-input"
          type="url"
          placeholder="https://www.capcut.com/tv2/..."
          autocomplete="off"
          required
        />
        <button type="button" id="ccPaste" class="btn btn-cyan">Tempel</button>
        <button type="submit" id="ccSubmit" class="btn btn-primary">Ambil Video</button>
      </form>

      <div id="ccFeedback"></div>
      <div id="ccResult"></div>
    `;
  },

  init(root, { API_BASE, escapeHtml, prefs = { autoPaste: false, autoAnalyze: true, autoSaveGallery: true } }) {
    const form = root.querySelector("#ccForm");
    const input = root.querySelector("#ccInput");
    const pasteBtn = root.querySelector("#ccPaste");
    const submitBtn = root.querySelector("#ccSubmit");
    const feedback = root.querySelector("#ccFeedback");
    const resultEl = root.querySelector("#ccResult");

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

      const previewSrc = makeProxyUrl(API_BASE, data.video);
      const coverSrc = data.cover ? makeProxyUrl(API_BASE, data.cover) : "";
      const hasTitle = Boolean(data.title && data.title.trim());

      resultEl.innerHTML = `
        <article class="result-card">
          <video
            id="ccPreviewVideo"
            class="video-preview"
            src="${escapeHtml(previewSrc)}"
            ${coverSrc ? `poster="${escapeHtml(coverSrc)}"` : ""}
            controls
            autoplay
            muted
            playsinline
            loop
            preload="auto"
          ></video>

          <div class="result-meta">
            <div class="author-row">
              <span class="author-avatar author-fallback">CC</span>
              <div class="author-info">
                <h3>${escapeHtml(data.author || "CapCut Creator")}</h3>
              </div>
            </div>

            ${
              hasTitle
                ? `<div class="caption-box">
                    <div class="caption-head">
                      <span class="caption-label">CAPTION</span>
                      <div class="caption-actions">
                        <button type="button" class="btn btn-sm" id="ccCopySel">Salin Pilihan</button>
                        <button type="button" class="btn btn-sm btn-primary" id="ccCopyAll">Salin Semua</button>
                      </div>
                    </div>
                    <p class="result-caption" id="ccCaptionText">${escapeHtml(data.title)}</p>
                  </div>`
                : ""
            }

            <div class="dl-list">
              <button type="button" class="btn btn-success" id="ccDlBtn">Unduh Video (MP4)</button>
            </div>
          </div>
        </article>
      `;

      const videoEl = resultEl.querySelector("#ccPreviewVideo");
      if (videoEl) videoEl.play().catch(() => {});
    }

    async function handleDownload(btn) {
      if (!currentData) return;
      const base = (currentData.author || "capcut")
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .replace(/^_+|_+$/g, "") || "capcut";
      const filename = `${base}_${Date.now().toString().slice(-6)}.mp4`;
      const origText = btn.textContent;

      btn.disabled = true;
      btn.textContent = "Menyiapkan...";

      try {
        if (window.Capacitor?.isNativePlatform?.()) {
          const res = await fetch(makeProxyUrl(API_BASE, currentData.video));
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          const savedPath = await saveOnAndroidCapacitor(blob, filename);
          if (savedPath) {
            if (prefs.autoSaveGallery !== false) {
              saveToGallery({ ...currentData, filename });
            }
            setFeedback("info", `Tersimpan di ${savedPath}!`);
            return;
          }
        }

        const dlUrl = makeProxyUrl(API_BASE, currentData.video, { download: true, filename });
        const a = document.createElement("a");
        a.href = dlUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();

        if (prefs.autoSaveGallery !== false) {
          saveToGallery({ ...currentData, filename });
          setFeedback("info", "Download dimulai & otomatis tersimpan di Galeri!");
        } else {
          setFeedback("info", "Download dimulai!");
        }
      } catch (err) {
        setFeedback("error", err.message || "Gagal mengunduh video.");
      } finally {
        btn.disabled = false;
        btn.textContent = origText;
      }
    }

    async function runFetch(targetUrl) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Memproses...";
      setFeedback("info", "Mengambil video CapCut...");
      resultEl.innerHTML = "";

      try {
        const res = await fetch(`${API_BASE}/api/capcut`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: targetUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
        renderResult(data);
      } catch (err) {
        setFeedback("error", err.message || "Gagal mengambil video CapCut.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Ambil Video";
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
        if (prefs.autoAnalyze && isCcUrl(val)) {
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
          if (prefs.autoAnalyze && isCcUrl(val)) {
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
          if (isCcUrl(val)) {
            input.value = val;
            if (prefs.autoAnalyze) runFetch(val);
          }
        })
        .catch(() => {});
    }

    resultEl.addEventListener("click", async (e) => {
      const copyAllBtn = e.target.closest("#ccCopyAll");
      if (copyAllBtn && currentData?.title) {
        try {
          await navigator.clipboard.writeText(currentData.title);
          copyAllBtn.textContent = "Tersalin!";
          setTimeout(() => (copyAllBtn.textContent = "Salin Semua"), 1400);
        } catch {
          setFeedback("error", "Gagal menyalin caption.");
        }
        return;
      }

      const copySelBtn = e.target.closest("#ccCopySel");
      if (copySelBtn) {
        const capEl = resultEl.querySelector("#ccCaptionText");
        const sel = window.getSelection();
        const selected =
          sel && sel.rangeCount > 0 && capEl && capEl.contains(sel.anchorNode) ? sel.toString() : "";
        if (!selected.trim()) {
          setFeedback("info", "Blok/pilih dulu bagian teks caption yang mau disalin.");
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

      const dlBtn = e.target.closest("#ccDlBtn");
      if (dlBtn && !dlBtn.disabled) {
        handleDownload(dlBtn);
      }
    });
  },
};
